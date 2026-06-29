import { describe, expect, it } from 'vitest';
import {
  buildChampionStatusInitializationPlan,
  buildGroupStageChampionStatusUpdates,
  buildKnockoutChampionStatusUpdates,
  buildRoundOf32ChampionStatusUpdates,
} from './champion-status-sync';

describe('Champion Survivor team status sync', () => {
  it('initializes only eligible outright teams and is idempotent', () => {
    const plan = buildChampionStatusInitializationPlan(
      ['ARG', 'BRA'],
      ['ARG', 'BRA', 'W100'],
      [{ teamCode: 'ARG', status: 'active' }],
    );
    expect(plan.targetTeamCodes).toEqual(['ARG', 'BRA']);
    expect(plan.createTeamCodes).toEqual(['BRA']);
    expect(plan.unchanged).toBe(1);
    expect(plan.skippedIneligible).toBe(1);
  });

  it('preserves terminal manual statuses while applying group eliminations', () => {
    const plan = buildGroupStageChampionStatusUpdates(
      ['ARG', 'BRA', 'FRA'],
      [
        { teamCode: 'ARG', status: 'champion' },
        { teamCode: 'BRA', status: 'active' },
      ],
      { ARG: 'active', BRA: 'eliminated', FRA: 'active' },
    );
    expect(plan.preservedManual).toBe(1);
    expect(plan.updates).toEqual([
      { teamCode: 'BRA', status: 'eliminated' },
      { teamCode: 'FRA', status: 'active' },
    ]);
  });

  it('keeps r32 teams active and eliminates teams outside the materialized r32', () => {
    const plan = buildRoundOf32ChampionStatusUpdates(
      ['ARG', 'BRA', 'FRA'],
      [{ teamCode: 'ARG', status: 'active' }],
      ['ARG', 'FRA'],
    );
    expect(plan.updates).toEqual([
      { teamCode: 'BRA', status: 'eliminated' },
      { teamCode: 'FRA', status: 'active' },
    ]);
  });

  it('eliminates knockout losers and resolves champion and runner-up', () => {
    const plan = buildKnockoutChampionStatusUpdates(
      ['ARG', 'BRA', 'FRA'],
      [
        { teamCode: 'ARG', status: 'active' },
        { teamCode: 'BRA', status: 'active' },
        { teamCode: 'FRA', status: 'active' },
      ],
      [{
        id: 'final', phase: 'final', homeTeamCode: 'ARG', awayTeamCode: 'BRA',
        homeScore: 1, awayScore: 1, resultStatus: 'final', winnerTeamCode: 'ARG',
      }],
    );
    expect(plan.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ teamCode: 'ARG', status: 'champion', finalRank: 1 }),
      expect.objectContaining({ teamCode: 'BRA', status: 'runner_up', finalRank: 2 }),
      expect.objectContaining({ teamCode: 'FRA', status: 'eliminated' }),
    ]));
  });

  it('eliminates RSA and keeps CAN active after the production r32_01 result', () => {
    const plan = buildKnockoutChampionStatusUpdates(
      ['RSA', 'CAN'],
      [
        { teamCode: 'RSA', status: 'active' },
        { teamCode: 'CAN', status: 'active' },
      ],
      [{
        id: 'r32_01', phase: 'r32', homeTeamCode: 'RSA', awayTeamCode: 'CAN',
        homeScore: 0, awayScore: 1, resultStatus: 'final', winnerTeamCode: 'CAN',
      }],
    );
    expect(plan.updates).toEqual([
      expect.objectContaining({ teamCode: 'RSA', status: 'eliminated', eliminatedInMatchId: 'r32_01' }),
    ]);
    expect(plan.conflicts).toEqual([]);
  });

  it('eliminates a semifinal loser even though it advances to the third-place match', () => {
    const plan = buildKnockoutChampionStatusUpdates(
      ['ARG', 'BRA'],
      [
        { teamCode: 'ARG', status: 'active' },
        { teamCode: 'BRA', status: 'active' },
      ],
      [{
        id: 'sf_01', phase: 'semis', homeTeamCode: 'ARG', awayTeamCode: 'BRA',
        homeScore: 2, awayScore: 0, resultStatus: 'final', winnerTeamCode: 'ARG',
      }],
    );
    expect(plan.updates).toEqual([
      expect.objectContaining({ teamCode: 'BRA', status: 'eliminated', eliminatedInMatchId: 'sf_01' }),
    ]);
  });
});
