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
  teamName?: string | null;
  decimalOdds: number;
  impliedProbability: number;
  provider?: string | null;
  bookmaker?: string | null;
  capturedAt?: Date | string | null;
  sourceMarket?: string | null;
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

export type ChampionPickClassificationKey =
  | 'favorite_popular'
  | 'attractive_differential'
  | 'longshot'
  | 'high_risk'
  | 'saturated'
  | 'popularity_only'
  | 'unclassified';

export type ChampionPickClassification = {
  key: ChampionPickClassificationKey;
  label: string;
};

export type ChampionOddsSimulationEntry = {
  teamCode: string;
  teamName: string | null;
  decimalOdds: number | null;
  rawImpliedProbability: number | null;
  normalizedProbability: number;
  simulatedWins: number;
  simulatedProbability: number;
  status: TeamTournamentStatusValue;
  provider: string | null;
  bookmaker: string | null;
  capturedAt: Date | string | null;
};

export type ChampionOddsSimulationResult = {
  available: boolean;
  resolved: boolean;
  iterations: number;
  message: string | null;
  lastCapturedAt: Date | string | null;
  entries: ChampionOddsSimulationEntry[];
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
  if (status === 'eliminated' || status === 'runner_up') return 'eliminated';
  return 'alive';
}

export function findConflictingChampionTeamCode(
  teamStatuses: TeamStatusLike[],
  targetTeamCode: string,
): string | null {
  const normalizedTarget = targetTeamCode.trim().toUpperCase();
  return teamStatuses.find((status) => (
    normalizeTeamStatus(status.status) === 'champion'
    && status.teamCode.trim().toUpperCase() !== normalizedTarget
  ))?.teamCode ?? null;
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

export function calculateIndividualExpectedValue(
  prizePoolAmount?: number | null,
  probability?: number | null,
  samePickCount?: number | null
): number | null {
  if (
    prizePoolAmount === null ||
    prizePoolAmount === undefined ||
    probability === null ||
    probability === undefined ||
    !samePickCount ||
    samePickCount <= 0
  ) {
    return null;
  }

  return (prizePoolAmount * probability) / samePickCount;
}

export function classifyChampionPick(input: {
  probability?: number | null;
  pickCount: number;
  pickPercentage: number;
  popularityRank?: number | null;
  isExclusive?: boolean;
}): ChampionPickClassification {
  const { probability, pickCount, pickPercentage, popularityRank, isExclusive } = input;
  const manyPicks = pickPercentage >= 0.2 || (popularityRank !== null && popularityRank !== undefined && popularityRank <= 3);

  if (probability === null || probability === undefined) {
    return pickCount > 0
      ? { key: 'popularity_only', label: 'Popularidad disponible' }
      : { key: 'unclassified', label: 'Sin señal de mercado' };
  }

  // Thresholds are intentionally simple and transparent for a lightweight user-facing heuristic.
  const highProbability = probability >= 0.1;
  const lowProbability = probability < 0.05;

  if (lowProbability && manyPicks) return { key: 'high_risk', label: 'Riesgo alto' };
  if (lowProbability) return { key: 'longshot', label: 'Longshot' };
  if (highProbability && manyPicks) return { key: 'favorite_popular', label: 'Favorito popular' };
  if (highProbability && (isExclusive || pickPercentage < 0.2)) {
    return { key: 'attractive_differential', label: 'Diferencial atractivo' };
  }
  if (manyPicks && probability < pickPercentage) return { key: 'saturated', label: 'Alta concentración de picks' };

  return { key: 'unclassified', label: 'Sin señal destacada' };
}

export function simulateChampionOdds(input: {
  leagueId?: string;
  oddsSnapshots: ChampionOddsLike[];
  teamStatuses: TeamStatusLike[];
  teamNames?: Record<string, string>;
  iterations?: number;
  seed?: number;
}): ChampionOddsSimulationResult {
  const iterations = normalizeSimulationIterations(input.iterations);
  const statusByTeam = new Map(
    input.teamStatuses.map((status) => [status.teamCode, normalizeTeamStatus(status.status)])
  );
  const latestByTeam = new Map<string, ChampionOddsLike>();
  for (const snapshot of input.oddsSnapshots) {
    if (snapshot.sourceMarket && snapshot.sourceMarket !== 'outright_winner') continue;
    if (!Number.isFinite(snapshot.decimalOdds) || snapshot.decimalOdds <= 1) continue;

    const current = latestByTeam.get(snapshot.teamCode);
    if (!current || compareCapturedAt(snapshot.capturedAt, current.capturedAt) > 0) {
      latestByTeam.set(snapshot.teamCode, snapshot);
    }
  }

  const championTeam = input.teamStatuses.find((status) => normalizeTeamStatus(status.status) === 'champion');

  if (championTeam) {
    const otherEntries = Array.from(latestByTeam.values())
      .filter((snapshot) => snapshot.teamCode !== championTeam.teamCode)
      .filter((snapshot) => {
        const status = statusByTeam.get(snapshot.teamCode) || 'unknown';
        return status !== 'eliminated' && status !== 'runner_up';
      })
      .map((snapshot) => ({
        teamCode: snapshot.teamCode,
        teamName: snapshot.teamName || input.teamNames?.[snapshot.teamCode] || null,
        decimalOdds: snapshot.decimalOdds,
        rawImpliedProbability: 1 / snapshot.decimalOdds,
        normalizedProbability: 0,
        simulatedWins: 0,
        simulatedProbability: 0,
        status: statusByTeam.get(snapshot.teamCode) || 'unknown',
        provider: snapshot.provider || null,
        bookmaker: snapshot.bookmaker || null,
        capturedAt: snapshot.capturedAt || null,
      }));

    return {
      available: true,
      resolved: true,
      iterations,
      message: null,
      lastCapturedAt: getLatestCapturedAt(Array.from(latestByTeam.values())),
      entries: [{
        teamCode: championTeam.teamCode,
        teamName: input.teamNames?.[championTeam.teamCode] || null,
        decimalOdds: null,
        rawImpliedProbability: null,
        normalizedProbability: 1,
        simulatedWins: iterations,
        simulatedProbability: 1,
        status: 'champion',
        provider: null,
        bookmaker: null,
        capturedAt: null,
      }, ...otherEntries],
    };
  }

  const included = Array.from(latestByTeam.values())
    .map((snapshot) => {
      const status = statusByTeam.get(snapshot.teamCode) || 'unknown';
      return {
        snapshot,
        teamName: snapshot.teamName || input.teamNames?.[snapshot.teamCode] || null,
        status,
        rawImpliedProbability: 1 / snapshot.decimalOdds,
      };
    })
    .filter((item) => item.status !== 'eliminated' && item.status !== 'runner_up');

  if (included.length === 0) {
    return {
      available: false,
      resolved: false,
      iterations,
      message: 'Simulación no disponible porque no hay cuotas de campeón cargadas.',
      lastCapturedAt: null,
      entries: [],
    };
  }

  const lastCapturedAt = getLatestCapturedAt(included.map((item) => item.snapshot));

  const totalProbability = included.reduce((sum, item) => sum + item.rawImpliedProbability, 0);
  if (totalProbability <= 0) {
    return {
      available: false,
      resolved: false,
      iterations,
      message: 'Simulación no disponible porque no hay cuotas de campeón cargadas.',
      lastCapturedAt: null,
      entries: [],
    };
  }

  const normalized = included.map((item) => ({
    ...item,
    normalizedProbability: item.rawImpliedProbability / totalProbability,
  }));

  if (normalized.length === 1) {
    const only = normalized[0];
    return {
      available: true,
      resolved: true,
      iterations,
      message: null,
      lastCapturedAt,
      entries: [buildSimulationEntry(only, iterations, 1)],
    };
  }

  const wins = new Map(normalized.map((item) => [item.snapshot.teamCode, 0]));
  const random = createSeededRandom(input.seed ?? deriveSimulationSeed(input.leagueId, lastCapturedAt, iterations));
  const cumulative = normalized.reduce<Array<{ teamCode: string; threshold: number }>>((acc, item) => {
    const previous = acc[acc.length - 1]?.threshold || 0;
    acc.push({
      teamCode: item.snapshot.teamCode,
      threshold: previous + item.normalizedProbability,
    });
    return acc;
  }, []);

  for (let iteration = 0; iteration < iterations; iteration++) {
    const draw = random();
    const winner = cumulative.find((item) => draw <= item.threshold) || cumulative[cumulative.length - 1];
    wins.set(winner.teamCode, (wins.get(winner.teamCode) || 0) + 1);
  }

  const entries = normalized
    .map((item) => {
      const simulatedWins = wins.get(item.snapshot.teamCode) || 0;
      return buildSimulationEntry(item, simulatedWins, simulatedWins / iterations);
    })
    .sort((a, b) => {
      if (a.simulatedProbability !== b.simulatedProbability) {
        return b.simulatedProbability - a.simulatedProbability;
      }
      return a.teamCode.localeCompare(b.teamCode);
    });

  return {
    available: true,
    resolved: false,
    iterations,
    message: null,
    lastCapturedAt,
    entries,
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

function buildSimulationEntry(
  item: {
    snapshot: ChampionOddsLike;
    teamName: string | null;
    status: TeamTournamentStatusValue;
    rawImpliedProbability: number;
    normalizedProbability: number;
  },
  simulatedWins: number,
  simulatedProbability: number
): ChampionOddsSimulationEntry {
  return {
    teamCode: item.snapshot.teamCode,
    teamName: item.teamName,
    decimalOdds: item.snapshot.decimalOdds,
    rawImpliedProbability: item.rawImpliedProbability,
    normalizedProbability: item.normalizedProbability,
    simulatedWins,
    simulatedProbability,
    status: item.status,
    provider: item.snapshot.provider || null,
    bookmaker: item.snapshot.bookmaker || null,
    capturedAt: item.snapshot.capturedAt || null,
  };
}

function normalizeSimulationIterations(iterations?: number): number {
  if (!iterations || !Number.isFinite(iterations)) return 10000;
  return Math.max(1, Math.floor(iterations));
}

function compareCapturedAt(left?: Date | string | null, right?: Date | string | null): number {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return leftTime - rightTime;
}

function getLatestCapturedAt(snapshots: ChampionOddsLike[]): Date | string | null {
  return snapshots
    .map((snapshot) => snapshot.capturedAt || null)
    .filter((value): value is Date | string => Boolean(value))
    .sort((a, b) => compareCapturedAt(b, a))[0] || null;
}

function deriveSimulationSeed(
  leagueId: string | undefined,
  lastCapturedAt: Date | string | null,
  iterations: number
): number {
  const capturedAt = lastCapturedAt ? new Date(lastCapturedAt).toISOString() : 'no-captured-at';
  return hashStringToPositiveInteger(`${leagueId || 'league'}:${capturedAt}:${iterations}`);
}

function hashStringToPositiveInteger(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) || 1;
}

function createSeededRandom(seed: number): () => number {
  let state = Math.trunc(seed) % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
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
