import { describe, expect, it } from 'vitest';
import {
  calculateGroupStandings,
  calculateWorldCupQualification,
  rankThirdPlacedTeams,
  type GroupStanding,
  type QualificationMatchLike,
  type QualificationTeamLike,
} from './fifa-qualification';

const groupATeams: QualificationTeamLike[] = [
  { code: 'A1', name: 'A Uno' },
  { code: 'A2', name: 'A Dos' },
  { code: 'A3', name: 'A Tres' },
  { code: 'A4', name: 'A Cuatro' },
];

function match(
  id: string,
  group: string,
  homeTeamCode: string,
  awayTeamCode: string,
  homeScore: number,
  awayScore: number
): QualificationMatchLike {
  return {
    id,
    phase: 'groups',
    group,
    homeTeamCode,
    awayTeamCode,
    homeScore,
    awayScore,
    status: 'result',
    resultStatus: 'final',
  };
}

function completeGroup(group: string, teams: string[], thirdWins = true): QualificationMatchLike[] {
  const [first, second, third, fourth] = teams;
  return [
    match(`${group}-1`, group, first, second, 2, 0),
    match(`${group}-2`, group, first, third, 2, 0),
    match(`${group}-3`, group, first, fourth, 2, 0),
    match(`${group}-4`, group, second, third, 1, 0),
    match(`${group}-5`, group, second, fourth, 2, 0),
    match(`${group}-6`, group, third, fourth, thirdWins ? 1 : 0, 0),
  ];
}

