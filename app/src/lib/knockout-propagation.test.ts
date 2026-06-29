import { describe, expect, it } from 'vitest';
import { buildKnockoutPropagationPlan } from './knockout-propagation';

describe('knockout propagation', () => {
  it('maps final r32 winners into the configured r16 slots without mutating matches', () => {
    const matches = [
      finalMatch('r32_01', 'RSA', 'CAN', 'RSA'),
      finalMatch('r32_03', 'GER', 'PAR', 'PAR'),
      pendingMatch('r16_01', 'W73', 'W75'),
    ];
    const original = structuredClone(matches);
    const plan = buildKnockoutPropagationPlan(matches);

    expect(matches).toEqual(original);
    expect(plan.proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({ matchId: 'r16_01', side: 'home', resolvedTeamCode: 'RSA', changed: true }),
      expect.objectContaining({ matchId: 'r16_01', side: 'away', resolvedTeamCode: 'PAR', changed: true }),
    ]));
  });

  it('backfills the production r32_01 result as CAN into r16_01 home', () => {
    const plan = buildKnockoutPropagationPlan([
      finalMatch('r32_01', 'RSA', 'CAN', 'CAN'),
      pendingMatch('r16_01', 'W73', 'W75'),
    ]);
    expect(findResolved(plan, 'r16_01', 'home')).toBe('CAN');
    expect(plan.proposals.find((proposal) => (
      proposal.matchId === 'r16_01' && proposal.side === 'away'
    ))).toBeUndefined();
  });

  it('uses the complete official r32 winner-slot mapping', () => {
    const winners = Array.from({ length: 16 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`);
    const sources = winners.map((winner, index) => (
      finalMatch(`r32_${String(index + 1).padStart(2, '0')}`, winner, `L${String(index + 1).padStart(2, '0')}`, winner)
    ));
    const targets = [
      pendingMatch('r16_01', 'W73', 'W75'),
      pendingMatch('r16_02', 'W74', 'W77'),
      pendingMatch('r16_03', 'W76', 'W78'),
      pendingMatch('r16_04', 'W79', 'W80'),
      pendingMatch('r16_05', 'W83', 'W84'),
      pendingMatch('r16_06', 'W81', 'W82'),
      pendingMatch('r16_07', 'W86', 'W88'),
      pendingMatch('r16_08', 'W85', 'W87'),
    ];
    const plan = buildKnockoutPropagationPlan([...sources, ...targets]);
    const resolved = Object.fromEntries(plan.proposals.map((proposal) => [
      `${proposal.matchId}.${proposal.side}`,
      proposal.resolvedTeamCode,
    ]));
    expect(resolved).toEqual({
      'r16_01.home': 'T01', 'r16_01.away': 'T03',
      'r16_02.home': 'T02', 'r16_02.away': 'T05',
      'r16_03.home': 'T04', 'r16_03.away': 'T06',
      'r16_04.home': 'T07', 'r16_04.away': 'T08',
      'r16_05.home': 'T11', 'r16_05.away': 'T12',
      'r16_06.home': 'T09', 'r16_06.away': 'T10',
      'r16_07.home': 'T14', 'r16_07.away': 'T16',
      'r16_08.home': 'T13', 'r16_08.away': 'T15',
    });
  });

  it('routes semifinal winners to the final and losers to third place', () => {
    const matches = [
      finalMatch('sf_01', 'ARG', 'BRA', 'ARG'),
      finalMatch('sf_02', 'FRA', 'GER', 'GER'),
      pendingMatch('3rd', 'RU101', 'RU102'),
      pendingMatch('final', 'W101', 'W102'),
    ];
    const plan = buildKnockoutPropagationPlan(matches);

    expect(findResolved(plan, '3rd', 'home')).toBe('BRA');
    expect(findResolved(plan, '3rd', 'away')).toBe('FRA');
    expect(findResolved(plan, 'final', 'home')).toBe('ARG');
    expect(findResolved(plan, 'final', 'away')).toBe('GER');
  });

  it('does not overwrite an already materialized conflicting team', () => {
    const plan = buildKnockoutPropagationPlan([
      finalMatch('r32_01', 'RSA', 'CAN', 'RSA'),
      pendingMatch('r16_01', 'BRA', 'W75'),
    ]);
    expect(plan.conflicts).toEqual([
      expect.objectContaining({ matchId: 'r16_01', currentTeamCode: 'BRA', resolvedTeamCode: 'RSA' }),
    ]);
  });
});

function finalMatch(id: string, homeTeamCode: string, awayTeamCode: string, winnerTeamCode: string) {
  return {
    id,
    phase: id.startsWith('r32') ? 'r32' : 'semis',
    homeTeamCode,
    awayTeamCode,
    homeScore: winnerTeamCode === homeTeamCode ? 2 : 0,
    awayScore: winnerTeamCode === awayTeamCode ? 2 : 0,
    resultStatus: 'final',
    winnerTeamCode,
  };
}

function pendingMatch(id: string, homeTeamCode: string, awayTeamCode: string) {
  return {
    id,
    phase: id === 'final' ? 'final' : id === '3rd' ? 'semis' : 'r16',
    homeTeamCode,
    awayTeamCode,
    homeScore: null,
    awayScore: null,
    resultStatus: 'scheduled',
    winnerTeamCode: null,
  };
}

function findResolved(
  plan: ReturnType<typeof buildKnockoutPropagationPlan>,
  matchId: string,
  side: 'home' | 'away',
) {
  return plan.proposals.find((proposal) => proposal.matchId === matchId && proposal.side === side)?.resolvedTeamCode;
}
