import { describe, expect, it } from 'vitest';
import {
  normalizeTeamAlias,
  resolveProviderTeamAliasFromData,
  type TeamAliasRecord,
  type TeamAliasTeam,
} from './team-alias';

const teams: TeamAliasTeam[] = [
  { code: 'BIH', name: 'Bosnia y Herzeg.' },
  { code: 'USA', name: 'Estados Unidos' },
];

describe('team provider aliases', () => {
  it('normalizes Bosnia variants consistently', () => {
    const variants = [
      'Bosnia and Herzegovina',
      'Bosnia & Herzegovina',
      'Bosnia-Herzegovina',
      'Bosnia Herzegovina',
    ];
    expect(new Set(variants.map(normalizeTeamAlias))).toEqual(new Set(['bosnia herzegovina']));
  });

  it('maps default Bosnia variants to BIH', () => {
    const result = resolveProviderTeamAliasFromData(
      'the-odds-api',
      'Bosnia & Herzegovina',
      teams,
      [],
    );
    expect(result.matched).toBe(true);
    expect(result.teamCode).toBe('BIH');
  });

  it('returns unmatched without applying fuzzy guesses', () => {
    const result = resolveProviderTeamAliasFromData('the-odds-api', 'Bosnia Select XI', teams, []);
    expect(result.matched).toBe(false);
    expect(result.status).toBe('unmatched');
  });

  it('does not silently resolve an ambiguous alias', () => {
    const aliases: TeamAliasRecord[] = [
      { provider: 'provider-x', teamCode: 'BIH', alias: 'United', normalizedAlias: 'united' },
      { provider: 'provider-x', teamCode: 'USA', alias: 'United', normalizedAlias: 'united' },
    ];
    const result = resolveProviderTeamAliasFromData('provider-x', 'United', teams, aliases);
    expect(result.matched).toBe(false);
    expect(result.status).toBe('ambiguous');
  });
});
