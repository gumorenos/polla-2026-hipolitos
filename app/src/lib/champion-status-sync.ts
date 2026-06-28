export type ExistingChampionTeamStatus = {
  teamCode: string;
  status: string;
};

export type ChampionStatusUpdate = {
  teamCode: string;
  status: 'active' | 'eliminated';
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

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}
