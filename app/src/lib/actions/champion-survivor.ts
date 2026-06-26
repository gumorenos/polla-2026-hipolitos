'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import {
  assertAdminReason,
  buildChampionSurvivorCsv,
  buildPickDistribution,
  buildSurvivalSummary,
  calculateChampionProbability,
  calculatePrizePool,
  getChampionPickStatus,
  isChampionDeadlinePassed,
  isChampionSurvivorCompetition,
  normalizeTeamStatus,
  simulateChampionOdds,
  sortChampionSurvivorRanking,
  type ChampionRankingEntry,
  type TeamTournamentStatusValue,
} from '../champion-survivor';

type ActionResult<T> = Promise<{ success: true; data: T } | { error: string }>;
type ActionError = { error: string };
type ApprovedSessionUser = {
  id: string;
  status: string;
  isSuperadmin: boolean;
};

function actionError(error: string): ActionError {
  return { error };
}

function isActionError(result: unknown): result is ActionError {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof (result as { error?: unknown }).error === 'string'
  );
}

async function getApprovedSessionUser(): Promise<ActionError | { user: ApprovedSessionUser }> {
  const session = await getCurrentSession();
  if (!session?.user) return actionError('No autorizado.');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, status: true, isSuperadmin: true },
  });

  if (!user || user.status !== 'approved') {
    return actionError('Tu cuenta debe estar aprobada para participar.');
  }

  return { user };
}

async function requireLeagueAdmin(leagueId: string): Promise<ActionError | { user: ApprovedSessionUser }> {
  const result = await getApprovedSessionUser();
  if (isActionError(result)) return result;

  if (result.user.isSuperadmin) return { user: result.user };

  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: result.user.id } },
    select: { role: true },
  });

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return actionError('No tienes permisos para administrar esta polla.');
  }

  return { user: result.user };
}

async function requireChampionSurvivorLeague(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
  });

  if (!league) return actionError('La polla no existe.');
  if (!isChampionSurvivorCompetition(league.competitionType)) {
    return actionError('Esta operación solo aplica a pollas Champion Survivor.');
  }

  return { league } as const;
}

async function latestChampionOddsByTeam(leagueId: string, teamCodes?: string[]) {
  const snapshots = await prisma.championOddsSnapshot.findMany({
    where: {
      leagueId,
      sourceMarket: 'outright_winner',
      ...(teamCodes ? { teamCode: { in: teamCodes } } : {}),
    },
    orderBy: { capturedAt: 'desc' },
  });

  const latest = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    if (!latest.has(snapshot.teamCode)) {
      latest.set(snapshot.teamCode, snapshot);
    }
  }
  return latest;
}

