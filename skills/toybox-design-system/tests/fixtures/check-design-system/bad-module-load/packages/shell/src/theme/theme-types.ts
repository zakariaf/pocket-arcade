// packages/shell/src/theme/theme-types.ts
export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | ColorScheme;
export type ColorMode = 'standard' | 'colorBlind';

/**
 * Semantic colour tokens (Toybox). Each game's palette fills every token for every mode and scheme.
 * Paint names from the Toybox mockup are in brackets.
 */
export type ColorTokens = {
  /** [ground] The painted wash behind every screen. */
  readonly background: string;
  /** [surface] Panels, lists, keys, buttons, tiles, dialogs. */
  readonly surface: string;
  /** [sunken] Pushed-in, disabled and empty fills: tracks, locked tiles, disabled buttons. */
  readonly sunken: string;
  /** [ink] Body text. */
  readonly text: string;
  /** [inkSoft] Muted text, values, chevrons, disabled text and dashed edges. */
  readonly textMuted: string;
  /** [accent] "Go" fills: hero key, primary buttons, current tile, toggles that are on. */
  readonly primary: string;
  /** [onAccent] Text and icons on accent. */
  readonly onPrimary: string;
  /** [pop] Second game paint: icon tiles, group tabs, the Premium key. */
  readonly pop: string;
  /** [onPop] Text and icons on pop. */
  readonly onPop: string;
  /** [outline] Every control and panel edge. */
  readonly border: string;
  /** [shadow] Hard offset shadow under raised controls; never blurred. */
  readonly shadow: string;
  /** Shell constant: destructive text, icons and edges (only ever on surface). */
  readonly danger: string;
  /** Shell constant: focus ring, 3 pt wide, 2 pt away from the control. */
  readonly focus: string;
  /** [ink] Icons. */
  readonly icon: string;
  /** Shell constant: filled stars. */
  readonly starOn: string;
  /** [inkSoft] Hollow stars. */
  readonly starOff: string;
};

export type Palette = Readonly<Record<ColorMode, Readonly<Record<ColorScheme, ColorTokens>>>>;

/** Fonts are not in the theme: AppText picks them from the language of each text. */
export type Theme = {
  readonly key: string;
  readonly scheme: ColorScheme;
  readonly mode: ColorMode;
  readonly colors: ColorTokens;
};
