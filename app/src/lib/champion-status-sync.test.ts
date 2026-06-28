import { describe, expect, it } from 'vitest';
import {
  buildChampionStatusInitializationPlan,
  buildGroupStageChampionStatusUpdates,
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
});
