import { describe, expect, it } from 'vitest';
import {
  buildSurvivalSummary,
  buildChampionSurvivalTable,
  calculateChampionProbability,
  calculateIndividualExpectedValue,
  calculatePrizePool,
  classifyChampionPick,
  findConflictingChampionTeamCode,
  getChampionPickStatus,
  getChampionSurvivalRoundLabel,
  isChampionDeadlinePassed,
  resolveCompetitionType,
  simulateChampionOdds,
  sortChampionSurvivorRanking,
  deriveSurvivalEliminationMatchId,
} from './champion-survivor';

describe('Champion Survivor business logic', () => {
  it('orders the survival table by round and preserves tied positions', () => {
    const rows = buildChampionSurvivalTable([
      { userId: 'u-groups', displayName: 'Grupos', teamCode: 'A', teamName: 'A', teamStatus: { teamCode: 'A', status: 'eliminated', eliminatedAt: null, eliminatedInMatchId: 'gA1' } },
      { userId: 'u-alive', displayName: 'Vivo', teamCode: 'B', teamName: 'B', teamStatus: { teamCode: 'B', status: 'active', eliminatedAt: null } },
      { userId: 'u-qf-1', displayName: 'Cuartos A', teamCode: 'C', teamName: 'C', teamStatus: { teamCode: 'C', status: 'eliminated', eliminatedAt: null, eliminatedInMatchId: 'qf_01' } },
      { userId: 'u-qf-2', displayName: 'Cuartos B', teamCode: 'D', teamName: 'D', teamStatus: { teamCode: 'D', status: 'eliminated', eliminatedAt: null, eliminatedInMatchId: 'qf_02' } },
      { userId: 'u-winner', displayName: 'Ganador', teamCode: 'E', teamName: 'E', teamStatus: { teamCode: 'E', status: 'champion', eliminatedAt: null, finalRank: 1 } },
      { userId: 'u-none', displayName: 'Sin Pick', teamCode: null, teamName: null },
    ]);

    expect(rows.map((row) => row.userId)).toEqual(['u-winner', 'u-alive', 'u-qf-1', 'u-qf-2', 'u-groups', 'u-none']);
    expect(rows.find((row) => row.userId === 'u-qf-1')?.position).toBe(3);
    expect(rows.find((row) => row.userId === 'u-qf-2')?.position).toBe(3);
    expect(rows.at(-1)?.statusLabel).toBe('Sin selección');
  });
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
    expect(getChampionPickStatus(pick, { teamCode: 'PER', status: 'runner_up' })).toBe('eliminated');
    expect(getChampionPickStatus(pick, { teamCode: 'PER', status: 'champion' })).toBe('winner');
  });

  it('detects a conflicting second champion in the same league state', () => {
    const statuses = [
      { teamCode: 'ARG', status: 'champion' },
      { teamCode: 'BRA', status: 'runner_up' },
    ];
    expect(findConflictingChampionTeamCode(statuses, 'FRA')).toBe('ARG');
    expect(findConflictingChampionTeamCode(statuses, 'ARG')).toBeNull();
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
    expect(calculatePrizePool({ currency: 'PEN', entryFee: 20 }, 7)).toEqual({
      amount: 140,
      estimated: true,
      currency: 'PEN',
    });

    expect(calculatePrizePool({ currency: 'PEN', entryFee: 20, prizePoolOverride: 500 }, 7)).toEqual({
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

  it('calculates individual expected value by splitting prize pool EV across same-team picks', () => {
    expect(calculateIndividualExpectedValue(1000, 0.2, 4)).toBe(50);
    expect(calculateIndividualExpectedValue(1000, null, 4)).toBeNull();
    expect(calculateIndividualExpectedValue(1000, 0.2, 0)).toBeNull();
  });

  it('classifies champion picks with the explicit market and sharing taxonomy', () => {
    const classify = (
      probability: number | null,
      pickCount: number,
      pickPercentage = 0.1,
      status?: string,
      popularityRank?: number,
    ) => classifyChampionPick({ probability, pickCount, pickPercentage, status, popularityRank });

    expect(classify(0.12, 1, 0.1, undefined, 1).label).toBe('Favorito diferencial');
    expect(classify(0.12, 2, 0.14).label).toBe('Favorito compartido');
    expect(classify(0.03, 1).label).toBe('Longshot exclusivo');
    expect(classify(0.03, 2).label).toBe('Longshot compartido');
    expect(classify(0.07, 1).label).toBe('Pick de mercado medio');
    expect(classify(0.07, 3, 0.2).label).toBe('Pick concentrado');
    expect(classify(0.12, 0, 0).label).toBe('Sin picks');
    expect(classify(null, 1).label).toBe('Pick sin cuota');
    expect(classify(0.12, 1, 0.1, 'eliminated').label).toBe('Fuera de carrera');
    expect(classify(0.12, 1, 0.1, 'runner_up').label).toBe('Fuera de carrera');
    expect(classify(0.07, 1, 0.1, undefined, 1).key).toBe('medium_market_pick');
  });

  it('normalizes outright champion implied probabilities for simulation', () => {
    const result = simulateChampionOdds({
      iterations: 1000,
      seed: 7,
      teamStatuses: [],
      oddsSnapshots: [
        { teamCode: 'ARG', decimalOdds: 2, impliedProbability: 0.5, sourceMarket: 'outright_winner' },
        { teamCode: 'BRA', decimalOdds: 4, impliedProbability: 0.25, sourceMarket: 'outright_winner' },
      ],
    });

    expect(result.available).toBe(true);
    expect(result.resolved).toBe(false);
    expect(result.entries.find((entry) => entry.teamCode === 'ARG')?.normalizedProbability).toBeCloseTo(2 / 3);
    expect(result.entries.find((entry) => entry.teamCode === 'BRA')?.normalizedProbability).toBeCloseTo(1 / 3);
  });

  it('excludes eliminated teams from champion odds simulation', () => {
    const result = simulateChampionOdds({
      iterations: 100,
      seed: 9,
      teamStatuses: [{ teamCode: 'BRA', status: 'eliminated' }],
      oddsSnapshots: [
        { teamCode: 'ARG', decimalOdds: 2, impliedProbability: 0.5, sourceMarket: 'outright_winner' },
        { teamCode: 'BRA', decimalOdds: 2, impliedProbability: 0.5, sourceMarket: 'outright_winner' },
      ],
    });

    expect(result.available).toBe(true);
    expect(result.resolved).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].teamCode).toBe('ARG');
    expect(result.entries[0].simulatedProbability).toBe(1);
  });

  it('excludes the runner-up from champion odds simulation', () => {
    const result = simulateChampionOdds({
      iterations: 100,
      seed: 10,
      teamStatuses: [{ teamCode: 'BRA', status: 'runner_up' }],
      oddsSnapshots: [
        { teamCode: 'ARG', decimalOdds: 2, impliedProbability: 0.5, sourceMarket: 'outright_winner' },
        { teamCode: 'BRA', decimalOdds: 2, impliedProbability: 0.5, sourceMarket: 'outright_winner' },
      ],
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].teamCode).toBe('ARG');
    expect(result.entries[0].simulatedProbability).toBe(1);
  });

  it('resolves champion status deterministically in champion odds simulation', () => {
    const result = simulateChampionOdds({
      iterations: 100,
      seed: 11,
      teamStatuses: [{ teamCode: 'FRA', status: 'champion' }],
      oddsSnapshots: [],
    });

    expect(result.available).toBe(true);
    expect(result.resolved).toBe(true);
    expect(result.entries).toEqual([{
      teamCode: 'FRA',
      teamName: null,
      decimalOdds: null,
      rawImpliedProbability: null,
      normalizedProbability: 1,
      simulatedWins: 100,
      simulatedProbability: 1,
      status: 'champion',
      provider: null,
      bookmaker: null,
      capturedAt: null,
    }]);
  });

  it('sets other valid odds teams to zero when champion status is resolved', () => {
    const result = simulateChampionOdds({
      leagueId: 'league-a',
      iterations: 100,
      teamStatuses: [{ teamCode: 'FRA', status: 'champion' }],
      oddsSnapshots: [
        { teamCode: 'FRA', decimalOdds: 3, impliedProbability: 1 / 3, sourceMarket: 'outright_winner' },
        { teamCode: 'ARG', decimalOdds: 4, impliedProbability: 0.25, sourceMarket: 'outright_winner' },
      ],
      teamNames: { FRA: 'Francia', ARG: 'Argentina' },
    });

    expect(result.resolved).toBe(true);
    expect(result.entries.find((entry) => entry.teamCode === 'FRA')?.simulatedProbability).toBe(1);
    expect(result.entries.find((entry) => entry.teamCode === 'ARG')?.simulatedProbability).toBe(0);
    expect(result.entries.find((entry) => entry.teamCode === 'ARG')?.teamName).toBe('Argentina');
  });

  it('returns unavailable simulation when no outright champion odds exist', () => {
    const result = simulateChampionOdds({
      teamStatuses: [],
      oddsSnapshots: [
        { teamCode: 'ARG', decimalOdds: 2, impliedProbability: 0.5, sourceMarket: 'match_winner' },
      ],
    });

    expect(result.available).toBe(false);
    expect(result.entries).toEqual([]);
    expect(result.message).toBe('Simulación no disponible porque no hay cuotas de campeón cargadas.');
  });

  it('skips invalid decimal odds in champion odds simulation', () => {
    const result = simulateChampionOdds({
      iterations: 100,
      teamStatuses: [],
      oddsSnapshots: [
        { teamCode: 'ARG', decimalOdds: 1, impliedProbability: 1, sourceMarket: 'outright_winner' },
        { teamCode: 'BRA', decimalOdds: 0, impliedProbability: 0, sourceMarket: 'outright_winner' },
        { teamCode: 'FRA', decimalOdds: 4, impliedProbability: 0.25, sourceMarket: 'outright_winner' },
      ],
    });

    expect(result.available).toBe(true);
    expect(result.resolved).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].teamCode).toBe('FRA');
    expect(result.entries[0].simulatedProbability).toBe(1);
  });

  it('derives stable simulation results from league and latest odds capture when seed is omitted', () => {
    const input = {
      leagueId: 'league-a',
      iterations: 1000,
      teamStatuses: [],
      oddsSnapshots: [
        {
          teamCode: 'ARG',
          teamName: 'Argentina',
          decimalOdds: 2,
          impliedProbability: 0.5,
          sourceMarket: 'outright_winner',
          capturedAt: '2026-06-26T12:00:00.000Z',
        },
        {
          teamCode: 'BRA',
          teamName: 'Brasil',
          decimalOdds: 4,
          impliedProbability: 0.25,
          sourceMarket: 'outright_winner',
          capturedAt: '2026-06-26T12:00:00.000Z',
        },
      ],
    };

    const first = simulateChampionOdds(input);
    const second = simulateChampionOdds(input);

    expect(first.entries.map((entry) => entry.simulatedWins)).toEqual(
      second.entries.map((entry) => entry.simulatedWins)
    );
    expect(first.entries[0].teamName).toBe('Argentina');
  });

  it('keeps deterministic simulated probabilities close to normalized probabilities', () => {
    const result = simulateChampionOdds({
      iterations: 10000,
      seed: 2026,
      teamStatuses: [],
      oddsSnapshots: [
        { teamCode: 'ARG', decimalOdds: 2, impliedProbability: 0.5, sourceMarket: 'outright_winner' },
        { teamCode: 'BRA', decimalOdds: 4, impliedProbability: 0.25, sourceMarket: 'outright_winner' },
      ],
    });

    const arg = result.entries.find((entry) => entry.teamCode === 'ARG');
    const bra = result.entries.find((entry) => entry.teamCode === 'BRA');
    expect(arg?.simulatedProbability).toBeCloseTo(arg?.normalizedProbability ?? 0, 1);
    expect(bra?.simulatedProbability).toBeCloseTo(bra?.normalizedProbability ?? 0, 1);
  });

  it('correctly normalizes survivor round labels and resolves ties for same round eliminations', () => {
    const table = buildChampionSurvivalTable([
      {
        userId: 'u-jpn',
        displayName: 'Diego',
        teamCode: 'JPN',
        teamName: 'Japón',
        teamStatus: { teamCode: 'JPN', status: 'eliminated', eliminatedAt: null, eliminatedInMatchId: 'r32_02' },
      },
      {
        userId: 'u-ned',
        displayName: 'Bolo',
        teamCode: 'NED',
        teamName: 'Países Bajos',
        teamStatus: { teamCode: 'NED', status: 'eliminated', eliminatedAt: null, eliminatedInMatchId: 'r32_04' },
      },
      {
        userId: 'u-missing-round',
        displayName: 'User Missing',
        teamCode: 'ARG',
        teamName: 'Argentina',
        teamStatus: { teamCode: 'ARG', status: 'eliminated', eliminatedAt: null, eliminatedInMatchId: null },
      },
      {
        userId: 'u-alive',
        displayName: 'Vivo User',
        teamCode: 'BRA',
        teamName: 'Brasil',
        teamStatus: { teamCode: 'BRA', status: 'active', eliminatedAt: null },
      },
      {
        userId: 'u-none',
        displayName: 'Sin Pick',
        teamCode: null,
        teamName: null,
      },
    ]);

    const jpnRow = table.find((r) => r.userId === 'u-jpn');
    const nedRow = table.find((r) => r.userId === 'u-ned');
    const missingRow = table.find((r) => r.userId === 'u-missing-round');
    const aliveRow = table.find((r) => r.userId === 'u-alive');
    const noneRow = table.find((r) => r.userId === 'u-none');

    // Labels check
    expect(jpnRow?.roundLabel).toBe('16avos de final');
    expect(nedRow?.roundLabel).toBe('16avos de final');
    expect(missingRow?.roundLabel).toBe('Fase de grupos');
    expect(aliveRow?.roundLabel).toBe('En competencia');
    expect(noneRow?.roundLabel).toBe('Sin selección');

    expect(jpnRow?.position).toBe(2); // BRA (1st, weight 90), JPN/NED (2nd, weight 40)
    // Sort order: BRA (90), JPN/NED (40), ARG (30), None (0).
    // Positions: BRA (pos 1), JPN (pos 2), NED (pos 2), ARG (pos 4), None (pos 5).
    // Let's check positions of sorted array:
    const positions = table.map((r) => ({ userId: r.userId, pos: r.position, weight: r.sortWeight }));
    expect(positions).toEqual([
      { userId: 'u-alive', pos: 1, weight: 90 },
      { userId: 'u-ned', pos: 2, weight: 40 },
      { userId: 'u-jpn', pos: 2, weight: 40 },
      { userId: 'u-missing-round', pos: 4, weight: 30 },
      { userId: 'u-none', pos: 5, weight: 0 },
    ]);
  });

  describe('getChampionSurvivalRoundLabel', () => {
    it('returns Campeón for champion status or finalRank=1', () => {
      expect(getChampionSurvivalRoundLabel('champion', null)).toBe('Campeón');
      expect(getChampionSurvivalRoundLabel('eliminated', null, 1)).toBe('Campeón');
    });

    it('returns En competencia for active or unknown status', () => {
      expect(getChampionSurvivalRoundLabel('active', null)).toBe('En competencia');
      expect(getChampionSurvivalRoundLabel('unknown', 'r32_01')).toBe('En competencia');
    });

    it('returns Final for runner_up or finalRank=2', () => {
      expect(getChampionSurvivalRoundLabel('runner_up', null)).toBe('Final');
      expect(getChampionSurvivalRoundLabel('eliminated', null, 2)).toBe('Final');
    });

    it('returns default fallback when matchId is absent and status is eliminated', () => {
      expect(getChampionSurvivalRoundLabel('eliminated', null)).toBe('Fase de grupos');
      expect(getChampionSurvivalRoundLabel('eliminated', undefined)).toBe('Fase de grupos');
    });

    it('uses latest phase fallback when matchId is absent but latest phase is provided', () => {
      expect(getChampionSurvivalRoundLabel('eliminated', null, null, 'quarters')).toBe('Cuartos de final');
      expect(getChampionSurvivalRoundLabel('eliminated', undefined, null, 'semis')).toBe('Semifinal');
    });

    it('maps groups / g-prefix match IDs to Fase de grupos', () => {
      expect(getChampionSurvivalRoundLabel('eliminated', 'groups')).toBe('Fase de grupos');
      expect(getChampionSurvivalRoundLabel('eliminated', 'gA1')).toBe('Fase de grupos');
      expect(getChampionSurvivalRoundLabel('eliminated', 'G_B3')).toBe('Fase de grupos');
    });

    it('maps r32 match IDs to 16avos de final', () => {
      expect(getChampionSurvivalRoundLabel('eliminated', 'r32_02')).toBe('16avos de final');
      expect(getChampionSurvivalRoundLabel('eliminated', 'r32_04')).toBe('16avos de final');
      expect(getChampionSurvivalRoundLabel('eliminated', 'R32')).toBe('16avos de final');
    });

    it('maps r16 match IDs to Octavos de final', () => {
      expect(getChampionSurvivalRoundLabel('eliminated', 'r16_01')).toBe('Octavos de final');
      expect(getChampionSurvivalRoundLabel('eliminated', 'R16_03')).toBe('Octavos de final');
    });

    it('maps quarters/qf match IDs to Cuartos de final', () => {
      expect(getChampionSurvivalRoundLabel('eliminated', 'qf_01')).toBe('Cuartos de final');
      expect(getChampionSurvivalRoundLabel('eliminated', 'quarters')).toBe('Cuartos de final');
      expect(getChampionSurvivalRoundLabel('eliminated', 'quarter_01')).toBe('Cuartos de final');
    });

    it('maps semis/sf match IDs to Semifinal', () => {
      expect(getChampionSurvivalRoundLabel('eliminated', 'sf_01')).toBe('Semifinal');
      expect(getChampionSurvivalRoundLabel('eliminated', 'semis')).toBe('Semifinal');
      expect(getChampionSurvivalRoundLabel('eliminated', 'semi_02')).toBe('Semifinal');
    });

    it('maps third place match IDs to Tercer puesto', () => {
      expect(getChampionSurvivalRoundLabel('eliminated', 'third_place')).toBe('Tercer puesto');
      expect(getChampionSurvivalRoundLabel('eliminated', 'third_01')).toBe('Tercer puesto');
      expect(getChampionSurvivalRoundLabel('eliminated', '3rd_place')).toBe('Tercer puesto');
    });

    it('maps final match IDs to Final', () => {
      expect(getChampionSurvivalRoundLabel('eliminated', 'final')).toBe('Final');
      expect(getChampionSurvivalRoundLabel('eliminated', 'final_01')).toBe('Final');
      expect(getChampionSurvivalRoundLabel('eliminated', 'fi_01')).toBe('Final');
    });

    it('returns fallback for unrecognized match IDs', () => {
      expect(getChampionSurvivalRoundLabel('eliminated', 'unknown_match_xyz')).toBe('Fase de grupos');
    });

    describe('deriveSurvivalEliminationMatchId', () => {
      const mockMatches = [
        { id: 'groups_01', phase: 'groups', homeTeamCode: 'MEX', awayTeamCode: 'SWE', winnerTeamCode: 'SWE' },
        { id: 'r32_01', phase: 'r32', homeTeamCode: 'MEX', awayTeamCode: 'GER', winnerTeamCode: 'GER' },
        { id: 'r16_02', phase: 'r16', homeTeamCode: 'BRA', awayTeamCode: 'ARG', winnerTeamCode: 'BRA' },
      ];

      it('derives correct loss match ID for a team in knockout stage', () => {
        expect(deriveSurvivalEliminationMatchId('MEX', mockMatches)).toBe('r32_01');
        expect(deriveSurvivalEliminationMatchId('ARG', mockMatches)).toBe('r16_02');
      });

      it('returns null if the team did not participate in a knockout match or did not lose', () => {
        expect(deriveSurvivalEliminationMatchId('SWE', mockMatches)).toBeNull();
        expect(deriveSurvivalEliminationMatchId('GER', mockMatches)).toBeNull();
        expect(deriveSurvivalEliminationMatchId('BRA', mockMatches)).toBeNull();
      });
    });
  });
});
