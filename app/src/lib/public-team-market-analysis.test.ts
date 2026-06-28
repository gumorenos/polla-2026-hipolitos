import { describe, expect, it } from 'vitest';
import {
  classifyTeamPickType,
  collectRealTeamCodesFromSources,
  filterRealTeams,
  filterTeamMarketRows,
  sortTeamMarketRows,
  type TeamMarketAnalysisRow,
} from './public-team-market-analysis';

const row = (
  teamCode: string,
  pickCount: number,
  decimalOdds: number | null,
  expectedValue: number | null,
): TeamMarketAnalysisRow => ({
  teamCode,
  teamName: teamCode,
  status: 'active',
  pickCount,
  pickPercentage: pickCount / 10,
  classificationLabel: 'Sin clasificar',
  classificationKey: 'unclassified',
  marketProbability: decimalOdds === null ? null : 1 / decimalOdds,
  decimalOdds,
  simulatedProbability: decimalOdds === null ? null : 1 / decimalOdds,
  expectedValue,
  individualExpectedValue: expectedValue,
});

describe('public team market analysis', () => {
  it.each([
    { code: '1A', name: 'Ganador Grupo A' },
    { code: '2B', name: 'Segundo Grupo B' },
    { code: '3CEFHI', name: 'Tercero C/E/F/H/I' },
    { code: 'W100', name: 'Ganador Partido 100' },
    { code: 'RU101', name: 'Perdedor Partido 101' },
    { code: 'W101', name: 'Winner Match 101' },
    { code: 'ABC', name: 'Winner Group A' },
    { code: 'DEF', name: 'Group A Winner' },
    { code: 'GHI', name: 'Match 100 Winner' },
    { code: 'TBD', name: 'Por definir' },
  ])('excludes fixture placeholder $code', (team) => {
    expect(classifyTeamPickType(team)).not.toBe('real_team');
  });

  it('keeps real national teams even when their display name differs by provider language', () => {
    const teams = filterRealTeams([
      { code: 'BIH', name: 'Bosnia y Herzeg.' },
      { code: 'GER', name: 'Alemania' },
      { code: 'W100', name: 'Ganador Partido 100' },
    ]);
    expect(teams.map((team) => team.code)).toEqual(['BIH', 'GER']);
  });

  it('unions partial status data with other safe real-team sources', () => {
    const teams = [
      { code: 'ARG', name: 'Argentina' },
      { code: 'BRA', name: 'Brasil' },
      { code: 'W100', name: 'Ganador Partido 100' },
    ];
    const codes = collectRealTeamCodesFromSources(teams, [
      ['ARG'],
      ['BRA', 'W100'],
    ]);
    expect(Array.from(codes).sort()).toEqual(['ARG', 'BRA']);
  });

  it('does not include an unrelated real-looking catalog team without a safe source', () => {
    const teams = [
      { code: 'ARG', name: 'Argentina' },
      { code: 'BRA', name: 'Brasil' },
      { code: 'NGA', name: 'Nigeria' },
    ];
    const codes = collectRealTeamCodesFromSources(teams, [['ARG', 'BRA']]);
    expect(Array.from(codes).sort()).toEqual(['ARG', 'BRA']);
  });

  it('can keep an old pick visible without making it eligible for future writes', () => {
    const teams = [
      { code: 'ARG', name: 'Argentina' },
      { code: 'NGA', name: 'Nigeria' },
    ];
    const eligible = collectRealTeamCodesFromSources(teams, [['ARG']]);
    const visible = collectRealTeamCodesFromSources(teams, [eligible, ['NGA']]);
    expect(Array.from(eligible)).toEqual(['ARG']);
    expect(Array.from(visible).sort()).toEqual(['ARG', 'NGA']);
  });

  it('filters rows by picks, odds and positive expected value', () => {
    const rows = [row('ARG', 3, 4, 25), row('BRA', 0, 5, 0), row('BIH', 0, null, null)];
    expect(filterTeamMarketRows(rows, 'with_picks').map((item) => item.teamCode)).toEqual(['ARG']);
    expect(filterTeamMarketRows(rows, 'without_picks').map((item) => item.teamCode)).toEqual(['BRA', 'BIH']);
    expect(filterTeamMarketRows(rows, 'with_market_odds').map((item) => item.teamCode)).toEqual(['ARG', 'BRA']);
    expect(filterTeamMarketRows(rows, 'without_market_odds').map((item) => item.teamCode)).toEqual(['BIH']);
    expect(filterTeamMarketRows(rows, 'positive_ev').map((item) => item.teamCode)).toEqual(['ARG']);
  });

  it('sorts numeric columns without mutating the source', () => {
    const rows = [row('ARG', 1, 4, 10), row('BRA', 3, 5, 20)];
    const sorted = sortTeamMarketRows(rows, 'pickCount', 'desc');
    expect(sorted.map((item) => item.teamCode)).toEqual(['BRA', 'ARG']);
    expect(rows.map((item) => item.teamCode)).toEqual(['ARG', 'BRA']);
  });

  it('keeps null values last in both sort directions', () => {
    const rows = [row('BIH', 0, null, null), row('ARG', 1, 4, 10), row('BRA', 2, 5, 20)];
    expect(sortTeamMarketRows(rows, 'decimalOdds', 'asc').at(-1)?.teamCode).toBe('BIH');
    expect(sortTeamMarketRows(rows, 'decimalOdds', 'desc').at(-1)?.teamCode).toBe('BIH');
  });
});
