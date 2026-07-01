export type ExistingChampionTeamStatus = {
  teamCode: string;
  status: string;
  eliminatedInMatchId?: string | null;
  finalRank?: number | null;
};

export type ChampionStatusUpdate = {
  teamCode: string;
  status: 'active' | 'eliminated' | 'runner_up' | 'champion';
  eliminatedInMatchId?: string | null;
  finalRank?: number | null;
};

export type KnockoutStatusSyncPlan = {
  updates: ChampionStatusUpdate[];
  conflicts: string[];
  resolvedMatches: string[];
};

type FinalKnockoutMatch = {
  id: string;
  phase: string;
  homeTeamCode: string;
  awayTeamCode: string;
  homeScore: number | null;
  awayScore: number | null;
  resultStatus?: string | null;
  winnerTeamCode?: string | null;
};

const MANUAL_TERMINAL_STATUSES = new Set(['eliminated', 'runner_up', 'champion']);

export function buildChampionStatusInitializationPlan(
  eligibleTeamCodes: Iterable<string>,
  outrightTeamCodes: Iterable<string>,
  existingStatuses: ExistingChampionTeamStatus[],
) {
  const eligible = new Set(Array.from(eligibleTeamCodes, normalizeCode));
  const outright = new Set(Array.from(outrightTeamCodes, normalizeCode));
  const existing = new Set(existingStatuses.map((status) => normalizeCode(status.teamCode)));
  const targetTeamCodes = Array.from(outright).filter((teamCode) => eligible.has(teamCode)).sort();
  const createTeamCodes = targetTeamCodes.filter((teamCode) => !existing.has(teamCode));

  return {
    targetTeamCodes,
    createTeamCodes,
    unchanged: targetTeamCodes.length - createTeamCodes.length,
    skippedIneligible: Array.from(outright).filter((teamCode) => !eligible.has(teamCode)).length,
  };
}

export function buildGroupStageChampionStatusUpdates(
  targetTeamCodes: Iterable<string>,
  existingStatuses: ExistingChampionTeamStatus[],
  qualificationSuggestions: Record<string, string>,
): { updates: ChampionStatusUpdate[]; preservedManual: number } {
  const existingByTeam = new Map(
    existingStatuses.map((status) => [normalizeCode(status.teamCode), status.status]),
  );
  const updates: ChampionStatusUpdate[] = [];
  let preservedManual = 0;

  for (const rawTeamCode of targetTeamCodes) {
    const teamCode = normalizeCode(rawTeamCode);
    const currentStatus = existingByTeam.get(teamCode);
    if (currentStatus && MANUAL_TERMINAL_STATUSES.has(currentStatus)) {
      preservedManual++;
      continue;
    }
    const suggested = qualificationSuggestions[teamCode];
    const nextStatus = suggested === 'eliminated' ? 'eliminated' : 'active';
    if (currentStatus !== nextStatus) {
      updates.push({ teamCode, status: nextStatus });
    }
  }

  return { updates, preservedManual };
}

export function buildRoundOf32ChampionStatusUpdates(
  targetTeamCodes: Iterable<string>,
  existingStatuses: ExistingChampionTeamStatus[],
  roundOf32TeamCodes: Iterable<string>,
): { updates: ChampionStatusUpdate[]; preservedManual: number } {
  const qualified = new Set(Array.from(roundOf32TeamCodes, normalizeCode));
  const suggestions = Object.fromEntries(
    Array.from(targetTeamCodes, normalizeCode).map((teamCode) => [
      teamCode,
      qualified.has(teamCode) ? 'active' : 'eliminated',
    ]),
  );
  return buildGroupStageChampionStatusUpdates(targetTeamCodes, existingStatuses, suggestions);
}

