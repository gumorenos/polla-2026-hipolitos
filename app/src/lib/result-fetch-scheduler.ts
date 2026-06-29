import { isCompleteFinalMatchResult } from './match-result';

export const GROUP_RESULT_FETCH_OFFSET_MINUTES = 125;
export const KNOCKOUT_RESULT_FETCH_OFFSET_MINUTES = 195;
export const SURGICAL_FETCH_RETRY_GRACE_MINUTES = 15;
export const DEFAULT_SURGICAL_FETCH_LIMIT = 8;

const MINUTE_MS = 60 * 1000;

export type SurgicalResultMatch = {
  id: string;
  phase: string;
  kickoffUtc: Date | string | number;
  status: string;
  resultStatus: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamCode: string | null;
  resultFetchedAt?: Date | string | number | null;
};

function toEpochMs(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  return typeof value === 'number' ? value : new Date(value).getTime();
}

export function getEstimatedResultFetchTime(match: Pick<SurgicalResultMatch, 'phase' | 'kickoffUtc'>): number {
  const offsetMinutes = match.phase === 'groups'
    ? GROUP_RESULT_FETCH_OFFSET_MINUTES
    : KNOCKOUT_RESULT_FETCH_OFFSET_MINUTES;
  return toEpochMs(match.kickoffUtc) + offsetMinutes * MINUTE_MS;
}

export function isMatchResultFinal(match: SurgicalResultMatch): boolean {
  return isCompleteFinalMatchResult(match);
}

export function getIncompleteKnockoutFinalDiagnostic(match: SurgicalResultMatch): string | null {
  if (
    match.phase !== 'groups'
    && match.status === 'result'
    && match.resultStatus === 'final'
    && match.homeScore !== null
    && match.awayScore !== null
    && !match.winnerTeamCode
  ) {
    return `El partido eliminatorio ${match.id} figura como final, pero no tiene ganador para propagar.`;
  }
  return null;
}

export function isMatchDueForSurgicalFetch(
  match: SurgicalResultMatch,
  now: Date | number,
): boolean {
  const nowMs = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(nowMs) || !Number.isFinite(toEpochMs(match.kickoffUtc))) return false;
  if (match.resultStatus === 'cancelled' || match.resultStatus === 'postponed') return false;
  if (isMatchResultFinal(match)) return false;
  if (getEstimatedResultFetchTime(match) > nowMs) return false;

  if (match.resultFetchedAt) {
    const retryAt = toEpochMs(match.resultFetchedAt) + SURGICAL_FETCH_RETRY_GRACE_MINUTES * MINUTE_MS;
    if (retryAt > nowMs) return false;
  }
  return true;
}

export function selectSurgicalFetchCandidates<T extends SurgicalResultMatch>(
  matches: T[],
  now: Date | number,
  limit = DEFAULT_SURGICAL_FETCH_LIMIT,
): T[] {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_SURGICAL_FETCH_LIMIT;
  return matches
    .filter((match) => isMatchDueForSurgicalFetch(match, now))
    .sort((left, right) => getEstimatedResultFetchTime(left) - getEstimatedResultFetchTime(right))
    .slice(0, safeLimit);
}

export type SurgicalFetchDependencies<TFetchResult> = {
  loadMatch: (matchId: string) => Promise<SurgicalResultMatch | null>;
  claimMatch: (match: SurgicalResultMatch, attemptedAt: Date) => Promise<boolean>;
  fetchAndSaveWithPostResultPipeline: (matchId: string) => Promise<TFetchResult>;
};

export type SurgicalCandidateResult<TFetchResult> =
  | { status: 'missing' }
  | { status: 'skipped_final'; diagnostic: string | null }
  | { status: 'skipped_not_due'; diagnostic: string | null }
  | { status: 'skipped_claimed' }
  | { status: 'fetched'; result: TFetchResult };

export async function processSurgicalFetchCandidate<TFetchResult>(
  matchId: string,
  now: Date,
  dependencies: SurgicalFetchDependencies<TFetchResult>,
): Promise<SurgicalCandidateResult<TFetchResult>> {
  const current = await dependencies.loadMatch(matchId);
  if (!current) return { status: 'missing' };

  const diagnostic = getIncompleteKnockoutFinalDiagnostic(current);
  if (isMatchResultFinal(current)) return { status: 'skipped_final', diagnostic };
  if (!isMatchDueForSurgicalFetch(current, now)) return { status: 'skipped_not_due', diagnostic };
  if (!await dependencies.claimMatch(current, now)) return { status: 'skipped_claimed' };

  const result = await dependencies.fetchAndSaveWithPostResultPipeline(matchId);
  return { status: 'fetched', result };
}