describe('FIFA 2026 qualification engine', () => {
  it('ranks a normal group by points and qualifies the top two', () => {
    const qualification = calculateWorldCupQualification(
      [
        match('a1', 'A', 'A1', 'A2', 2, 0),
        match('a2', 'A', 'A1', 'A3', 1, 0),
        match('a3', 'A', 'A1', 'A4', 1, 1),
        match('a4', 'A', 'A2', 'A3', 2, 0),
        match('a5', 'A', 'A2', 'A4', 1, 1),
        match('a6', 'A', 'A3', 'A4', 3, 0),
      ],
      groupATeams
    );

    expect(qualification.groups[0].entries.map((entry) => entry.teamCode)).toEqual(['A1', 'A2', 'A3', 'A4']);
    expect(qualification.statusByTeam.A1).toBe('group_winner');
    expect(qualification.statusByTeam.A2).toBe('group_runner_up');
  });

  it('uses head-to-head points before overall goal difference for tied teams', () => {
    const standings = calculateGroupStandings(
      [
        match('a1', 'A', 'A1', 'A2', 0, 1),
        match('a2', 'A', 'A1', 'A3', 4, 0),
        match('a3', 'A', 'A1', 'A4', 1, 0),
        match('a4', 'A', 'A2', 'A3', 1, 0),
        match('a5', 'A', 'A2', 'A4', 0, 2),
        match('a6', 'A', 'A3', 'A4', 0, 0),
      ],
      groupATeams
    );

    expect(standings[0].entries[0].teamCode).toBe('A2');
    expect(standings[0].entries[1].teamCode).toBe('A1');
  });

  it('falls through to overall goal difference after head-to-head remains tied', () => {
    const standings = calculateGroupStandings(
      [
        match('a1', 'A', 'A1', 'A2', 1, 1),
        match('a2', 'A', 'A1', 'A3', 4, 0),
        match('a3', 'A', 'A1', 'A4', 1, 0),
        match('a4', 'A', 'A2', 'A3', 1, 0),
        match('a5', 'A', 'A2', 'A4', 1, 0),
        match('a6', 'A', 'A3', 'A4', 0, 0),
      ],
      groupATeams
    );

    expect(standings[0].entries[0].teamCode).toBe('A1');
    expect(standings[0].entries[1].teamCode).toBe('A2');
  });

  it('uses overall goals scored when goal difference is still tied', () => {
    const standings = calculateGroupStandings(
      [
        match('a1', 'A', 'A1', 'A2', 1, 1),
        match('a2', 'A', 'A1', 'A3', 3, 1),
        match('a3', 'A', 'A1', 'A4', 1, 0),
        match('a4', 'A', 'A2', 'A3', 2, 0),
        match('a5', 'A', 'A2', 'A4', 1, 0),
        match('a6', 'A', 'A3', 'A4', 0, 0),
      ],
      groupATeams
    );

    expect(standings[0].entries[0].teamCode).toBe('A1');
    expect(standings[0].entries[1].teamCode).toBe('A2');
  });

  it('marks unresolved ties when fair play or FIFA ranking is needed but unavailable', () => {
    const standings = calculateGroupStandings(
      [
        match('a1', 'A', 'A1', 'A2', 1, 1),
        match('a2', 'A', 'A1', 'A3', 1, 0),
        match('a3', 'A', 'A1', 'A4', 0, 0),
        match('a4', 'A', 'A2', 'A3', 1, 0),
        match('a5', 'A', 'A2', 'A4', 0, 0),
        match('a6', 'A', 'A3', 'A4', 0, 0),
      ],
      groupATeams
    );

    expect(standings[0].entries[0].unresolvedTiebreaker).toBe(true);
    expect(standings[0].entries[0].unresolvedReason).toBe('Desempate pendiente por criterio FIFA no disponible.');
  });

  it('ranks third-placed teams and marks the eight best as qualified', () => {
    const groups = Array.from({ length: 12 }, (_, index) => {
      const group = String.fromCharCode(65 + index);
      const teams = [`${group}1`, `${group}2`, `${group}3`, `${group}4`];
      return completeGroup(group, teams, index < 8);
    }).flat();
    const teams = Array.from({ length: 12 }, (_, index) => {
      const group = String.fromCharCode(65 + index);
      return [1, 2, 3, 4].map((slot) => ({ code: `${group}${slot}`, name: `${group}${slot}` }));
    }).flat();

    const qualification = calculateWorldCupQualification(groups, teams);

    expect(qualification.thirdPlacedTeams).toHaveLength(12);
    expect(qualification.thirdPlacedTeams.slice(0, 8).every((entry) => entry.status === 'third_place_qualified')).toBe(true);
    expect(qualification.thirdPlacedTeams.slice(8).every((entry) => entry.status === 'eliminated')).toBe(true);
  });

  it('keeps third-place cutoff pending when the eighth and ninth teams need unavailable tiebreakers', () => {
    const groups = Array.from({ length: 12 }, (_, index) => {
      const group = String.fromCharCode(65 + index);
      const teams = [`${group}1`, `${group}2`, `${group}3`, `${group}4`];
      return completeGroup(group, teams, index < 9);
    }).flat();
    const teams = Array.from({ length: 12 }, (_, index) => {
      const group = String.fromCharCode(65 + index);
      return [1, 2, 3, 4].map((slot) => ({ code: `${group}${slot}`, name: `${group}${slot}` }));
    }).flat();

    const qualification = calculateWorldCupQualification(groups, teams);

    expect(qualification.thirdPlacedTeams[7].status).toBe('third_place_pending');
    expect(qualification.thirdPlacedTeams[8].status).toBe('third_place_pending');
  });

  it('keeps partial groups pending instead of overclaiming qualification', () => {
    const standings = calculateGroupStandings(
      [
        match('a1', 'A', 'A1', 'A2', 2, 0),
        match('a2', 'A', 'A3', 'A4', 1, 0),
      ],
      groupATeams
    );

    expect(standings[0].complete).toBe(false);
    expect(standings[0].entries.every((entry) => entry.status === 'pending')).toBe(true);
  });

  it('returns conservative TeamTournamentStatus suggestions', () => {
    const qualification = calculateWorldCupQualification(completeGroup('A', ['A1', 'A2', 'A3', 'A4'], true), groupATeams);

    expect(qualification.teamTournamentStatusSuggestions.A1).toBe('active');
    expect(qualification.teamTournamentStatusSuggestions.A4).toBe('eliminated');
  });

  it('can rank third places directly from group standings', () => {
    const group: GroupStanding = {
      group: 'A',
      complete: true,
      playedMatches: 6,
      totalMatches: 6,
      unresolvedTies: [],
      entries: calculateGroupStandings(completeGroup('A', ['A1', 'A2', 'A3', 'A4'], true), groupATeams)[0].entries,
    };

    expect(rankThirdPlacedTeams([group])[0].teamCode).toBe('A3');
  });
});
