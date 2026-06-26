export type QualificationStatus =
  | 'group_winner'
  | 'group_runner_up'
  | 'third_place_qualified'
  | 'third_place_pending'
  | 'eliminated'
  | 'pending';

export type SuggestedTeamTournamentStatus = 'active' | 'eliminated' | 'pending';

export type QualificationTeamLike = {
  code: string;
  name: string;
  fairPlayScore?: number | null;
  fifaRanking?: number | null;
};

export type QualificationMatchLike = {
  id: string;
  phase: string;
  group: string | null;
  homeTeamCode: string;
  awayTeamCode: string;
  homeScore: number | null;
  awayScore: number | null;
  status?: string | null;
  resultStatus?: string | null;
};

export type GroupStandingEntry = {
  teamCode: string;
  teamName: string;
  group: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  fairPlayScore: number | null;
  fifaRanking: number | null;
  rank: number;
  status: QualificationStatus;
  unresolvedTiebreaker: boolean;
  unresolvedReason: string | null;
};

export type GroupStanding = {
  group: string;
  complete: boolean;
  playedMatches: number;
  totalMatches: number;
  entries: GroupStandingEntry[];
  unresolvedTies: string[];
};

export type ThirdPlaceEntry = GroupStandingEntry & {
  groupRank: number;
};

export type WorldCupQualification = {
  groups: GroupStanding[];
  thirdPlacedTeams: ThirdPlaceEntry[];
  qualifiedTeamCodes: string[];
  eliminatedTeamCodes: string[];
  statusByTeam: Record<string, QualificationStatus>;
  teamTournamentStatusSuggestions: Record<string, SuggestedTeamTournamentStatus>;
  unresolvedTies: string[];
};

type TieCriterion =
  | 'points'
  | 'headToHeadPoints'
  | 'headToHeadGoalDifference'
  | 'headToHeadGoalsFor'
  | 'goalDifference'
  | 'goalsFor'
  | 'fairPlayScore'
  | 'fifaRanking';

type TieBreakContext = {
  matches: QualificationMatchLike[];
};

const UNRESOLVED_REASON = 'Desempate pendiente por criterio FIFA no disponible.';

export function calculateWorldCupQualification(
  matches: QualificationMatchLike[],
  teams: QualificationTeamLike[]
): WorldCupQualification {
  const groups = calculateGroupStandings(matches, teams);
  const allThirdPlaceComparisonsAvailable = groups.length === 12 && groups.every((group) => group.complete);
  const thirdPlacedTeams = rankThirdPlacedTeams(groups);
  const statusByTeam: Record<string, QualificationStatus> = {};
  const qualifiedTeamCodes: string[] = [];
  const eliminatedTeamCodes: string[] = [];
  const unresolvedTies = groups.flatMap((group) => group.unresolvedTies);

  for (const group of groups) {
    for (const entry of group.entries) {
      statusByTeam[entry.teamCode] = entry.status;
      if (entry.status === 'group_winner' || entry.status === 'group_runner_up') {
        qualifiedTeamCodes.push(entry.teamCode);
      } else if (entry.status === 'eliminated') {
        eliminatedTeamCodes.push(entry.teamCode);
      }
    }
  }

  if (allThirdPlaceComparisonsAvailable) {
    const thirdPlaceBoundaryUnresolved = isThirdPlaceBoundaryUnresolved(thirdPlacedTeams);
    for (const [index, entry] of thirdPlacedTeams.entries()) {
      if (thirdPlaceBoundaryUnresolved && isNearThirdPlaceCutoff(index)) {
        entry.status = 'third_place_pending';
      } else if (index < 8) {
        entry.status = 'third_place_qualified';
        qualifiedTeamCodes.push(entry.teamCode);
      } else {
        entry.status = 'eliminated';
        eliminatedTeamCodes.push(entry.teamCode);
      }
      statusByTeam[entry.teamCode] = entry.status;
      setGroupEntryStatus(groups, entry.teamCode, entry.status);
    }

    for (const group of groups) {
      for (const entry of group.entries) {
        if (entry.rank >= 4 && !entry.unresolvedTiebreaker) {
          entry.status = 'eliminated';
          statusByTeam[entry.teamCode] = 'eliminated';
          eliminatedTeamCodes.push(entry.teamCode);
        }
      }
    }
  }

  return {
    groups,
    thirdPlacedTeams,
    qualifiedTeamCodes: unique(qualifiedTeamCodes),
    eliminatedTeamCodes: unique(eliminatedTeamCodes),
    statusByTeam,
    teamTournamentStatusSuggestions: suggestTeamTournamentStatuses(statusByTeam),
    unresolvedTies,
  };
}