async function buildChampionSurvivorEntries(leagueId: string) {
  const [leagueResult, members, picks, teamStatuses, teams] = await Promise.all([
    prisma.league.findUnique({ where: { id: leagueId } }),
    prisma.leagueMember.findMany({
      where: { leagueId, isParticipant: true, user: { status: 'approved' } },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.championPick.findMany({
      where: { leagueId },
      include: { team: true },
    }),
    prisma.teamTournamentStatus.findMany({
      where: { leagueId },
    }),
    prisma.team.findMany({
      select: { code: true, name: true },
    }),
  ]);

  if (!leagueResult) return { error: 'La polla no existe.' } as const;

  const pickByUser = new Map(picks.map((pick) => [pick.userId, pick]));
  const statusByTeam = new Map(teamStatuses.map((status) => [status.teamCode, status]));
  const prizePool = calculatePrizePool(leagueResult, members.length);
  const oddsByTeam = await latestChampionOddsByTeam(leagueId);

  const entries = members.map((member) => {
    const pick = pickByUser.get(member.userId) || null;
    const teamStatus = pick ? statusByTeam.get(pick.teamCode) : null;
    const status = getChampionPickStatus(pick, teamStatus);
    const probability = pick
      ? calculateChampionProbability(oddsByTeam.get(pick.teamCode), prizePool.amount)
      : calculateChampionProbability(null, prizePool.amount);

    return {
      userId: member.userId,
      user: {
        id: member.user.id,
        name: member.user.name,
        displayName: member.user.displayName,
        username: member.user.username,
        email: member.user.email,
      },
      team: pick?.team
        ? { code: pick.team.code, name: pick.team.name, hue: pick.team.hue }
        : null,
      teamCode: pick?.teamCode || null,
      status,
      teamTournamentStatus: teamStatus ? normalizeTeamStatus(teamStatus.status) : 'unknown',
      eliminatedAt: teamStatus?.eliminatedAt || null,
      submittedAt: pick?.submittedAt || null,
      lockedAt: pick?.lockedAt || null,
      championProbability: probability.impliedProbability,
      championProbabilityAvailable: probability.available,
      expectedValue: probability.expectedValue,
      correctedAt: pick?.correctedAt || null,
      correctedByAdminId: pick?.correctedByAdminId || null,
      lastCorrectionReason: pick?.lastCorrectionReason || null,
      previousTeamCode: pick?.previousTeamCode || null,
      newTeamCode: pick?.newTeamCode || null,
    } satisfies ChampionRankingEntry & {
      user: {
        id: string;
        name: string;
        displayName: string | null;
        username: string | null;
        email: string;
      };
      team: { code: string; name: string; hue: number } | null;
      teamTournamentStatus: TeamTournamentStatusValue;
      championProbabilityAvailable: boolean;
      lockedAt: Date | null;
      correctedAt: Date | null;
      correctedByAdminId: string | null;
      lastCorrectionReason: string | null;
      previousTeamCode: string | null;
      newTeamCode: string | null;
    };
  });

  const sortedEntries = sortChampionSurvivorRanking(entries);
  const distribution = buildPickDistribution(
    picks,
    teamStatuses,
    members.length
  );
  const summary = buildSurvivalSummary(sortedEntries, prizePool);
  const simulation = simulateChampionOdds({
    leagueId,
    oddsSnapshots: Array.from(oddsByTeam.values()),
    teamStatuses,
    teamNames: Object.fromEntries(teams.map((team) => [team.code, team.name])),
    iterations: 10000,
  });

  return {
    league: leagueResult,
    members,
    picks,
    teamStatuses,
    entries: sortedEntries,
    distribution,
    summary,
    simulation,
    prizePool,
  } as const;
}

export async function getChampionSurvivorState(leagueId: string): ActionResult<unknown> {
  const sessionResult = await getApprovedSessionUser();
  if (isActionError(sessionResult)) return sessionResult;

  const leagueResult = await requireChampionSurvivorLeague(leagueId);
  if (isActionError(leagueResult)) return leagueResult;

  const userId = sessionResult.user.id;
  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });

  if (!membership || !membership.isParticipant) {
    return { error: 'Debes estar inscrito como participante para elegir campeón.' };
  }

  const [pick, teams, teamStatuses, approvedMembersCount] = await Promise.all([
    prisma.championPick.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      include: { team: true },
    }),
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.teamTournamentStatus.findMany({ where: { leagueId } }),
    prisma.leagueMember.count({ where: { leagueId, isParticipant: true, user: { status: 'approved' } } }),
  ]);

  const prizePool = calculatePrizePool(leagueResult.league, approvedMembersCount);
  const oddsByTeam = await latestChampionOddsByTeam(
    leagueId,
    pick ? [pick.teamCode] : []
  );
  const teamStatus = pick
    ? teamStatuses.find((status) => status.teamCode === pick.teamCode)
    : null;
  const pickStatus = getChampionPickStatus(pick, teamStatus);
  const championDeadlinePassed = isChampionDeadlinePassed(leagueResult.league.championDeadline);
  const probability = pick && leagueResult.league.showOdds
    ? calculateChampionProbability(oddsByTeam.get(pick.teamCode), prizePool.amount)
    : calculateChampionProbability(null, prizePool.amount);

  return {
    success: true,
    data: {
      league: {
        id: leagueResult.league.id,
        name: leagueResult.league.name,
        slug: leagueResult.league.slug,
        currency: leagueResult.league.currency,
        entryFee: leagueResult.league.entryFee,
        prizePoolOverride: leagueResult.league.prizePoolOverride,
        showOdds: leagueResult.league.showOdds,
        showH2H: leagueResult.league.showH2H,
      },
      competitionType: leagueResult.league.competitionType,
      championDeadline: leagueResult.league.championDeadline,
      championDeadlinePassed,
      currentUserPick: pick,
      canSubmitOrChangePick: !championDeadlinePassed && !pick?.lockedAt,
      availableTeams: teams,
      currentPickStatus: pickStatus,
      championProbability: probability,
      prizePool,
    },
  };
}

