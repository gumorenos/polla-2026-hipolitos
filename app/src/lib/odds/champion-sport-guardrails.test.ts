import { describe, expect, it } from 'vitest';
import {
  classifyChampionSport,
  isRecommendedChampionSportKey,
} from './champion-sport-guardrails';

describe('champion outright sport guardrails', () => {
  it('accepts a FIFA World Cup soccer outright market', () => {
    const result = classifyChampionSport({
      key: 'soccer_fifa_world_cup_winner',
      group: 'Soccer',
      title: 'FIFA World Cup Winner',
      description: 'FIFA World Cup outright winner',
      has_outrights: true,
    });
    expect(result.recommended).toBe(true);
    expect(isRecommendedChampionSportKey('soccer_fifa_world_cup_winner')).toBe(true);
  });

  it.each([
    'americanfootball_ncaaf_championship_winner',
    'americanfootball_college_championship_winner',
    'americanfootball_nfl_super_bowl_winner',
    'basketball_nba_championship_winner',
    'basketball_ncaab_championship_winner',
    'baseball_mlb_world_series_winner',
    'icehockey_nhl_championship_winner',
  ])('rejects non-soccer outright key %s', (key) => {
    expect(isRecommendedChampionSportKey(key)).toBe(false);
  });

  it('does not accept winner terminology without Soccer and FIFA World Cup signals', () => {
    const result = classifyChampionSport({
      key: 'golf_masters_tournament_winner',
      group: 'Golf',
      title: 'Masters Winner',
      description: 'Tournament champion outright',
      has_outrights: true,
    });
    expect(result.recommended).toBe(false);
  });

  it('rejects other soccer outright competitions', () => {
    const result = classifyChampionSport({
      key: 'soccer_epl_winner',
      group: 'Soccer',
      title: 'EPL Winner',
      description: 'English Premier League champion',
      has_outrights: true,
    });
    expect(result.recommended).toBe(false);
  });

  it('rejects FIFA World Cup qualifiers and alternate tournaments', () => {
    expect(isRecommendedChampionSportKey('soccer_fifa_world_cup_qualification')).toBe(false);
    expect(isRecommendedChampionSportKey('soccer_fifa_club_world_cup_winner')).toBe(false);
    expect(isRecommendedChampionSportKey('soccer_fifa_womens_world_cup_winner')).toBe(false);
  });
});