export function calculateGroupStandings(
  matches: QualificationMatchLike[],
  teams: QualificationTeamLike[]
): GroupStanding[] {
  const groupMatches = matches.filter((match) => match.phase === 'groups' && Boolean(match.group));
  const groups = unique(groupMatches.map((match) => match.group as string)).sort();
  const teamByCode = new Map(teams.map((team) => [team.code, team]));

  return groups.map((group) => {
    const matchesForGroup = groupMatches.filter((match) => match.group === group);
    const teamCodes = unique(matchesForGroup.flatMap((match) => [match.homeTeamCode, match.awayTeamCode]));
    const entries = teamCodes.map((teamCode) => createStandingEntry(group, teamCode, teamByCode.get(teamCode)));
    const entriesByTeam = new Map(entries.map((entry) => [entry.teamCode, entry]));

    for (const match of matchesForGroup) {
      if (!isFinishedGroupMatch(match)) continue;

      const home = entriesByTeam.get(match.homeTeamCode);
      const away = entriesByTeam.get(match.awayTeamCode);
      if (!home || !away || match.homeScore === null || match.awayScore === null) continue;

      applyResult(home, away, match.homeScore, match.awayScore);
    }

    const playedMatches = matchesForGroup.filter(isFinishedGroupMatch).length;
    const complete = playedMatches === matchesForGroup.length && matchesForGroup.length >= 6;
    const unresolvedTies: string[] = [];
    const sortedEntries = rankGroupTeams(entries, matchesForGroup, unresolvedTies);

    assignGroupStatuses(sortedEntries, complete);

    return {
      group,
      complete,
      playedMatches,
      totalMatches: matchesForGroup.length,
      entries: sortedEntries,
      unresolvedTies,
    };
  });
}

export function rankGroupTeams(
  entries: GroupStandingEntry[],
  matches: QualificationMatchLike[],
  unresolvedTies: string[] = []
): GroupStandingEntry[] {
  const context: TieBreakContext = {
    matches: matches.filter(isFinishedGroupMatch),
  };
  const ranked = rankByCriteria(
    entries,
    [
      'points',
      'headToHeadPoints',
      'headToHeadGoalDifference',
      'headToHeadGoalsFor',
      'goalDifference',
      'goalsFor',
      'fairPlayScore',
      'fifaRanking',
    ],
    context,
    unresolvedTies
  );

  return assignRanks(ranked);
}

export function rankThirdPlacedTeams(groups: GroupStanding[]): ThirdPlaceEntry[] {
  const thirdPlaces = groups
    .map((group) => group.entries.find((entry) => entry.rank === 3))
    .filter((entry): entry is GroupStandingEntry => Boolean(entry))
    .map((entry) => ({ ...entry, groupRank: 3 }));
  const unresolvedTies: string[] = [];

  return assignRanks(
    rankByCriteria(
      thirdPlaces,
      ['points', 'goalDifference', 'goalsFor', 'fairPlayScore', 'fifaRanking'],
      { matches: [] },
      unresolvedTies
    )
  );
}

export function calculateQualifiedTeams(groupStandings: GroupStanding[]): string[] {
  const topTwo = groupStandings.flatMap((group) =>
    group.entries
      .filter((entry) => entry.status === 'group_winner' || entry.status === 'group_runner_up')
      .map((entry) => entry.teamCode)
  );
  const canResolveThirdPlaces = groupStandings.length === 12 && groupStandings.every((group) => group.complete);
  const thirds = canResolveThirdPlaces
    ? rankThirdPlacedTeams(groupStandings)
      .filter((_, index) => index < 8)
      .map((entry) => entry.teamCode)
    : [];

  return unique([...topTwo, ...thirds]);
}

