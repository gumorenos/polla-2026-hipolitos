import { prisma } from './db';
import {
  buildKnockoutPropagationPlan,
  type TournamentRepairPreview,
} from './knockout-propagation';
import {
  buildKnockoutChampionStatusUpdates,
  buildRoundOf32ChampionStatusUpdates,
  type ChampionStatusUpdate,
} from './champion-status-sync';
import { filterRealTeams } from './public-team-market-analysis';
import { isConsistentFinalMatchResult } from './match-result';

export type KnockoutProgressionApplyResult = {
  propagatedSlots: number;
  groupStatusUpdates: number;
  statusUpdates: number;
  conflicts: string[];
  pendingReferences: string[];
};

export async function previewTournamentStateRepair(): Promise<TournamentRepairPreview> {
  const [matches, leagues] = await Promise.all([
    prisma.match.findMany({ orderBy: { kickoffUtc: 'asc' } }),
    prisma.league.findMany({
      where: { competitionType: 'champion_survivor', isActive: true },
      select: {
        id: true,
        teamTournamentStatuses: { select: { teamCode: true, status: true } },
      },
    }),
  ]);
  const propagation = buildKnockoutPropagationPlan(matches);
  const changes: TournamentRepairPreview['changes'] = propagation.proposals
    .filter((proposal) => proposal.changed)
    .map((proposal) => ({
      changeType: 'bracket' as const,
      leagueId: null,
      matchId: proposal.matchId,
      teamCode: proposal.resolvedTeamCode,
      from: proposal.currentTeamCode,
      to: proposal.resolvedTeamCode,
      reason: proposal.reason,
      safe: true,
    }));
  const blocked = propagation.conflicts.map((conflict) => (
    `${conflict.matchId} ${conflict.side}: ${conflict.reason}`
  ));

  const groupCodes = Array.from(new Set(
    matches
      .filter((match) => match.phase === 'groups')
      .flatMap((match) => [match.homeTeamCode, match.awayTeamCode]),
  ));
  const r32Codes = Array.from(new Set(
    matches
      .filter((match) => match.phase === 'r32')
      .flatMap((match) => [match.homeTeamCode, match.awayTeamCode]),
  ));
  const rosterTeams = filterRealTeams(await prisma.team.findMany({
    where: { code: { in: groupCodes } },
    select: { code: true, name: true },
  }));
  const rosterCodes = rosterTeams.map((team) => team.code);
  const groupMatches = matches.filter((match) => match.phase === 'groups');
  if (
    groupMatches.length !== 72
    || groupMatches.some((match) => !isConsistentFinalMatchResult(match))
    || rosterCodes.length !== 48
    || r32Codes.length !== 32
  ) {
    blocked.push('La vista previa de estados requiere 72 resultados finales, 48 equipos de grupos y 32 equipos materializados en r32.');
    return { changes, blocked };
  }

  for (const league of leagues) {
    const existingByTeam = new Map(
      league.teamTournamentStatuses.map((status) => [status.teamCode, status.status]),
    );
    const groupPlan = buildRoundOf32ChampionStatusUpdates(
      rosterCodes,
      league.teamTournamentStatuses,
      r32Codes,
    );
    const knockoutPlan = buildKnockoutChampionStatusUpdates(
      rosterCodes,
      league.teamTournamentStatuses,
      matches,
    );
    blocked.push(...knockoutPlan.conflicts.map((conflict) => `${league.id}: ${conflict}`));
    const finalUpdates = new Map<string, {
      update: ChampionStatusUpdate;
      changeType: 'group_status' | 'knockout_status';
    }>(
      groupPlan.updates.map((update) => [update.teamCode, { update, changeType: 'group_status' as const }]),
    );
    for (const update of knockoutPlan.updates) {
      finalUpdates.set(update.teamCode, { update, changeType: 'knockout_status' as const });
    }
    for (const { update, changeType } of finalUpdates.values()) {
      changes.push({
        changeType,
        leagueId: league.id,
        matchId: update.eliminatedInMatchId || null,
        teamCode: update.teamCode,
        from: existingByTeam.get(update.teamCode) || 'sin fila',
        to: update.status,
        reason: changeType === 'group_status'
          ? 'Estado derivado del roster materializado de r32.'
          : `Estado derivado de resultado eliminatorio${update.eliminatedInMatchId ? ` ${update.eliminatedInMatchId}` : ''}.`,
        safe: changeType === 'group_status' || knockoutPlan.conflicts.length === 0,
      });
    }
  }

  return { changes, blocked };
}

