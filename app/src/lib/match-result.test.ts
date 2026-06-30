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

  it('accepts a trusted provider winner when penalty scores are unavailable', () => {
    const result = normalizeFinalMatchResult({
      phase: 'r32',
      homeTeamCode: 'NED',
      awayTeamCode: 'MAR',
      homeScore: 1,
      awayScore: 1,
      wentToPenalties: true,
      homePenaltyScore: null,
      awayPenaltyScore: null,
      winnerTeamCode: 'MAR',
      allowWinnerWithoutPenaltyScore: true,
    });

    expect(result.valid).toBe(true);
    expect(result.valid && result.result.winnerTeamCode).toBe('MAR');
    expect(result.valid && result.result.homePenaltyScore).toBeNull();
    expect(result.valid && result.result.awayPenaltyScore).toBeNull();
    expect(result.valid && result.result.wentToPenalties).toBe(true);
  });

  it('accepts a trusted provider winner when penalty scores are ambiguous', () => {
    const result = normalizeFinalMatchResult({
      phase: 'r32',
      homeTeamCode: 'NED',
      awayTeamCode: 'MAR',
      homeScore: 3,
      awayScore: 4,
      wentToPenalties: true,
      homePenaltyScore: 0,
      awayPenaltyScore: 0,
      winnerTeamCode: 'MAR',
      allowWinnerWithoutPenaltyScore: true,
    });

    expect(result.valid).toBe(true);
    expect(result.valid && result.result.winnerTeamCode).toBe('MAR');
    expect(result.valid && result.result.homePenaltyScore).toBeNull();
    expect(result.valid && result.result.awayPenaltyScore).toBeNull();
  });

  it('rejects an explicit winner outside the match', () => {
    const result = normalizeFinalMatchResult({
      phase: 'r32',
      homeTeamCode: 'NED',
      awayTeamCode: 'MAR',
      homeScore: 1,
      awayScore: 1,
      wentToPenalties: true,
      winnerTeamCode: 'ARG',
      allowWinnerWithoutPenaltyScore: true,
    });

    expect(result.valid).toBe(false);
  });

  it('keeps manual knockout draws strict without penalty scores', () => {
    const result = normalizeFinalMatchResult({
      phase: 'r32',
      homeTeamCode: 'NED',
      awayTeamCode: 'MAR',
      homeScore: 1,
      awayScore: 1,
      wentToPenalties: true,
    });

    expect(result.valid).toBe(false);
  });

  it('infers the winner for a non-draw knockout result', () => {
    const result = normalizeFinalMatchResult({
      phase: 'r32',
      homeTeamCode: 'NED',
      awayTeamCode: 'MAR',
      homeScore: 2,
      awayScore: 1,
    });

    expect(result.valid).toBe(true);
    expect(result.valid && result.result.winnerTeamCode).toBe('NED');
    expect(result.valid && result.result.wentToPenalties).toBe(false);
  });

  it('detects status=result without complete final scores', () => {
    const invalid = { status: 'result', resultStatus: null, homeScore: null, awayScore: null };
    expect(isConsistentFinalMatchResult(invalid)).toBe(false);
    expect(getMatchResultConsistencyIssue(invalid)).not.toBeNull();
  });
});