export async function submitChampionPick(leagueId: string, teamCode: string): ActionResult<unknown> {
  const sessionResult = await getApprovedSessionUser();
  if (isActionError(sessionResult)) return sessionResult;

  const leagueResult = await requireChampionSurvivorLeague(leagueId);
  if (isActionError(leagueResult)) return leagueResult;

  const normalizedTeamCode = teamCode.trim().toUpperCase();
  if (!normalizedTeamCode) {
    return { error: 'Debes elegir exactamente una selección campeona.' };
  }

  if (isChampionDeadlinePassed(leagueResult.league.championDeadline)) {
    return { error: 'El plazo para elegir campeón ya cerró.' };
  }

  const userId = sessionResult.user.id;
  const [membership, team, existing] = await Promise.all([
    prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    }),
    prisma.team.findUnique({ where: { code: normalizedTeamCode } }),
    prisma.championPick.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    }),
  ]);

  if (!membership) {
    return { error: 'No eres miembro registrado en esta polla.' };
  }
  if (!team) {
    return { error: 'La selección elegida no existe.' };
  }
  if (existing?.lockedAt) {
    return { error: 'Ya tienes una elección bloqueada y no puedes cambiarla sin corrección administrativa.' };
  }

  const now = new Date();
  const pick = await prisma.championPick.upsert({
    where: { leagueId_userId: { leagueId, userId } },
    update: {
      teamCode: normalizedTeamCode,
      submittedAt: now,
      lockedAt: now,
    },
    create: {
      leagueId,
      userId,
      teamCode: normalizedTeamCode,
      submittedAt: now,
      lockedAt: now,
    },
    include: { team: true },
  });

  revalidatePath('/pronosticos');
  revalidatePath('/liga');
  revalidatePath('/competencia');
  revalidatePath('/ranking');

  return {
    success: true,
    data: {
      pick,
      message: `Elegiste a ${pick.team.name} como campeón.`,
    },
  };
}

export async function getChampionSurvivorAdminState(leagueId: string): ActionResult<unknown> {
  const adminResult = await requireLeagueAdmin(leagueId);
  if (isActionError(adminResult)) return adminResult;

  const leagueResult = await requireChampionSurvivorLeague(leagueId);
  if (isActionError(leagueResult)) return leagueResult;

  const state = await buildChampionSurvivorEntries(leagueId);
  if (isActionError(state)) return state;

  return {
    success: true,
    data: {
      league: {
        id: state.league.id,
        name: state.league.name,
        slug: state.league.slug,
        championDeadline: state.league.championDeadline,
        competitionType: state.league.competitionType,
      },
      picks: state.entries,
      summary: state.summary,
      distribution: state.distribution,
      simulation: state.simulation,
      prizePool: state.prizePool,
    },
  };
}

export async function adminChangeChampionPick(
  leagueId: string,
  targetUserId: string,
  teamCode: string,
  reason: string
): ActionResult<unknown> {
  const adminResult = await requireLeagueAdmin(leagueId);
  if (isActionError(adminResult)) return adminResult;

  const leagueResult = await requireChampionSurvivorLeague(leagueId);
  if (isActionError(leagueResult)) return leagueResult;

  let normalizedReason: string;
  try {
    normalizedReason = assertAdminReason(reason);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'El motivo es obligatorio.' };
  }

  const normalizedTeamCode = teamCode.trim().toUpperCase();
  const [targetMembership, targetUser, team, existing] = await Promise.all([
    prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    }),
    prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, status: true },
    }),
    prisma.team.findUnique({ where: { code: normalizedTeamCode } }),
    prisma.championPick.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    }),
  ]);

  if (!targetMembership || !targetMembership.isParticipant || targetUser?.status !== 'approved') {
    return { error: 'El usuario objetivo debe ser participante aprobado de esta polla.' };
  }
  if (!team) return { error: 'La selección elegida no existe.' };

  const now = new Date();
  const pick = await prisma.championPick.upsert({
    where: { leagueId_userId: { leagueId, userId: targetUserId } },
    update: {
      teamCode: normalizedTeamCode,
      lockedAt: now,
      correctedByAdminId: adminResult.user.id,
      correctedAt: now,
      lastCorrectionReason: normalizedReason,
      previousTeamCode: existing?.teamCode || null,
      newTeamCode: normalizedTeamCode,
    },
    create: {
      leagueId,
      userId: targetUserId,
      teamCode: normalizedTeamCode,
      submittedAt: now,
      lockedAt: now,
      correctedByAdminId: adminResult.user.id,
      correctedAt: now,
      lastCorrectionReason: normalizedReason,
      previousTeamCode: null,
      newTeamCode: normalizedTeamCode,
    },
    include: { team: true },
  });

  await prisma.adminActionLog.create({
    data: {
      userId: adminResult.user.id,
      action: 'champion_survivor_pick_changed',
      target: `user:${targetUserId}:league:${leagueId}`,
      details: JSON.stringify({
        previousTeamCode: existing?.teamCode || null,
        newTeamCode: normalizedTeamCode,
        reason: normalizedReason,
      }),
    },
  });

  revalidatePath('/admin');
  revalidatePath('/liga');
  revalidatePath('/competencia');
  revalidatePath('/ranking');

  return { success: true, data: pick };
}

