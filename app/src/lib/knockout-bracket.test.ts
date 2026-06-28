import { describe, expect, it } from 'vitest';
import {
  buildRoundOf32Resolution,
  resolveDirectGroupPlaceholder,
} from './knockout-bracket';
import type { BracketMatchLike } from './knockout-bracket';
import type { QualificationTeamLike } from './fifa-qualification';
import type { WorldCupQualification } from './fifa-qualification';

describe('round of 32 bracket resolver', () => {
  it('reports group matches that block resolution', () => {
    const result = buildRoundOf32Resolution([
      {
        id: 'gB4', phase: 'groups', group: 'B', homeTeamCode: 'CAN', awayTeamCode: 'QAT',
        homeScore: null, awayScore: null, status: 'result', resultStatus: null,
      },
    ], [
      { code: 'CAN', name: 'Canadá' },
      { code: 'QAT', name: 'Catar' },
    ]);
    expect(result.ready).toBe(false);
    expect(result.blockingMatches.map((match) => match.id)).toEqual(['gB4']);
  });

  it('resolves direct winner and runner-up placeholders', () => {
    const qualification = {
      groups: [{
        group: 'A', complete: true, playedMatches: 6, totalMatches: 6, unresolvedTies: [],
        entries: [
          { teamCode: 'ARG', rank: 1, status: 'group_winner' },
          { teamCode: 'BRA', rank: 2, status: 'group_runner_up' },
        ],
      }],
      thirdPlacedTeams: [], qualifiedTeamCodes: [], eliminatedTeamCodes: [],
      statusByTeam: {}, teamTournamentStatusSuggestions: {}, unresolvedTies: [],
    } as unknown as WorldCupQualification;

    expect(resolveDirectGroupPlaceholder('1A', qualification)).toBe('ARG');
    expect(resolveDirectGroupPlaceholder('2A', qualification)).toBe('BRA');
  });

  it('resolves the completed production scenario through Annex C without mutating matches', () => {
    const { matches, teams } = buildCompletedProductionScenario();
    const originalMatches = structuredClone(matches);
    const result = buildRoundOf32Resolution(matches, teams);

    expect(result.ready).toBe(true);
    expect(result.canApplySafeProposals).toBe(true);
    expect(result.annexCKey).toBe('BDEFIJKL');
    expect(matches).toEqual(originalMatches);
    expect(result.proposals.map((proposal) => proposal.matchId)).toEqual(
      matches.filter((match) => match.phase === 'r32').map((match) => match.id),
    );

    const expected = {
      r32_03: ['GER', 'PAR'],
      r32_06: ['FRA', 'SWE'],
      r32_07: ['MEX', 'ECU'],
      r32_08: ['ENG', 'COD'],
      r32_09: ['BEL', 'SEN'],
      r32_10: ['USA', 'BIH'],
      r32_13: ['SUI', 'ALG'],
      r32_16: ['COL', 'GHA'],
    } as const;

    for (const [matchId, [home, away]] of Object.entries(expected)) {
      const proposal = result.proposals.find((entry) => entry.matchId === matchId);
      expect([proposal?.resolvedHomeTeamCode, proposal?.resolvedAwayTeamCode]).toEqual([home, away]);
      expect(proposal?.changed).toBe(true);
      expect(proposal?.reason).toContain('Annex C BDEFIJKL');
    }
  });

  it('uses the r32 match slot to correct an already materialized third-place opponent', () => {
    const { matches, teams } = buildCompletedProductionScenario();
    const target = matches.find((match) => match.id === 'r32_03');
    if (!target) throw new Error('Missing r32_03 fixture');
    target.homeTeamCode = 'GER';
    target.awayTeamCode = 'ECU';

    const result = buildRoundOf32Resolution(matches, teams);
    const proposal = result.proposals.find((entry) => entry.matchId === 'r32_03');

    expect(proposal?.currentAwayTeamCode).toBe('ECU');
    expect(proposal?.resolvedAwayTeamCode).toBe('PAR');
    expect(proposal?.changed).toBe(true);
  });

  it('blocks the preview with the canonical key when Annex C data is missing', () => {
    const { matches, teams } = buildCompletedProductionScenario();
    const result = buildRoundOf32Resolution(matches, teams, { annexCAllocations: {} });

    expect(result.ready).toBe(false);
    expect(result.canApplySafeProposals).toBe(false);
    expect(result.annexCKey).toBe('BDEFIJKL');
    expect(result.unresolvedReasons).toContain(
      'No existe una asignación Annex C para la combinación BDEFIJKL.',
    );
  });
});

