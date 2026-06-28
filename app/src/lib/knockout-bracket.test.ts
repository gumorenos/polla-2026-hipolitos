import { describe, expect, it } from 'vitest';
import {
  buildRoundOf32Resolution,
  resolveDirectGroupPlaceholder,
  resolveThirdPlacePlaceholderAssignments,
} from './knockout-bracket';
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

  it('resolves a unique third-place assignment', () => {
    const result = resolveThirdPlacePlaceholderAssignments(
      ['3ABCDF'],
      new Map([['C', 'COL']]),
    );
    expect(result.resolved).toBe(true);
    expect(result.assignments.get('3ABCDF')).toBe('COL');
  });

  it('keeps ambiguous third-place assignments unresolved', () => {
    const result = resolveThirdPlacePlaceholderAssignments(
      ['3AB', '3BA'],
      new Map([['A', 'ARG'], ['B', 'BRA']]),
    );
    expect(result.resolved).toBe(false);
  });
});
