export type CompetitionTypeValue = 'full_prediction' | 'champion_survivor';
export type TeamTournamentStatusValue = 'unknown' | 'active' | 'eliminated' | 'runner_up' | 'champion';
export type ChampionPickStatus = 'pending' | 'alive' | 'eliminated' | 'winner';

export type ChampionPickLike = {
  userId: string;
  teamCode: string | null;
  submittedAt?: Date | string | null;
};

export type TeamStatusLike = {
  teamCode: string;
  status?: string | null;
  eliminatedAt?: Date | string | null;
};

export type ChampionOddsLike = {
  teamCode: string;
  decimalOdds: number;
  impliedProbability: number;
  provider?: string | null;
  bookmaker?: string | null;
  capturedAt?: Date | string | null;
};

export type PrizePoolInput = {
  prizePoolOverride?: number | null;
  entryFee?: number | null;
  currency?: string | null;
};

export type ChampionProbabilityResult = {
  available: boolean;
  impliedProbability: number | null;
  decimalOdds: number | null;
  expectedValue: number | null;
  provider: string | null;
  bookmaker: string | null;
  capturedAt: Date | string | null;
  labels: {
    probability: string;
    expectedValue: string;
    unavailable: string;
  };
};

export type ChampionRankingEntry = {
  userId: string;
  status: ChampionPickStatus;
  teamCode: string | null;
  submittedAt?: Date | string | null;
  eliminatedAt?: Date | string | null;
  championProbability?: number | null;
  expectedValue?: number | null;
};

export const CHAMPION_SURVIVOR_LABELS = {
  probability: 'Probabilidad según mercado',
  expectedValue: 'Valor esperado estimado',
  unavailable: 'Probabilidad de campeonar no disponible',
};

export function resolveCompetitionType(
  competitionType?: string | null
): CompetitionTypeValue {
  return competitionType === 'champion_survivor' ? 'champion_survivor' : 'full_prediction';
}

export function isChampionSurvivorCompetition(competitionType?: string | null): boolean {
  return resolveCompetitionType(competitionType) === 'champion_survivor';
}

export function isChampionDeadlinePassed(
  championDeadline?: Date | string | null,
  now: Date = new Date()
): boolean {
  if (!championDeadline) return false;
  const deadline = championDeadline instanceof Date ? championDeadline : new Date(championDeadline);
  return now.getTime() > deadline.getTime();
}

export function assertAdminReason(reason: string | null | undefined): string {
  const normalized = (reason || '').trim();
  if (!normalized) {
    throw new Error('El motivo es obligatorio.');
  }
  return normalized;
}

export function normalizeTeamStatus(status?: string | null): TeamTournamentStatusValue {
  if (status === 'active' || status === 'eliminated' || status === 'runner_up' || status === 'champion') {
    return status;
  }
  return 'unknown';
}

export function getChampionPickStatus(
  pick?: ChampionPickLike | null,
  teamStatus?: TeamStatusLike | null
): ChampionPickStatus {
  if (!pick || !pick.teamCode) return 'pending';

  const status = normalizeTeamStatus(teamStatus?.status);
  if (status === 'champion') return 'winner';
  if (status === 'eliminated') return 'eliminated';
  return 'alive';
}

export function calculatePrizePool(
  league: PrizePoolInput,
  approvedActiveMembersCount: number
) {
  const currency = league.currency || 'PEN';
  if (league.prizePoolOverride !== null && league.prizePoolOverride !== undefined) {
    return {
      amount: league.prizePoolOverride,
      estimated: false,
      currency,
    };
  }

  return {
    amount: approvedActiveMembersCount * (league.entryFee || 0),
    estimated: true,
    currency,
  };
}

export function calculateChampionProbability(
  snapshot?: ChampionOddsLike | null,
  prizePoolAmount?: number | null
): ChampionProbabilityResult {
  if (!snapshot) {
    return {
      available: false,
      impliedProbability: null,
      decimalOdds: null,
      expectedValue: null,
      provider: null,
      bookmaker: null,
      capturedAt: null,
      labels: CHAMPION_SURVIVOR_LABELS,
    };
  }

  const impliedProbability = snapshot.impliedProbability || 1 / snapshot.decimalOdds;

  return {
    available: true,
    impliedProbability,
    decimalOdds: snapshot.decimalOdds,
    expectedValue: prizePoolAmount !== null && prizePoolAmount !== undefined
      ? prizePoolAmount * impliedProbability
      : null,
    provider: snapshot.provider || null,
    bookmaker: snapshot.bookmaker || null,
    capturedAt: snapshot.capturedAt || null,
    labels: CHAMPION_SURVIVOR_LABELS,
  };
}

