import { describe, expect, it } from 'vitest';
import {
  calculateIndividualExpectedValue,
  classifyChampionPick,
  calculateChampionProbability,
} from './champion-survivor';
import {
  CHAMPION_SURVIVOR_HOME_SECTIONS,
  CHAMPION_SURVIVOR_OVERVIEW_BLOCKS,
  PUBLIC_CHAMPION_PICK_COLUMNS,
  PUBLIC_FIXTURE_BLOCKS,
} from './public-home-layout';

describe('Public guest dashboard components constraints', () => {
  it('calculates individual expected value correctly', () => {
    // EV = (prizePool * prob) / count
    expect(calculateIndividualExpectedValue(1000, 0.25, 2)).toBe(125);
    // Handles zero/negative count
    expect(calculateIndividualExpectedValue(1000, 0.25, 0)).toBeNull();
    expect(calculateIndividualExpectedValue(1000, 0.25, -1)).toBeNull();
    // Handles missing inputs
    expect(calculateIndividualExpectedValue(null, 0.25, 2)).toBeNull();
    expect(calculateIndividualExpectedValue(1000, null, 2)).toBeNull();
  });

  it('classifies champion picks according to social and probability rules', () => {
    expect(classifyChampionPick({
      probability: 0.15,
      pickCount: 10,
      pickPercentage: 0.3,
      popularityRank: 1,
    }).key).toBe('favorite_shared');

    expect(classifyChampionPick({
      probability: 0.15,
      pickCount: 1,
      pickPercentage: 0.05,
      isExclusive: true,
    }).key).toBe('favorite_differential');

    expect(classifyChampionPick({
      probability: 0.03,
      pickCount: 12,
      pickPercentage: 0.25,
      popularityRank: 2,
    }).key).toBe('longshot_shared');

    expect(classifyChampionPick({
      probability: 0.04,
      pickCount: 1,
      pickPercentage: 0.05,
    }).key).toBe('longshot_exclusive');
  });

  it('hides probability metrics if no odds snapshot is provided', () => {
    const res = calculateChampionProbability(null, 500);
    expect(res.available).toBe(false);
    expect(res.impliedProbability).toBeNull();
    expect(res.expectedValue).toBeNull();
  });

  it('keeps the public Champion Survivor screens and blocks in product order', () => {
    expect(CHAMPION_SURVIVOR_HOME_SECTIONS.map((section) => section.id)).toEqual([
      'survival',
      'matches',
      'fifa',
    ]);
    expect(CHAMPION_SURVIVOR_OVERVIEW_BLOCKS).toEqual([
      'participant_picks',
      'team_market_analysis',
      'compact_summary',
    ]);
    expect(PUBLIC_FIXTURE_BLOCKS).toEqual(['upcoming_matches', 'recent_results']);
  });

  it('does not expose the pick selection date as a public column', () => {
    expect(PUBLIC_CHAMPION_PICK_COLUMNS).toEqual(['participant', 'team', 'status']);
  });
});
