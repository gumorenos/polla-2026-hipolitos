import { describe, expect, it } from 'vitest';
import {
  getMatchResultConsistencyIssue,
  isConsistentFinalMatchResult,
  normalizeFinalMatchResult,
} from './match-result';

describe('match result consistency', () => {
  it('rejects a final knockout draw without penalties', () => {
    const result = normalizeFinalMatchResult({
      phase: 'r32',
      homeTeamCode: 'ARG',
      awayTeamCode: 'BRA',
      homeScore: 1,
      awayScore: 1,
    });
    expect(result.valid).toBe(false);
  });

  it('calculates home, away and draw winners', () => {
    const homeWin = normalizeFinalMatchResult({
      phase: 'groups', homeTeamCode: 'ARG', awayTeamCode: 'BRA', homeScore: 2, awayScore: 0,
    });
    const awayWin = normalizeFinalMatchResult({
      phase: 'groups', homeTeamCode: 'ARG', awayTeamCode: 'BRA', homeScore: 0, awayScore: 2,
    });
    const draw = normalizeFinalMatchResult({
      phase: 'groups', homeTeamCode: 'ARG', awayTeamCode: 'BRA', homeScore: 1, awayScore: 1,
    });

    expect(homeWin.valid && homeWin.result.winnerTeamCode).toBe('ARG');
    expect(awayWin.valid && awayWin.result.winnerTeamCode).toBe('BRA');
    expect(draw.valid && draw.result.winnerTeamCode).toBeNull();
  });

  it('derives a penalty winner for a knockout draw', () => {
    const result = normalizeFinalMatchResult({
      phase: 'r32',
      homeTeamCode: 'ARG',
      awayTeamCode: 'BRA',
      homeScore: 1,
      awayScore: 1,
      wentToPenalties: true,
      homePenaltyScore: 4,
      awayPenaltyScore: 3,
    });
    expect(result.valid).toBe(true);
    expect(result.valid && result.result.winnerTeamCode).toBe('ARG');
    expect(result.valid && result.result.resultStatus).toBe('final');
  });

  it('detects status=result without complete final scores', () => {
    const invalid = { status: 'result', resultStatus: null, homeScore: null, awayScore: null };
    expect(isConsistentFinalMatchResult(invalid)).toBe(false);
    expect(getMatchResultConsistencyIssue(invalid)).not.toBeNull();
  });
});