const GROUP_TEAMS: Record<string, [string, string, string, string]> = {
  A: ['MEX', 'RSA', 'AAX', 'AAY'],
  B: ['SUI', 'CAN', 'BIH', 'BBY'],
  C: ['BRA', 'MAR', 'CCX', 'CCY'],
  D: ['USA', 'AUS', 'PAR', 'DDY'],
  E: ['GER', 'CIV', 'ECU', 'EEY'],
  F: ['NED', 'JPN', 'SWE', 'FFY'],
  G: ['BEL', 'EGY', 'GGX', 'GGY'],
  H: ['ESP', 'CPV', 'HHX', 'HHY'],
  I: ['FRA', 'NOR', 'SEN', 'IIY'],
  J: ['ARG', 'AUT', 'ALG', 'JJY'],
  K: ['COL', 'POR', 'COD', 'KKY'],
  L: ['ENG', 'CRO', 'GHA', 'LLY'],
};

const THIRD_PLACE_STRENGTH: Record<string, number> = {
  B: 12, D: 11, E: 10, F: 9, I: 8, J: 7, K: 6, L: 5,
  A: 4, C: 3, G: 2, H: 1,
};

function buildCompletedProductionScenario(): {
  matches: BracketMatchLike[];
  teams: QualificationTeamLike[];
} {
  const teams = Object.values(GROUP_TEAMS)
    .flat()
    .map((code) => ({ code, name: code }));
  const groupMatches = Object.entries(GROUP_TEAMS).flatMap(([group, [winner, runnerUp, third, fourth]]) => {
    const results: Array<[string, string, number, number]> = [
      [winner, runnerUp, 2, 0],
      [winner, third, 4, 0],
      [winner, fourth, 5, 0],
      [runnerUp, third, 3, 0],
      [runnerUp, fourth, 4, 0],
      [third, fourth, THIRD_PLACE_STRENGTH[group], 0],
    ];

    return results.map(([homeTeamCode, awayTeamCode, homeScore, awayScore], index) => ({
      id: `g${group}${index + 1}`,
      phase: 'groups',
      group,
      homeTeamCode,
      awayTeamCode,
      homeScore,
      awayScore,
      status: 'result',
      resultStatus: 'final',
    }));
  });
  const r32Pairs: Array<[string, string, string]> = [
    ['r32_01', 'RSA', 'CAN'],
    ['r32_02', 'BRA', 'JPN'],
    ['r32_03', '1E', '3ABCDF'],
    ['r32_04', 'NED', 'MAR'],
    ['r32_05', 'CIV', 'NOR'],
    ['r32_06', '1I', '3CDFGH'],
    ['r32_07', '1A', '3CEFHI'],
    ['r32_08', '1L', '3EHIJK'],
    ['r32_09', '1G', '3AEHIJ'],
    ['r32_10', '1D', '3BEFIJ'],
    ['r32_11', 'ESP', 'AUT'],
    ['r32_12', 'POR', 'CRO'],
    ['r32_13', '1B', '3EFGIJ'],
    ['r32_14', 'AUS', 'EGY'],
    ['r32_15', 'ARG', 'CPV'],
    ['r32_16', '1K', '3DEIJL'],
  ];
  const r32Matches = r32Pairs.map(([id, homeTeamCode, awayTeamCode]) => ({
    id,
    phase: 'r32',
    group: null,
    homeTeamCode,
    awayTeamCode,
    homeScore: null,
    awayScore: null,
    status: 'open',
    resultStatus: 'scheduled',
  }));

  return { matches: [...groupMatches, ...r32Matches], teams };
}
