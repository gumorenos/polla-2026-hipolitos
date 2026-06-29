import { describe, expect, it } from 'vitest';
import {
  parseThemePreferences,
  THEME_PALETTES,
  THEME_SCHEMES,
} from './theme-preferences';

describe('cookie theme preferences', () => {
  it('uses the current design when cookies are absent or invalid', () => {
    expect(parseThemePreferences(undefined, undefined)).toEqual({
      scheme: 'default',
      palette: 'gold',
    });
    expect(parseThemePreferences('sepia', 'neon')).toEqual({
      scheme: 'default',
      palette: 'gold',
    });
  });

  it('accepts every supported scheme and palette', () => {
    expect(THEME_SCHEMES.map((option) => option.value)).toEqual([
      'default',
      'light',
      'dark',
      'black',
    ]);
    expect(THEME_PALETTES.map((option) => option.value)).toEqual([
      'gold',
      'midnight',
      'pitch',
      'worldcup',
      'premium',
    ]);
    expect(parseThemePreferences('light', 'pitch')).toEqual({
      scheme: 'light',
      palette: 'pitch',
    });
  });

  it('keeps the legacy profile theme as a safe fallback', () => {
    expect(parseThemePreferences(undefined, undefined, 'dark')).toEqual({
      scheme: 'dark',
      palette: 'gold',
    });
    expect(parseThemePreferences(undefined, undefined, 'black')).toEqual({
      scheme: 'default',
      palette: 'gold',
    });
  });
});