export function buildPickDistribution(
  picks: ChampionPickLike[],
  teamStatuses: TeamStatusLike[],
  totalParticipants: number
) {
  const statusByTeam = new Map(teamStatuses.map((status) => [status.teamCode, normalizeTeamStatus(status.status)]));
  const counts = new Map<string, number>();

  for (const pick of picks) {
    if (!pick.teamCode) continue;
    counts.set(pick.teamCode, (counts.get(pick.teamCode) || 0) + 1);
  }

  const byTeam = Array.from(counts.entries())
    .map(([teamCode, count]) => ({
      teamCode,
      count,
      percentage: totalParticipants > 0 ? count / totalParticipants : 0,
      status: statusByTeam.get(teamCode) || 'unknown',
    }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.teamCode.localeCompare(b.teamCode);
    });

  return {
    byTeam,
    mostPickedTeam: byTeam[0] || null,
    exclusivePicks: byTeam.filter((item) => item.count === 1),
  };
}

export function buildSurvivalSummary(
  entries: ChampionRankingEntry[],
  prizePool: { amount: number; estimated: boolean; currency: string }
) {
  const aliveEntries = entries.filter((entry) => entry.status === 'alive' || entry.status === 'winner');
  const distinctAliveTeams = Array.from(new Set(aliveEntries.map((entry) => entry.teamCode).filter(Boolean)));
  const probabilityByTeam = new Map<string, number>();
  let hasMissingProbability = false;

  for (const teamCode of distinctAliveTeams) {
    const entry = aliveEntries.find((item) => item.teamCode === teamCode);
    if (!entry || entry.championProbability === null || entry.championProbability === undefined) {
      hasMissingProbability = true;
      break;
    }
    probabilityByTeam.set(teamCode as string, entry.championProbability);
  }

  return {
    totalParticipants: entries.length,
    alive: entries.filter((entry) => entry.status === 'alive').length,
    eliminated: entries.filter((entry) => entry.status === 'eliminated').length,
    pending: entries.filter((entry) => entry.status === 'pending').length,
    winners: entries.filter((entry) => entry.status === 'winner').length,
    prizePool,
    combinedAliveProbability: !hasMissingProbability
      ? Array.from(probabilityByTeam.values()).reduce((sum, value) => sum + value, 0)
      : null,
    combinedAliveProbabilityAvailable: !hasMissingProbability,
  };
}

export function sortChampionSurvivorRanking<T extends ChampionRankingEntry>(entries: T[]): T[] {
  const statusWeight: Record<ChampionPickStatus, number> = {
    winner: 0,
    alive: 1,
    eliminated: 2,
    pending: 3,
  };

  return [...entries].sort((a, b) => {
    if (statusWeight[a.status] !== statusWeight[b.status]) {
      return statusWeight[a.status] - statusWeight[b.status];
    }

    if (a.status === 'alive' || a.status === 'winner') {
      const aProb = a.championProbability;
      const bProb = b.championProbability;
      if (aProb !== null && aProb !== undefined && bProb !== null && bProb !== undefined && aProb !== bProb) {
        return bProb - aProb;
      }
      if ((aProb !== null && aProb !== undefined) !== (bProb !== null && bProb !== undefined)) {
        return aProb !== null && aProb !== undefined ? -1 : 1;
      }

      const aExpected = a.expectedValue;
      const bExpected = b.expectedValue;
      if (aExpected !== null && aExpected !== undefined && bExpected !== null && bExpected !== undefined && aExpected !== bExpected) {
        return bExpected - aExpected;
      }
      if ((aExpected !== null && aExpected !== undefined) !== (bExpected !== null && bExpected !== undefined)) {
        return aExpected !== null && aExpected !== undefined ? -1 : 1;
      }

      return compareNullableDates(a.submittedAt, b.submittedAt, 'asc');
    }

    if (a.status === 'eliminated') {
      return compareNullableDates(a.eliminatedAt, b.eliminatedAt, 'asc');
    }

    return compareNullableDates(a.submittedAt, b.submittedAt, 'asc');
  });
}

function compareNullableDates(
  left?: Date | string | null,
  right?: Date | string | null,
  direction: 'asc' | 'desc' = 'asc'
) {
  const leftTime = left ? new Date(left).getTime() : Infinity;
  const rightTime = right ? new Date(right).getTime() : Infinity;
  if (leftTime === rightTime) return 0;
  return direction === 'asc' ? leftTime - rightTime : rightTime - leftTime;
}

export function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = value instanceof Date ? value.toISOString() : String(value);
  if (!/[",\r\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

export function buildChampionSurvivorCsv(rows: Array<Record<string, unknown>>): string {
  const headers = [
    'name',
    'username',
    'email',
    'teamCode',
    'status',
    'submittedAt',
    'lockedAt',
    'probability',
    'expectedValue',
    'correctedAt',
    'correctedByAdminId',
    'lastCorrectionReason',
  ];

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(',')),
  ];

  return `${lines.join('\n')}\n`;
}
