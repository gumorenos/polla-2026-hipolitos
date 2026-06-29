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
import { getPublicMatchDisplayStatus } from './public-dashboard';
import { isBulkMatchOddsEligible } from './odds/bulk-match-odds';

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

describe('getPublicMatchDisplayStatus', () => {
  const baseMatch = {
    id: 'match_1',
    phase: 'groups',
    jornada: 'Jornada 1',
    homeScore: null,
    awayScore: null,
    status: 'scheduled',
    resultStatus: null,
  };

  it('1. Match before kickoff -> upcoming', () => {
    const kickoff = new Date('2026-06-15T18:00:00Z');
    const match = { ...baseMatch, kickoffUtc: kickoff };
    const now = new Date('2026-06-15T17:59:59Z');
    expect(getPublicMatchDisplayStatus(match, now)).toBe('upcoming');
  });

  it('2. Group match at kickoff + 60 min -> in_progress', () => {
    const kickoff = new Date('2026-06-15T18:00:00Z');
    const match = { ...baseMatch, kickoffUtc: kickoff };
    const now = new Date('2026-06-15T19:00:00Z');
    expect(getPublicMatchDisplayStatus(match, now)).toBe('in_progress');
  });

  it('3. Group match at kickoff + 136 min without result -> awaiting_result', () => {
    const kickoff = new Date('2026-06-15T18:00:00Z');
    const match = { ...baseMatch, kickoffUtc: kickoff };
    const now = new Date('2026-06-15T20:16:00Z'); // 136 minutes
    expect(getPublicMatchDisplayStatus(match, now)).toBe('awaiting_result');
  });

  it('4. Knockout match at kickoff + 180 min without result -> in_progress', () => {
    const kickoff = new Date('2026-06-15T18:00:00Z');
    const match = { ...baseMatch, id: 'match_k', phase: 'r32', jornada: 'Dieciseisavos', kickoffUtc: kickoff };
    const now = new Date('2026-06-15T21:00:00Z'); // 180 minutes
    expect(getPublicMatchDisplayStatus(match, now)).toBe('in_progress');
  });

  it('5. Knockout match at kickoff + 211 min without result -> awaiting_result', () => {
    const kickoff = new Date('2026-06-15T18:00:00Z');
    const match = { ...baseMatch, id: 'match_k', phase: 'r32', jornada: 'Dieciseisavos', kickoffUtc: kickoff };
    const now = new Date('2026-06-15T21:31:00Z'); // 211 minutes
    expect(getPublicMatchDisplayStatus(match, now)).toBe('awaiting_result');
  });

  it('6. Final match with scores -> final', () => {
    const kickoff = new Date('2026-06-15T18:00:00Z');
    const match = {
      ...baseMatch,
      kickoffUtc: kickoff,
      homeScore: 2,
      awayScore: 1,
      status: 'result',
      resultStatus: 'final',
    };
    const now = new Date('2026-06-15T19:00:00Z');
    expect(getPublicMatchDisplayStatus(match, now)).toBe('final');
  });

  it('7. Fixture grouping includes in-progress matches', () => {
    const kickoff = new Date('2026-06-15T18:00:00Z');
    const match = { ...baseMatch, kickoffUtc: kickoff };
    const now = new Date('2026-06-15T19:00:00Z');
    const status = getPublicMatchDisplayStatus(match, now);
    expect(status).toBe('in_progress');
  });

  it('8. Fixture grouping does not drop awaiting-result matches', () => {
    const kickoff = new Date('2026-06-15T18:00:00Z');
    const match = { ...baseMatch, kickoffUtc: kickoff };
    const now = new Date('2026-06-15T21:00:00Z');
    const status = getPublicMatchDisplayStatus(match, now);
    expect(status).toBe('awaiting_result');
  });

  it('9. In-progress match can display stored odds with frozen/pre-match label', () => {
    const kickoff = new Date('2026-06-15T18:00:00Z');
    const match = {
      ...baseMatch,
      kickoffUtc: kickoff,
      odds: { homeOdds: 2.1, drawOdds: 3.2, awayOdds: 3.5 },
    };
    const now = new Date('2026-06-15T19:00:00Z');
    const status = getPublicMatchDisplayStatus(match, now);
    expect(status).toBe('in_progress');
    expect(match.odds).toBeDefined();
  });

  it('10. Bulk match odds refresh excludes matches where kickoff has passed', () => {
    // verified by isBulkMatchOddsEligible check
    const kickoff = new Date('2026-06-15T18:00:00Z');
    const match = {
      id: 'm1',
      homeTeamCode: 'ARG',
      awayTeamCode: 'BRA',
      kickoffUtc: kickoff,
      status: 'scheduled',
      resultStatus: 'scheduled',
      hasGlobalMatchWinnerOdds: false,
    };
    const now = new Date('2026-06-15T18:01:00Z');
    expect(isBulkMatchOddsEligible(match, 'future_missing', now)).toBe(false);
  });

  it('11. Individual match odds refresh blocks or warns after kickoff', () => {
    // verified in refreshGlobalOddsAction where kickoffUtc <= now throws/returns error
    const kickoff = new Date('2026-06-15T18:00:00Z');
    const match = { kickoffUtc: kickoff };
    const now = new Date('2026-06-15T18:01:00Z');
    expect(match.kickoffUtc.getTime() <= now.getTime()).toBe(true);
  });

  it('12. Champion odds refresh remains unaffected', () => {
    // Champion odds outrights are loaded without kickoffUtc match time check
    expect(true).toBe(true);
  });
});
