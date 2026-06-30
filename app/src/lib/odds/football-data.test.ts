import { describe, expect, it } from 'vitest';
import { normalizeFootballDataResult, type FootballDataScorePayload } from './football-data';

const knockoutMatch = { homeTeamCode: 'NED', awayTeamCode: 'MAR', phase: 'r32' };

function score(overrides: Partial<FootballDataScorePayload>): FootballDataScorePayload {
  return {
    winner: 'AWAY_TEAM',
    duration: 'PENALTY_SHOOTOUT',
    fullTime: { home: 4, away: 5 },
    regularTime: { home: 1, away: 1 },
    extraTime: { home: 0, away: 0 },
    penalties: { home: 3, away: 4 },
    ...overrides,
  };
}

describe('football-data result normalization', () => {
  it('separates a penalty shootout from the match score', () => {
    const normalized = normalizeFootballDataResult(score({}), knockoutMatch);

    expect('result' in normalized && normalized.result.homeScore).toBe(1);
    expect('result' in normalized && normalized.result.awayScore).toBe(1);
    expect('result' in normalized && normalized.result.homePenaltyScore).toBe(3);
    expect('result' in normalized && normalized.result.awayPenaltyScore).toBe(4);
    expect('result' in normalized && normalized.result.winnerTeamCode).toBe('MAR');
  });

  it('keeps a trusted shootout winner when penalty scores are ambiguous', () => {
    const normalized = normalizeFootballDataResult(score({
      fullTime: { home: 3, away: 4 },
      regularTime: undefined,
      penalties: { home: 0, away: 0 },
    }), knockoutMatch);

    expect('result' in normalized && normalized.result.winnerTeamCode).toBe('MAR');
    expect('result' in normalized && normalized.result.homePenaltyScore).toBeNull();
    expect('result' in normalized && normalized.result.awayPenaltyScore).toBeNull();
    expect('result' in normalized && normalized.result.normalizationNote).toBeTruthy();
  });

  it('keeps a trusted shootout winner when penalty scores are missing', () => {
    const normalized = normalizeFootballDataResult(score({
      fullTime: { home: 3, away: 4 },
      regularTime: undefined,
      extraTime: undefined,
      penalties: undefined,
    }), knockoutMatch);

    expect('result' in normalized && normalized.result.winnerTeamCode).toBe('MAR');
    expect('result' in normalized && normalized.result.homePenaltyScore).toBeNull();
    expect('result' in normalized && normalized.result.awayPenaltyScore).toBeNull();
  });

  it('rejects a finished knockout shootout without a resolvable winner', () => {
    const normalized = normalizeFootballDataResult(score({ winner: null }), knockoutMatch);
    expect('error' in normalized).toBe(true);
  });

  it('uses fullTime as the final extra-time score without adding extraTime twice', () => {
    const normalized = normalizeFootballDataResult(score({
      winner: 'HOME_TEAM',
      duration: 'EXTRA_TIME',
      fullTime: { home: 2, away: 1 },
      regularTime: { home: 1, away: 1 },
      extraTime: { home: 1, away: 0 },
      penalties: { home: null, away: null },
    }), knockoutMatch);

    expect('result' in normalized && normalized.result.homeScore).toBe(2);
    expect('result' in normalized && normalized.result.awayScore).toBe(1);
    expect('result' in normalized && normalized.result.winnerTeamCode).toBe('NED');
  });
});
