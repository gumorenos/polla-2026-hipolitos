import { describe, expect, it } from 'vitest';
import {
  buildSurvivalSummary,
  calculateChampionProbability,
  calculatePrizePool,
  getChampionPickStatus,
  isChampionDeadlinePassed,
  resolveCompetitionType,
  sortChampionSurvivorRanking,
} from './champion-survivor';

describe('Champion Survivor business logic', () => {
  it('treats missing or full_prediction competition types as full_prediction', () => {
    expect(resolveCompetitionType(null)).toBe('full_prediction');
    expect(resolveCompetitionType(undefined)).toBe('full_prediction');
    expect(resolveCompetitionType('full_prediction')).toBe('full_prediction');
    expect(resolveCompetitionType('champion_survivor')).toBe('champion_survivor');
  });

  it('enforces champion deadlines for normal submissions', () => {
    const now = new Date('2026-06-16T12:00:00.000Z');
    expect(isChampionDeadlinePassed('2026-06-16T11:59:59.000Z', now)).toBe(true);
    expect(isChampionDeadlinePassed('2026-06-16T12:00:01.000Z', now)).toBe(false);
    expect(isChampionDeadlinePassed(null, now)).toBe(false);
  });

  it('computes dynamic pick status from team tournament status', () => {
    const pick = { userId: 'u1', teamCode: 'PER' };

    expect(getChampionPickStatus(null, null)).toBe('pending');
    expect(getChampionPickStatus(pick, null)).toBe('alive');
    expect(getChampionPickStatus(pick, { teamCode: 'PER', status: 'unknown' })).toBe('alive');
    expect(getChampionPickStatus(pick, { teamCode: 'PER', status: 'active' })).toBe('alive');
    expect(getChampionPickStatus(pick, { teamCode: 'PER', status: 'eliminated' })).toBe('eliminated');
    expect(getChampionPickStatus(pick, { teamCode: 'PER', status: 'champion' })).toBe('winner');
  });

  it('returns unavailable champion probability when no champion odds snapshot exists', () => {
    const result = calculateChampionProbability(null, 100);

    expect(result.available).toBe(false);
    expect(result.impliedProbability).toBeNull();
    expect(result.expectedValue).toBeNull();
  });

  it('uses prize pool times implied probability for expected value', () => {
    const result = calculateChampionProbability({
      teamCode: 'ARG',
      decimalOdds: 4,
      impliedProbability: 0.25,
    }, 200);

    expect(result.available).toBe(true);
    expect(result.impliedProbability).toBe(0.25);
    expect(result.expectedValue).toBe(50);
  });

  it('respects league currency, entry fee, and prize pool override', () => {
    expect(calculatePrizePool({ currency: 'PEN', entryFee: 20 }, 8)).toEqual({
      amount: 160,
      estimated: true,
      currency: 'PEN',
    });

    expect(calculatePrizePool({ currency: 'PEN', entryFee: 20, prizePoolOverride: 500 }, 8)).toEqual({
      amount: 500,
      estimated: false,
      currency: 'PEN',
    });
  });

  it('keeps eliminated users visible and winners first in ranking order', () => {
    const ranked = sortChampionSurvivorRanking([
      { userId: 'pending', status: 'pending', teamCode: null },
      { userId: 'eliminated', status: 'eliminated', teamCode: 'BRA', eliminatedAt: '2026-07-02T00:00:00.000Z' },
      { userId: 'winner', status: 'winner', teamCode: 'ARG', championProbability: 0.2, expectedValue: 100 },
      { userId: 'alive-low', status: 'alive', teamCode: 'FRA', championProbability: 0.1, expectedValue: 50 },
      { userId: 'alive-high', status: 'alive', teamCode: 'ESP', championProbability: 0.3, expectedValue: 150 },
    ]);

    expect(ranked.map((entry) => entry.userId)).toEqual([
      'winner',
      'alive-high',
      'alive-low',
      'eliminated',
      'pending',
    ]);
  });

  it('does not use match prediction points for champion_survivor ranking', () => {
    const ranked = sortChampionSurvivorRanking([
      { userId: 'many-match-points', status: 'alive', teamCode: 'GER', championProbability: 0.1, expectedValue: 100 },
      { userId: 'better-champion-pick', status: 'alive', teamCode: 'ARG', championProbability: 0.3, expectedValue: 300 },
    ]);

    expect(ranked[0].userId).toBe('better-champion-pick');
  });

  it('makes survival combined probability unavailable when any alive team lacks odds', () => {
    const summary = buildSurvivalSummary([
      { userId: 'u1', status: 'alive', teamCode: 'ARG', championProbability: 0.25 },
      { userId: 'u2', status: 'alive', teamCode: 'BRA', championProbability: null },
      { userId: 'u3', status: 'eliminated', teamCode: 'PER' },
    ], { amount: 100, estimated: true, currency: 'PEN' });

    expect(summary.totalParticipants).toBe(3);
    expect(summary.alive).toBe(2);
    expect(summary.eliminated).toBe(1);
    expect(summary.combinedAliveProbabilityAvailable).toBe(false);
    expect(summary.combinedAliveProbability).toBeNull();
  });
});