export function suggestTeamTournamentStatuses(
  statusByTeam: Record<string, QualificationStatus>
): Record<string, SuggestedTeamTournamentStatus> {
  return Object.fromEntries(
    Object.entries(statusByTeam).map(([teamCode, status]) => {
      if (status === 'eliminated') return [teamCode, 'eliminated'];
      if (
        status === 'group_winner' ||
        status === 'group_runner_up' ||
        status === 'third_place_qualified'
      ) {
        return [teamCode, 'active'];
      }
      return [teamCode, 'pending'];
    })
  );
}

function createStandingEntry(
  group: string,
  teamCode: string,
  team?: QualificationTeamLike
): GroupStandingEntry {
  return {
    teamCode,
    teamName: team?.name || teamCode,
    group,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    fairPlayScore: team?.fairPlayScore ?? null,
    fifaRanking: team?.fifaRanking ?? null,
    rank: 0,
    status: 'pending',
    unresolvedTiebreaker: false,
    unresolvedReason: null,
  };
}

function applyResult(home: GroupStandingEntry, away: GroupStandingEntry, homeScore: number, awayScore: number) {
  home.played += 1;
  away.played += 1;
  home.goalsFor += homeScore;
  home.goalsAgainst += awayScore;
  away.goalsFor += awayScore;
  away.goalsAgainst += homeScore;
  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;

  if (homeScore > awayScore) {
    home.wins += 1;
    away.losses += 1;
    home.points += 3;
  } else if (awayScore > homeScore) {
    away.wins += 1;
    home.losses += 1;
    away.points += 3;
  } else {
    home.draws += 1;
    away.draws += 1;
    home.points += 1;
    away.points += 1;
  }
}

function rankByCriteria<T extends GroupStandingEntry>(
  entries: T[],
  criteria: TieCriterion[],
  context: TieBreakContext,
  unresolvedTies: string[]
): T[] {
  if (entries.length <= 1 || criteria.length === 0) return entries;

  const [criterion, ...remainingCriteria] = criteria;
  const valueByTeam = new Map(entries.map((entry) => [entry.teamCode, getCriterionValue(entry, criterion, entries, context)]));
  const hasMissingRequiredValue = entries.some((entry) => valueByTeam.get(entry.teamCode) === null);

  if (hasMissingRequiredValue && (criterion === 'fairPlayScore' || criterion === 'fifaRanking')) {
    markUnresolved(entries, unresolvedTies);
    return entries;
  }

  const groups = groupByValue(entries, (entry) => valueByTeam.get(entry.teamCode));
  const orderedKeys = Array.from(groups.keys()).sort((left, right) => compareCriterionValues(left, right, criterion));
  const ranked: T[] = [];

  for (const key of orderedKeys) {
    const tied = groups.get(key) || [];
    if (tied.length === 1) {
      ranked.push(tied[0]);
    } else {
      ranked.push(...rankByCriteria(tied, remainingCriteria, context, unresolvedTies));
    }
  }

  return ranked;
}

function getCriterionValue(
  entry: GroupStandingEntry,
  criterion: TieCriterion,
  tiedEntries: GroupStandingEntry[],
  context: TieBreakContext
): number | null {
  switch (criterion) {
    case 'points':
      return entry.points;
    case 'headToHeadPoints':
      return calculateHeadToHead(entry.teamCode, tiedEntries, context).points;
    case 'headToHeadGoalDifference':
      return calculateHeadToHead(entry.teamCode, tiedEntries, context).goalDifference;
    case 'headToHeadGoalsFor':
      return calculateHeadToHead(entry.teamCode, tiedEntries, context).goalsFor;
    case 'goalDifference':
      return entry.goalDifference;
    case 'goalsFor':
      return entry.goalsFor;
    case 'fairPlayScore':
      return entry.fairPlayScore;
    case 'fifaRanking':
      return entry.fifaRanking;
  }
}

