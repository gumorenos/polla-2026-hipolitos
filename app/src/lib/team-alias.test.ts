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

  it('uses a persisted global alias for The Odds API', () => {
    const aliases: TeamAliasRecord[] = [
      {
        provider: '*',
        teamCode: 'BIH',
        alias: 'Bosnia Herzegovina',
        normalizedAlias: 'bosnia herzegovina',
      },
    ];
    const result = resolveProviderTeamAliasFromData(
      'the-odds-api',
      'Bosnia Herzegovina',
      teams,
      aliases,
    );
    expect(result.matched).toBe(true);
    expect(result.teamCode).toBe('BIH');
    expect(result.reason).toBe('Alias normalizado global.');
  });

  it('prefers a provider-specific alias over a global alias', () => {
    const aliases: TeamAliasRecord[] = [
      { provider: '*', teamCode: 'USA', alias: 'Bosnia', normalizedAlias: 'bosnia' },
      { provider: 'the-odds-api', teamCode: 'BIH', alias: 'Bosnia', normalizedAlias: 'bosnia' },
    ];
    const result = resolveProviderTeamAliasFromData('the-odds-api', 'Bosnia', teams, aliases);
    expect(result.matched).toBe(true);
    expect(result.teamCode).toBe('BIH');
    expect(result.reason).toBe('Alias exacto del proveedor.');
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