export function buildKnockoutChampionStatusUpdates(
  targetTeamCodes: Iterable<string>,
  existingStatuses: ExistingChampionTeamStatus[],
  matches: FinalKnockoutMatch[],
): KnockoutStatusSyncPlan {
  const targets = new Set(Array.from(targetTeamCodes, normalizeCode));
  const existingByTeam = new Map(
    existingStatuses.map((status) => [normalizeCode(status.teamCode), status.status]),
  );
  const desired = new Map<string, ChampionStatusUpdate>();
  const conflicts: string[] = [];
  const resolvedMatches: string[] = [];
  const phaseOrder: Record<string, number> = { r32: 1, r16: 2, quarters: 3, semis: 4, final: 5 };
  const finalMatches = matches
     .filter((match) => match.id !== '3rd' && phaseOrder[match.phase])
     .sort((left, right) => phaseOrder[left.phase] - phaseOrder[right.phase]);

  for (const match of finalMatches) {
    const outcome = getOutcome(match);
    if (!outcome) continue;
    resolvedMatches.push(match.id);
    if (targets.has(outcome.winnerTeamCode)) {
      desired.set(outcome.winnerTeamCode, { teamCode: outcome.winnerTeamCode, status: 'active' });
    }
    if (targets.has(outcome.loserTeamCode)) {
      desired.set(outcome.loserTeamCode, {
        teamCode: outcome.loserTeamCode,
        status: 'eliminated',
        eliminatedInMatchId: match.id,
      });
    }

    if (match.phase === 'final') {
      for (const teamCode of targets) {
        // If the team is already marked as eliminated (or runner_up or champion), do not overwrite it!
        const existingUpdate = desired.get(teamCode);
        if (existingUpdate && (existingUpdate.status === 'eliminated' || existingUpdate.status === 'runner_up' || existingUpdate.status === 'champion')) {
          continue;
        }
        const dbStatus = existingByTeam.get(teamCode);
        if (dbStatus && (dbStatus === 'eliminated' || dbStatus === 'runner_up' || dbStatus === 'champion')) {
          continue;
        }
        desired.set(teamCode, {
          teamCode,
          status: 'eliminated',
          eliminatedInMatchId: teamCode === outcome.loserTeamCode ? match.id : null,
        });
      }
      desired.set(outcome.winnerTeamCode, {
        teamCode: outcome.winnerTeamCode,
        status: 'champion',
        finalRank: 1,
      });
      desired.set(outcome.loserTeamCode, {
        teamCode: outcome.loserTeamCode,
        status: 'runner_up',
        eliminatedInMatchId: match.id,
        finalRank: 2,
      });
    }
  }

  const updates: ChampionStatusUpdate[] = [];
  for (const update of desired.values()) {
    const currentObj = existingStatuses.find(s => normalizeCode(s.teamCode) === update.teamCode);
    const currentStatus = currentObj?.status;

    const statusChanged = currentStatus !== update.status;
    const matchIdChanged = currentObj && ('eliminatedInMatchId' in currentObj) && currentObj.eliminatedInMatchId !== undefined
      ? (currentObj.eliminatedInMatchId ?? null) !== (update.eliminatedInMatchId ?? null)
      : false;
    const rankChanged = currentObj && ('finalRank' in currentObj) && currentObj.finalRank !== undefined
      ? (currentObj.finalRank ?? null) !== (update.finalRank ?? null)
      : false;

    if (!statusChanged && !matchIdChanged && !rankChanged) continue;

    if (currentStatus === 'champion' && update.status !== 'champion') {
      conflicts.push(`${update.teamCode} figura como campeón manual y no se sobrescribió.`);
      continue;
    }
    if (currentStatus === 'runner_up' && update.status !== 'runner_up' && update.status !== 'champion') {
      conflicts.push(`${update.teamCode} figura como subcampeón manual y no se sobrescribió.`);
      continue;
    }
    if (currentStatus === 'eliminated' && update.status === 'active') {
      conflicts.push(`${update.teamCode} figura eliminado y no se reactivó automáticamente.`);
      continue;
    }
    updates.push(update);
  }

  return { updates, conflicts, resolvedMatches };
}

function getOutcome(match: FinalKnockoutMatch): { winnerTeamCode: string; loserTeamCode: string } | null {
  if (
    match.resultStatus !== 'final'
    || match.homeScore === null
    || match.awayScore === null
  ) {
    return null;
  }
  const winnerTeamCode = normalizeCode(match.winnerTeamCode || (
    match.homeScore > match.awayScore
      ? match.homeTeamCode
      : match.awayScore > match.homeScore
        ? match.awayTeamCode
        : ''
  ));
  if (winnerTeamCode !== normalizeCode(match.homeTeamCode) && winnerTeamCode !== normalizeCode(match.awayTeamCode)) {
    return null;
  }
  return {
    winnerTeamCode,
    loserTeamCode: winnerTeamCode === normalizeCode(match.homeTeamCode)
      ? normalizeCode(match.awayTeamCode)
      : normalizeCode(match.homeTeamCode),
  };
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}