function calculateHeadToHead(
  teamCode: string,
  tiedEntries: GroupStandingEntry[],
  context: TieBreakContext
) {
  const tiedCodes = new Set(tiedEntries.map((entry) => entry.teamCode));
  const stats = { points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 };

  for (const match of context.matches) {
    if (
      match.homeScore === null ||
      match.awayScore === null ||
      !tiedCodes.has(match.homeTeamCode) ||
      !tiedCodes.has(match.awayTeamCode) ||
      (match.homeTeamCode !== teamCode && match.awayTeamCode !== teamCode)
    ) {
      continue;
    }

    const isHome = match.homeTeamCode === teamCode;
    const goalsFor = isHome ? match.homeScore : match.awayScore;
    const goalsAgainst = isHome ? match.awayScore : match.homeScore;
    stats.goalsFor += goalsFor;
    stats.goalsAgainst += goalsAgainst;
    if (goalsFor > goalsAgainst) stats.points += 3;
    else if (goalsFor === goalsAgainst) stats.points += 1;
  }

  stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
  return stats;
}

function groupByValue<T>(entries: T[], getValue: (entry: T) => number | null | undefined): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const value = getValue(entry);
    const key = value === null || value === undefined ? 'missing' : String(value);
    groups.set(key, [...(groups.get(key) || []), entry]);
  }
  return groups;
}

function compareCriterionValues(left: string, right: string, criterion: TieCriterion): number {
  if (left === 'missing' && right === 'missing') return 0;
  if (left === 'missing') return 1;
  if (right === 'missing') return -1;

  const leftValue = Number(left);
  const rightValue = Number(right);
  if (criterion === 'fairPlayScore' || criterion === 'fifaRanking') {
    return leftValue - rightValue;
  }
  return rightValue - leftValue;
}

function assignRanks<T extends GroupStandingEntry>(entries: T[]): T[] {
  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

function assignGroupStatuses(entries: GroupStandingEntry[], complete: boolean) {
  for (const entry of entries) {
    if (!complete || entry.unresolvedTiebreaker) {
      entry.status = 'pending';
      continue;
    }
    if (entry.rank === 1) entry.status = 'group_winner';
    else if (entry.rank === 2) entry.status = 'group_runner_up';
    else if (entry.rank === 3) entry.status = 'third_place_pending';
    else entry.status = 'eliminated';
  }
}

function markUnresolved(entries: GroupStandingEntry[], unresolvedTies: string[]) {
  const teams = entries.map((entry) => entry.teamCode).sort();
  const message = `${UNRESOLVED_REASON} (${teams.join(', ')})`;
  if (!unresolvedTies.includes(message)) unresolvedTies.push(message);

  for (const entry of entries) {
    entry.unresolvedTiebreaker = true;
    entry.unresolvedReason = UNRESOLVED_REASON;
  }
}

function isFinishedGroupMatch(match: QualificationMatchLike): boolean {
  return (
    match.phase === 'groups' &&
    Boolean(match.group) &&
    match.homeScore !== null &&
    match.awayScore !== null &&
    (match.resultStatus === 'final' || match.status === 'result')
  );
}

function isThirdPlaceBoundaryUnresolved(entries: ThirdPlaceEntry[]): boolean {
  const eighth = entries[7];
  const ninth = entries[8];
  if (!eighth || !ninth) return false;
  return eighth.unresolvedTiebreaker || ninth.unresolvedTiebreaker || compareThirdPlaceCore(eighth, ninth) === 0;
}

function compareThirdPlaceCore(left: ThirdPlaceEntry, right: ThirdPlaceEntry): number {
  if (left.points !== right.points) return right.points - left.points;
  if (left.goalDifference !== right.goalDifference) return right.goalDifference - left.goalDifference;
  return right.goalsFor - left.goalsFor;
}

function isNearThirdPlaceCutoff(index: number): boolean {
  return index === 7 || index === 8;
}

function setGroupEntryStatus(groups: GroupStanding[], teamCode: string, status: QualificationStatus) {
  for (const group of groups) {
    const entry = group.entries.find((item) => item.teamCode === teamCode);
    if (entry) {
      entry.status = status;
      return;
    }
  }
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