export async function applyKnockoutProgressionAndSurvivorSync(
  actorUserId?: string,
): Promise<KnockoutProgressionApplyResult> {
  const groupSync = await syncMaterializedRoundOf32SurvivorStatuses(actorUserId);
  const matches = await prisma.match.findMany({ orderBy: { kickoffUtc: 'asc' } });
  const propagation = buildKnockoutPropagationPlan(matches);
  const changedProposals = propagation.proposals.filter((proposal) => proposal.changed);
  let statusUpdates = 0;
  const statusConflicts: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const proposal of changedProposals) {
      await tx.match.update({
        where: { id: proposal.matchId },
        data: proposal.side === 'home'
          ? { homeTeamCode: proposal.resolvedTeamCode }
          : { awayTeamCode: proposal.resolvedTeamCode },
      });
    }

    const leagues = await tx.league.findMany({
      where: { competitionType: 'champion_survivor', isActive: true },
      select: { id: true },
    });
    for (const league of leagues) {
      const existingStatuses = await tx.teamTournamentStatus.findMany({
        where: { leagueId: league.id },
        select: { teamCode: true, status: true, eliminatedInMatchId: true, finalRank: true },
      });
      if (existingStatuses.length === 0) continue;

      const statusPlan = buildKnockoutChampionStatusUpdates(
        existingStatuses.map((status) => status.teamCode),
        existingStatuses,
        matches,
      );
      statusConflicts.push(...statusPlan.conflicts.map((conflict) => `${league.id}: ${conflict}`));
      if (statusPlan.conflicts.length > 0) continue;
      const now = new Date();
      for (const update of statusPlan.updates) {
        const isEliminated = update.status === 'eliminated' || update.status === 'runner_up';
        await tx.teamTournamentStatus.update({
          where: { teamCode_leagueId: { teamCode: update.teamCode, leagueId: league.id } },
          data: {
            status: update.status,
            eliminatedAt: isEliminated ? now : null,
            eliminatedInMatchId: isEliminated ? update.eliminatedInMatchId || null : null,
            finalRank: update.finalRank ?? null,
            notes: statusNote(update.status, update.eliminatedInMatchId),
            updatedById: actorUserId || null,
          },
        });
        statusUpdates++;
      }
    }

    if (actorUserId && (changedProposals.length > 0 || statusUpdates > 0)) {
      await tx.adminActionLog.create({
        data: {
          userId: actorUserId,
          action: 'propagate_knockout_and_survivor_statuses',
          target: 'match:knockout',
          details: JSON.stringify({
            propagatedSlots: changedProposals.length,
            statusUpdates,
            proposals: changedProposals,
            conflicts: [...propagation.conflicts, ...statusConflicts],
          }),
        },
      });
    }
  });

  return {
    propagatedSlots: changedProposals.length,
    groupStatusUpdates: groupSync.statusUpdates,
    statusUpdates,
    conflicts: [
      ...propagation.conflicts.map((conflict) => `${conflict.matchId}: ${conflict.reason}`),
      ...statusConflicts,
    ],
    pendingReferences: propagation.pendingReferences,
  };
}

export async function syncMaterializedRoundOf32SurvivorStatuses(
  actorUserId?: string,
): Promise<{ statusUpdates: number; preservedManual: number }> {
  const [r32Matches, groupMatches] = await Promise.all([
    prisma.match.findMany({
      where: { phase: 'r32' },
      select: { homeTeamCode: true, awayTeamCode: true },
    }),
    prisma.match.findMany({
      where: { phase: 'groups' },
    }),
  ]);
  const r32TeamCodes = Array.from(new Set(
    r32Matches.flatMap((match) => [match.homeTeamCode, match.awayTeamCode]),
  ));
  if (r32Matches.length !== 16 || r32TeamCodes.length !== 32) {
    return { statusUpdates: 0, preservedManual: 0 };
  }
  const groupTeamCodes = Array.from(new Set(
    groupMatches.flatMap((match) => [match.homeTeamCode, match.awayTeamCode]),
  ));
  const rosterTeams = filterRealTeams(await prisma.team.findMany({
    where: { code: { in: groupTeamCodes } },
    select: { code: true, name: true },
  }));
  const rosterTeamCodes = rosterTeams.map((team) => team.code);
  if (
    groupMatches.length !== 72
    || groupMatches.some((match) => !isConsistentFinalMatchResult(match))
    || rosterTeamCodes.length !== 48
  ) {
    return { statusUpdates: 0, preservedManual: 0 };
  }

  let statusUpdates = 0;
  let preservedManual = 0;
  await prisma.$transaction(async (tx) => {
    const leagues = await tx.league.findMany({
      where: { competitionType: 'champion_survivor', isActive: true },
      select: { id: true },
    });
    for (const league of leagues) {
      const existingStatuses = await tx.teamTournamentStatus.findMany({
        where: { leagueId: league.id },
        select: { teamCode: true, status: true, eliminatedInMatchId: true, finalRank: true },
      });
      const plan = buildRoundOf32ChampionStatusUpdates(
        rosterTeamCodes,
        existingStatuses,
        r32TeamCodes,
      );
      preservedManual += plan.preservedManual;
      const now = new Date();
      for (const update of plan.updates) {
        await tx.teamTournamentStatus.upsert({
          where: { teamCode_leagueId: { teamCode: update.teamCode, leagueId: league.id } },
          update: {
            status: update.status,
            eliminatedAt: update.status === 'eliminated' ? now : null,
            eliminatedInMatchId: null,
            finalRank: null,
            notes: update.status === 'eliminated'
              ? 'Sin clasificación al r32 materializado.'
              : 'Clasificado al r32 materializado.',
            updatedById: actorUserId || null,
          },
          create: {
            leagueId: league.id,
            teamCode: update.teamCode,
            status: update.status,
            eliminatedAt: update.status === 'eliminated' ? now : null,
            notes: update.status === 'eliminated'
              ? 'Sin clasificación al r32 materializado.'
              : 'Clasificado al r32 materializado.',
            updatedById: actorUserId || null,
          },
        });
        statusUpdates++;
      }
    }
    if (statusUpdates > 0 && actorUserId) {
      await tx.adminActionLog.create({
        data: {
          userId: actorUserId,
          action: 'sync_group_eliminations_from_round_of_32',
          target: 'team_tournament_status:active_champion_survivor_leagues',
          details: JSON.stringify({ statusUpdates, preservedManual, r32TeamCodes, rosterTeamCodes }),
        },
      });
    }
  });
  return { statusUpdates, preservedManual };
}

function statusNote(status: string, matchId?: string | null): string {
  if (status === 'champion') return 'Campeón sincronizado desde el resultado final.';
  if (status === 'runner_up') return 'Subcampeón sincronizado desde el resultado final.';
  if (status === 'eliminated') {
    return matchId
      ? `Eliminado según resultado final de ${matchId}.`
      : 'Eliminado al quedar resuelto el torneo.';
  }
  return 'Activo según resultados eliminatorios sincronizados.';
}
