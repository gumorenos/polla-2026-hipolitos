'use client';

import { useState } from 'react';
import { Palette } from 'lucide-react';
import {
  getLegacyThemeClass,
  THEME_PALETTE_COOKIE_NAME,
  THEME_PALETTES,
  THEME_SCHEME_COOKIE_NAME,
  THEME_SCHEMES,
  type ThemePalette,
  type ThemePreferences,
  type ThemeScheme,
} from '../../lib/theme-preferences';

type ThemePreferenceSwitcherProps = {
  initialPreferences: ThemePreferences;
};

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function persistCookie(name: string, value: string) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function applyScheme(scheme: ThemeScheme) {
  document.documentElement.dataset.themeScheme = scheme;
  document.documentElement.classList.remove('theme-black', 'theme-dark', 'theme-light');
  document.documentElement.classList.add(getLegacyThemeClass(scheme));
}

export function ThemePreferenceSwitcher({ initialPreferences }: ThemePreferenceSwitcherProps) {
  const [scheme, setScheme] = useState<ThemeScheme>(initialPreferences.scheme);
  const [palette, setPalette] = useState<ThemePalette>(initialPreferences.palette);

  const selectScheme = (nextScheme: ThemeScheme) => {
    setScheme(nextScheme);
    applyScheme(nextScheme);
    persistCookie(THEME_SCHEME_COOKIE_NAME, nextScheme);
  };

  const selectPalette = (nextPalette: ThemePalette) => {
    setPalette(nextPalette);
    document.documentElement.dataset.themePalette = nextPalette;
    persistCookie(THEME_PALETTE_COOKIE_NAME, nextPalette);
  };

  return (
    <section className="flex flex-col gap-3 border-b border-border-subtle pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2 text-text-secondary">
        <Palette className="h-4 w-4 text-gold-400" aria-hidden="true" />
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">Apariencia</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Esquema visual">
          {THEME_SCHEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={scheme === option.value}
              onClick={() => selectScheme(option.value)}
              className={`rounded-md border px-2.5 py-1.5 text-[10px] font-mono font-semibold transition-colors ${
                scheme === option.value
                  ? 'border-gold-500 bg-gold-400/15 text-gold-400'
                  : 'border-border-default bg-bg-secondary/40 text-text-secondary hover:border-border-active hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Paleta de color">
          {THEME_PALETTES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={palette === option.value}
              onClick={() => selectPalette(option.value)}
              title={option.label}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-mono font-semibold transition-colors ${
                palette === option.value
                  ? 'border-gold-500 bg-gold-400/15 text-text-primary'
                  : 'border-border-default bg-bg-secondary/40 text-text-secondary hover:border-border-active hover:text-text-primary'
              }`}
            >
              <span
                className="h-3 w-3 rounded-full border border-black/15"
                style={{ backgroundColor: option.swatch }}
                aria-hidden="true"
              />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
