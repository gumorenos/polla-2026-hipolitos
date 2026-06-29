export type BulkMatchOddsMode = 'future_missing' | 'future_all';

export type BulkMatchOddsCandidate = {
  id: string;
  homeTeamCode: string;
  awayTeamCode: string;
  kickoffUtc: Date;
  status: string;
  resultStatus: string | null;
  hasGlobalMatchWinnerOdds: boolean;
};

export type BulkMatchOddsResult = {
  matchId: string;
  homeTeamCode: string;
  awayTeamCode: string;
  status: 'updated' | 'skipped' | 'failed';
  provider?: string;
  reason?: string;
};

export type BulkMatchOddsSummary = {
  eligible: number;
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  stoppedEarly: boolean;
  providersUsed: string[];
  cooldownNotes: string[];
  results: BulkMatchOddsResult[];
};

export function isBulkMatchOddsEligible(
  match: BulkMatchOddsCandidate,
  mode: BulkMatchOddsMode,
  now: Date,
  maxKickoff?: Date,
): boolean {
  if (match.kickoffUtc.getTime() <= now.getTime()) return false;
  if (maxKickoff && match.kickoffUtc.getTime() > maxKickoff.getTime()) return false;
  if (match.status === 'result' || match.resultStatus === 'final') return false;
  if (mode === 'future_missing' && match.hasGlobalMatchWinnerOdds) return false;
  return true;
}

export function selectBulkMatchOddsCandidates(
  matches: BulkMatchOddsCandidate[],
  mode: BulkMatchOddsMode,
  now: Date,
  options?: { limit?: number; lookaheadHours?: number },
): BulkMatchOddsCandidate[] {
  const maxKickoff = options?.lookaheadHours
    ? new Date(now.getTime() + options.lookaheadHours * 60 * 60 * 1000)
    : undefined;
  const eligible = matches
    .filter((match) => isBulkMatchOddsEligible(match, mode, now, maxKickoff))
    .sort((left, right) => left.kickoffUtc.getTime() - right.kickoffUtc.getTime());

  return options?.limit ? eligible.slice(0, options.limit) : eligible;
}