export async function adminResetChampionPick(
  leagueId: string,
  targetUserId: string,
  reason: string
): ActionResult<unknown> {
  const adminResult = await requireLeagueAdmin(leagueId);
  if (isActionError(adminResult)) return adminResult;

  const leagueResult = await requireChampionSurvivorLeague(leagueId);
  if (isActionError(leagueResult)) return leagueResult;

  let normalizedReason: string;
  try {
    normalizedReason = assertAdminReason(reason);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'El motivo es obligatorio.' };
  }

  const existing = await prisma.championPick.findUnique({
    where: { leagueId_userId: { leagueId, userId: targetUserId } },
  });

  if (!existing) {
    return { error: 'El usuario no tiene una elección Champion Survivor registrada.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.adminActionLog.create({
      data: {
        userId: adminResult.user.id,
        action: 'champion_survivor_pick_reset',
        target: `user:${targetUserId}:league:${leagueId}`,
        details: JSON.stringify({
          previousTeamCode: existing.teamCode,
          correctedAt: new Date().toISOString(),
          reason: normalizedReason,
        }),
      },
    });

    await tx.championPick.delete({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });
  });

  revalidatePath('/admin');
  revalidatePath('/liga');
  revalidatePath('/competencia');
  revalidatePath('/ranking');

  return { success: true, data: { reset: true } };
}

export async function adminSetTeamTournamentStatus(
  leagueId: string,
  teamCode: string,
  status: TeamTournamentStatusValue,
  reasonOrNotes?: string,
  options?: { eliminatedInMatchId?: string | null; finalRank?: number | null }
): ActionResult<unknown> {
  const adminResult = await requireLeagueAdmin(leagueId);
  if (isActionError(adminResult)) return adminResult;

  const leagueResult = await requireChampionSurvivorLeague(leagueId);
  if (isActionError(leagueResult)) return leagueResult;

  const normalizedStatus = normalizeTeamStatus(status);
  if (normalizedStatus === 'unknown') {
    return { error: 'Estado de selección inválido.' };
  }

  const notes = (reasonOrNotes || '').trim();
  if ((normalizedStatus === 'eliminated' || normalizedStatus === 'runner_up' || normalizedStatus === 'champion') && !notes) {
    return { error: 'El motivo o notas son obligatorios para este estado.' };
  }

  const normalizedTeamCode = teamCode.trim().toUpperCase();
  const team = await prisma.team.findUnique({ where: { code: normalizedTeamCode } });
  if (!team) return { error: 'La selección no existe.' };

  const now = new Date();
  const updated = await prisma.teamTournamentStatus.upsert({
    where: { teamCode_leagueId: { teamCode: normalizedTeamCode, leagueId } },
    update: {
      status: normalizedStatus,
      eliminatedAt: normalizedStatus === 'eliminated' ? now : null,
      eliminatedInMatchId: normalizedStatus === 'eliminated' ? options?.eliminatedInMatchId || null : null,
      finalRank: options?.finalRank ?? (normalizedStatus === 'champion' ? 1 : null),
      notes: notes || null,
      updatedById: adminResult.user.id,
    },
    create: {
      leagueId,
      teamCode: normalizedTeamCode,
      status: normalizedStatus,
      eliminatedAt: normalizedStatus === 'eliminated' ? now : null,
      eliminatedInMatchId: normalizedStatus === 'eliminated' ? options?.eliminatedInMatchId || null : null,
      finalRank: options?.finalRank ?? (normalizedStatus === 'champion' ? 1 : null),
      notes: notes || null,
      updatedById: adminResult.user.id,
    },
  });

  await prisma.adminActionLog.create({
    data: {
      userId: adminResult.user.id,
      action: 'champion_survivor_team_status_set',
      target: `team:${normalizedTeamCode}:league:${leagueId}`,
      details: JSON.stringify({ status: normalizedStatus, notes, ...options }),
    },
  });

  revalidatePath('/admin');
  revalidatePath('/liga');
  revalidatePath('/competencia');
  revalidatePath('/ranking');

  return { success: true, data: updated };
}

