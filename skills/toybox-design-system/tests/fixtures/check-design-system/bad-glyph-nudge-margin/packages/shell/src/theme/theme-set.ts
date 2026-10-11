// packages/shell/src/theme/theme-set.ts
import type { ColorMode, ColorScheme, Palette, Theme, ThemePreference } from './theme-types.ts';
import type { ColorSchemeName } from 'react-native';

export type ThemeSelector = { readonly scheme: ColorScheme; readonly mode: ColorMode };
export type ThemeSet = ReadonlyMap<string, Theme>;

const SCHEMES: readonly ColorScheme[] = ['light', 'dark'];
const MODES: readonly ColorMode[] = ['standard', 'colorBlind'];

function themeKey({ scheme, mode }: ThemeSelector): string {
  return `${mode}.${scheme}`;
}

/** Builds the 4 themes once at startup, so every Theme object has a stable identity. */
export function createThemeSet(palette: Palette): ThemeSet {
  const themes = new Map<string, Theme>();
  for (const scheme of SCHEMES) {
    for (const mode of MODES) {
      const key = themeKey({ scheme, mode });
      themes.set(key, { key, scheme, mode, colors: palette[mode][scheme] });
    }
  }
  return themes;
}

export function selectTheme(themes: ThemeSet, selector: ThemeSelector): Theme {
  const theme = themes.get(themeKey(selector));
  if (theme === undefined) throw new Error(`Missing theme ${themeKey(selector)}`);
  return theme;
}

export function resolveColorScheme(
  preference: ThemePreference,
  system: ColorSchemeName | null | undefined,
): ColorScheme {
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
