export type PickType = 'real_team' | 'group_winner' | 'match_winner' | 'placeholder' | 'unknown';

export type TeamIdentity = {
  code: string;
  name: string;
};

export type TeamMarketAnalysisRow = {
  teamCode: string;
  teamName: string;
  status: string;
  pickCount: number;
  pickPercentage: number;
  classificationLabel: string;
  classificationKey: string;
  marketProbability: number | null;
  decimalOdds: number | null;
  simulatedProbability: number | null;
  expectedValue: number | null;
  individualExpectedValue: number | null;
};

export type TeamMarketFilter =
  | 'all'
  | 'alive'
  | 'eliminated'
  | 'with_picks'
  | 'without_picks'
  | 'with_market_odds'
  | 'without_market_odds'
  | 'positive_ev';

export type TeamMarketSortKey =
  | 'teamName'
  | 'pickCount'
  | 'pickPercentage'
  | 'decimalOdds'
  | 'marketProbability'
  | 'simulatedProbability'
  | 'expectedValue'
  | 'individualExpectedValue';

export type SortDirection = 'asc' | 'desc';

export function derivePublicTournamentStatus(
  storedStatus: string | null | undefined,
  qualificationStatus: string | null | undefined,
): 'unknown' | 'active' | 'eliminated' | 'runner_up' | 'champion' {
  if (storedStatus === 'champion') return 'champion';
  if (storedStatus === 'runner_up') return 'runner_up';
  if (storedStatus === 'eliminated') return 'eliminated';
  if (storedStatus === 'active') return 'active';
  if (qualificationStatus === 'eliminated') return 'eliminated';
  if (
    qualificationStatus === 'group_winner'
    || qualificationStatus === 'group_runner_up'
    || qualificationStatus === 'third_place_qualified'
  ) {
    return 'active';
  }
  return 'unknown';
}

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function classifyTeamPickType(team: TeamIdentity): PickType {
  const code = team.code.trim().toUpperCase();
  const name = normalizeLabel(team.name);

  if (/^(W|L|RU)\d+$/.test(code)) return 'match_winner';
  if (
    /^(ganador|perdedor)( del)? partido\b/.test(name)
    || /^(winner|loser)( of)? match\b/.test(name)
    || /^match \d+ (winner|loser)\b/.test(name)
  ) {
    return 'match_winner';
  }

  if (/^[123][A-L]+$/.test(code)) return 'group_winner';
  if (
    /^(ganador|segundo|tercero)( del)? grupo\b/.test(name)
    || /^(winner|runner up|third)( of)? group\b/.test(name)
    || /^group [a-l] (winner|runner up|third)\b/.test(name)
  ) {
    return 'group_winner';
  }

  if (['TBD', 'TBA', 'UNK'].includes(code) || /^(por definir|to be determined|placeholder)\b/.test(name)) {
    return 'placeholder';
  }

  return /^[A-Z]{3}$/.test(code) ? 'real_team' : 'unknown';
}

export function filterRealTeams<T extends TeamIdentity>(teams: T[]): T[] {
  return teams.filter((team) => classifyTeamPickType(team) === 'real_team');
}

export function collectRealTeamCodesFromSources(
  teams: TeamIdentity[],
  sourceGroups: ReadonlyArray<Iterable<string>>,
): Set<string> {
  const realTeamCodes = new Set(
    filterRealTeams(teams).map((team) => team.code.trim().toUpperCase()),
  );
  const collected = new Set<string>();

  for (const source of sourceGroups) {
    for (const teamCode of source) {
      const normalizedTeamCode = teamCode.trim().toUpperCase();
      if (realTeamCodes.has(normalizedTeamCode)) {
        collected.add(normalizedTeamCode);
      }
    }
  }

  return collected;
}

export function filterTeamMarketRows(
  rows: TeamMarketAnalysisRow[],
  filter: TeamMarketFilter,
): TeamMarketAnalysisRow[] {
  switch (filter) {
    case 'alive':
      return rows.filter((row) => row.status === 'active' || row.status === 'champion');
    case 'eliminated':
      return rows.filter((row) => row.status === 'eliminated' || row.status === 'runner_up');
    case 'with_picks':
      return rows.filter((row) => row.pickCount > 0);
    case 'without_picks':
      return rows.filter((row) => row.pickCount === 0);
    case 'with_market_odds':
      return rows.filter((row) => row.decimalOdds !== null);
    case 'without_market_odds':
      return rows.filter((row) => row.decimalOdds === null);
    case 'positive_ev':
      return rows.filter((row) => row.expectedValue !== null && row.expectedValue > 0);
    default:
      return [...rows];
  }
}

function compareNullableValues(
  left: string | number | null,
  right: string | number | null,
  direction: SortDirection,
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  const comparison = typeof left === 'string' && typeof right === 'string'
    ? left.localeCompare(right, 'es', { sensitivity: 'base' })
    : Number(left) - Number(right);
  return direction === 'asc' ? comparison : -comparison;
}

export function sortTeamMarketRows(
  rows: TeamMarketAnalysisRow[],
  sortKey: TeamMarketSortKey,
  direction: SortDirection,
): TeamMarketAnalysisRow[] {
  return [...rows].sort((left, right) => {
    const primary = compareNullableValues(left[sortKey], right[sortKey], direction);
    if (primary !== 0) return primary;

    if (sortKey !== 'pickCount' && left.pickCount !== right.pickCount) {
      return right.pickCount - left.pickCount;
    }
    if (
      sortKey !== 'marketProbability'
      && left.marketProbability !== right.marketProbability
    ) {
      return compareNullableValues(left.marketProbability, right.marketProbability, 'desc');
    }
    return left.teamName.localeCompare(right.teamName, 'es', { sensitivity: 'base' });
  });
}
