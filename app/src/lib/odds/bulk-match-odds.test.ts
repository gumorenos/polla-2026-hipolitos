import { describe, expect, it } from 'vitest';
import {
  selectBulkMatchOddsCandidates,
  type BulkMatchOddsCandidate,
} from './bulk-match-odds';

const now = new Date('2026-06-29T12:00:00.000Z');

function candidate(
  id: string,
  kickoffUtc: string,
  overrides: Partial<BulkMatchOddsCandidate> = {},
): BulkMatchOddsCandidate {
  return {
    id,
    homeTeamCode: 'ARG',
    awayTeamCode: 'BRA',
    kickoffUtc: new Date(kickoffUtc),
    status: 'open',
    resultStatus: 'scheduled',
    hasGlobalMatchWinnerOdds: false,
    ...overrides,
  };
}

describe('bulk match odds candidate selection', () => {
  it('selects only future non-final matches without global match-winner odds', () => {
    const matches = [
      candidate('missing', '2026-06-30T12:00:00.000Z'),
      candidate('with-odds', '2026-06-30T13:00:00.000Z', { hasGlobalMatchWinnerOdds: true }),
      candidate('past', '2026-06-28T12:00:00.000Z'),
      candidate('result', '2026-07-01T12:00:00.000Z', { status: 'result' }),
      candidate('final', '2026-07-02T12:00:00.000Z', { resultStatus: 'final' }),
    ];

    expect(selectBulkMatchOddsCandidates(matches, 'future_missing', now).map((match) => match.id))
      .toEqual(['missing']);
  });

  it('includes future matches with or without existing odds in future_all mode', () => {
    const matches = [
      candidate('later', '2026-07-02T12:00:00.000Z', { hasGlobalMatchWinnerOdds: true }),
      candidate('earlier', '2026-06-30T12:00:00.000Z'),
    ];

    expect(selectBulkMatchOddsCandidates(matches, 'future_all', now).map((match) => match.id))
      .toEqual(['earlier', 'later']);
  });

  it('supports safe lookahead and match-count limits', () => {
    const matches = [
      candidate('day-1', '2026-06-30T12:00:00.000Z'),
      candidate('day-2', '2026-07-01T12:00:00.000Z'),
      candidate('day-10', '2026-07-09T12:00:00.000Z'),
    ];

    expect(selectBulkMatchOddsCandidates(matches, 'future_all', now, {
      lookaheadHours: 7 * 24,
      limit: 1,
    }).map((match) => match.id)).toEqual(['day-1']);
  });
});