export async function adminCreateChampionOddsSnapshot(
  leagueId: string,
  teamCode: string,
  decimalOdds: number,
  input?: { provider?: string; bookmaker?: string; rawSourceRef?: string | null }
): ActionResult<unknown> {
  const adminResult = await requireLeagueAdmin(leagueId);
  if (isActionError(adminResult)) return adminResult;

  const leagueResult = await requireChampionSurvivorLeague(leagueId);
  if (isActionError(leagueResult)) return leagueResult;

  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    return { error: 'La cuota decimal debe ser mayor a 1.' };
  }

  const normalizedTeamCode = teamCode.trim().toUpperCase();
  const team = await prisma.team.findUnique({ where: { code: normalizedTeamCode } });
  if (!team) return { error: 'La selección no existe.' };

  const snapshot = await prisma.championOddsSnapshot.create({
    data: {
      leagueId,
      teamCode: normalizedTeamCode,
      provider: input?.provider?.trim() || 'manual',
      bookmaker: input?.bookmaker?.trim() || 'admin',
      decimalOdds,
      impliedProbability: 1 / decimalOdds,
      capturedAt: new Date(),
      sourceMarket: 'outright_winner',
      rawSourceRef: input?.rawSourceRef || null,
      userId: adminResult.user.id,
    },
  });

  await prisma.adminActionLog.create({
    data: {
      userId: adminResult.user.id,
      action: 'champion_survivor_odds_snapshot_created',
      target: `team:${normalizedTeamCode}:league:${leagueId}`,
      details: JSON.stringify({
        decimalOdds,
        impliedProbability: snapshot.impliedProbability,
        sourceMarket: snapshot.sourceMarket,
      }),
    },
  });

  revalidatePath('/admin');
  revalidatePath('/liga');
  revalidatePath('/competencia');
  revalidatePath('/ranking');

  return { success: true, data: snapshot };
}

export async function adminListChampionOddsSnapshots(leagueId: string): ActionResult<unknown> {
  const adminResult = await requireLeagueAdmin(leagueId);
  if (isActionError(adminResult)) return adminResult;

  const leagueResult = await requireChampionSurvivorLeague(leagueId);
  if (isActionError(leagueResult)) return leagueResult;

  const teams = await prisma.team.findMany({ orderBy: { name: 'asc' } });
  const latestByTeam = await latestChampionOddsByTeam(leagueId);

  return {
    success: true,
    data: teams.map((team) => ({
      team,
      latestSnapshot: latestByTeam.get(team.code) || null,
    })),
  };
}

export async function adminExportChampionSurvivorCsv(leagueId: string): ActionResult<unknown> {
  const adminResult = await requireLeagueAdmin(leagueId);
  if (isActionError(adminResult)) return adminResult;

  const leagueResult = await requireChampionSurvivorLeague(leagueId);
  if (isActionError(leagueResult)) return leagueResult;

  const state = await buildChampionSurvivorEntries(leagueId);
  if (isActionError(state)) return state;

  const csv = buildChampionSurvivorCsv(
    state.entries.map((entry) => ({
      name: entry.user.displayName || entry.user.name,
      username: entry.user.username,
      email: entry.user.email,
      teamCode: entry.teamCode,
      status: entry.status,
      submittedAt: entry.submittedAt,
      lockedAt: entry.lockedAt,
      probability: entry.championProbability,
      expectedValue: entry.expectedValue,
      correctedAt: entry.correctedAt,
      correctedByAdminId: entry.correctedByAdminId,
      lastCorrectionReason: entry.lastCorrectionReason,
    }))
  );

  return {
    success: true,
    data: {
      filename: `champion-survivor-${state.league.slug}.csv`,
      contentType: 'text/csv; charset=utf-8',
      csv,
    },
  };
}
