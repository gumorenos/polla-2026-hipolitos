export const THEME_SCHEME_COOKIE_NAME = 'polla_theme_scheme';
export const THEME_PALETTE_COOKIE_NAME = 'polla_theme_palette';

export const THEME_SCHEMES = [
  { value: 'default', label: 'Default' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'black', label: 'Black' },
] as const;

export const THEME_PALETTES = [
  { value: 'gold', label: 'Gold clásico', swatch: '#D4A843' },
  { value: 'midnight', label: 'Azul noche', swatch: '#55B7E8' },
  { value: 'pitch', label: 'Verde cancha', swatch: '#59C98A' },
  { value: 'worldcup', label: 'Rojo mundialista', swatch: '#D16068' },
  { value: 'premium', label: 'Púrpura premium', swatch: '#B994F4' },
] as const;

export type ThemeScheme = (typeof THEME_SCHEMES)[number]['value'];
export type ThemePalette = (typeof THEME_PALETTES)[number]['value'];

export type ThemePreferences = {
  scheme: ThemeScheme;
  palette: ThemePalette;
};

function isThemeScheme(value: string | null | undefined): value is ThemeScheme {
  return THEME_SCHEMES.some((option) => option.value === value);
}

function isThemePalette(value: string | null | undefined): value is ThemePalette {
  return THEME_PALETTES.some((option) => option.value === value);
}

function legacyThemeToScheme(value: string | null | undefined): ThemeScheme | null {
  if (value === 'light' || value === 'dark') return value;
  if (value === 'black') return 'default';
  return null;
}

export function parseThemePreferences(
  schemeValue: string | null | undefined,
  paletteValue: string | null | undefined,
  legacyThemeValue?: string | null,
): ThemePreferences {
  return {
    scheme: isThemeScheme(schemeValue)
      ? schemeValue
      : legacyThemeToScheme(legacyThemeValue) ?? 'default',
    palette: isThemePalette(paletteValue) ? paletteValue : 'gold',
  };
}

export function getLegacyThemeClass(scheme: ThemeScheme): string {
  return `theme-${scheme === 'default' ? 'black' : scheme}`;
}
