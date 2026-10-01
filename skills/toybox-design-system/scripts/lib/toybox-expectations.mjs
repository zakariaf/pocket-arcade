// toybox-expectations.mjs: turns the skill's Toybox token file (assets/toybox-tokens.json) into the
// exact values the app's theme modules must hold. Used by check-design-system.mjs and write-palette.mjs.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The skill folder: this file is scripts/lib/toybox-expectations.mjs. */
const SKILL_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const TOKENS_PATH = join(SKILL_DIR, 'assets', 'toybox-tokens.json');

export function loadTokens(path = TOKENS_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** The 16 ColorTokens fields, in the order the templates write them. */
export const COLOR_FIELDS = [
  'background', 'surface', 'sunken', 'text', 'textMuted', 'primary', 'onPrimary', 'pop', 'onPop',
  'border', 'shadow', 'danger', 'focus', 'icon', 'starOn', 'starOff',
];

/** Game id in the app repo (kebab-case folder) -> key in the token file (camelCase). */
export function tokenGameKey(appId) {
  return appId.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

export function knownGames(tokens) {
  return Object.keys(tokens.color.games).map((key) => key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`));
}

/** ColorTokens for one scheme from the six-plus-five paints of a game and the Shell constants. */
export function colorTokensFromPaint(paint, shell) {
  return {
    background: paint.ground,
    surface: paint.surface,
    sunken: paint.sunken,
    text: paint.ink,
    textMuted: paint.inkSoft,
    primary: paint.accent,
    onPrimary: paint.onAccent,
    pop: paint.pop,
    onPop: paint.onPop,
    border: paint.outline,
    shadow: paint.shadow,
    danger: shell.danger,
    focus: shell.focus,
    icon: paint.ink,
    starOn: shell.star,
    starOff: paint.inkSoft,
  };
}

export function expectedPalette(tokens, appId) {
  const game = tokens.color.games[tokenGameKey(appId)];
  if (!game) return null;
  return {
    light: colorTokensFromPaint(game.light, tokens.color.shell.light),
    dark: colorTokensFromPaint(game.dark, tokens.color.shell.dark),
  };
}

/** SHELL_COLORS[scheme] as packages/shell/src/theme/shell-colors.ts writes it. */
export function expectedShellColors(tokens) {
  const out = {};
  for (const scheme of ['light', 'dark']) {
    const s = tokens.color.shell[scheme];
    out[scheme] = {
      success: s.success,
      warning: s.warning,
      dangerFill: s.dangerFill,
      gold: s.gold,
      cut: s.cut,
      toyInk: tokens.color.toyInk,
      toastBackground: s.toastBg,
      toastText: s.toastInk,
      scrim: s.scrim,
      line: s.line,
      adBackground: s.adBg,
      adLine: s.adLine,
      adText: s.adInk,
    };
  }
  return out;
}

/**
 * The width a CSS border is drawn with in the Toybox references. They are Chrome renders at
 * deviceScaleFactor 3, and Chrome floors a border of 1 px or more to whole CSS px (2.5 -> 2,
 * 1.5 -> 1); every .layout.json style and every parity measurement shows the floored width. Only
 * values the mockup draws as a CSS border go through this; icon strokes, box-shadow rings (the
 * sticker's 3.5) and Skia strokes keep their token values.
 */
export function asRenderedBorder(width) {
  return width >= 1 ? Math.floor(width) : width;
}

/** A table of border widths (STROKE), each as rendered. */
export function asRenderedBorders(widths) {
  return Object.fromEntries(Object.entries(widths).map(([key, width]) => [key, asRenderedBorder(width)]));
}

/**
 * Component text styles the mockup CSS draws but the token file does not list. Each entry says
 * where the mockup draws it; TYPE_STYLES must hold exactly these on top of the token file's styles.
 */
export const TYPE_STYLE_OVERRIDES = {
  // `.row.strong .rl` and `.row.danger .rl`: the row label (17, 1.32 / 1.5) in Bold. Danger rows
  // used the button label role (1.25), 1.2 pt shorter than the references per line.
  rowLabelStrong: { fontSize: 17, weight: 'bold', face: 'text', lineHeight: { latin: 1.32, arabic: 1.5 } },
  // `.slist>div:first-child`: the stat list's heading row ("Best score") is the key's 15 pt in Bold,
  // not the 17 pt label role (S10 measured the heading 2 pt too tall).
  statListHeading: { fontSize: 15, weight: 'bold', face: 'text', lineHeight: { latin: 1.32, arabic: 1.5 } },
};

/**
 * Stat values use tabular figures (the mockup's `.sv`: font-variant-numeric tabular-nums): the
 * TYPE_SCALE role and the TYPE_STYLES entries below carry `isTabular: true`, which AppText maps to
 * fontVariant ['tabular-nums']. Persian digits were proportional without it (ink 12 vs 20.3 pt).
 */
export const TABULAR_ROLES = ['number'];
export const TABULAR_STYLES = ['statValueCompact'];

/**
 * Display numbers whose Persian line box must hold Vazirmatn's tall digits: iOS clips a Text at its
 * frame where Chrome lets the glyphs overflow. Lead decisions L2 (level tiles) and L9 (scores).
 */
export const PERSIAN_NUMBER_MIN_LINE_HEIGHT = { levelNumber: 1.45, scoreValue: 1.45 };

export function expectedScales(tokens) {
  return {
    SPACING: tokens.spacing.scale,
    LAYOUT: tokens.spacing.layout,
    RADII: tokens.radii.scale,
    // STROKE widths are borders: as rendered (tile 2.5 -> 2). Icon strokes are not in STROKE.
    STROKE: asRenderedBorders(tokens.stroke.scale),
    ELEVATION: {
      flat: tokens.elevation.scale.flat,
      knob: tokens.elevation.component.toggleKnob,
      tile: tokens.elevation.scale.tile,
      iconButton: tokens.elevation.component.iconButton,
      control: tokens.elevation.scale.control,
      hero: tokens.elevation.scale.hero,
      dialog: tokens.elevation.scale.dialog,
    },
    MIN_TOUCH: tokens.layout.minTouch,
    CONTENT_MAX_WIDTH: tokens.layout.contentMaxWidth,
  };
}

function weightOf(style) {
  if (style.face !== 'text' && !String(style.face).startsWith('text')) return 'bold';
  return style.weight === 700 ? 'bold' : 'regular';
}

function faceOf(name, style) {
  if (name === 'gameName') return 'brand';
  return String(style.face).startsWith('text') ? 'text' : 'display';
}

/** TYPE_SCALE as tokens.ts writes it. */
export function expectedTypeScale(tokens) {
  const out = {};
  for (const [role, spec] of Object.entries(tokens.type.roles)) {
    out[role] = {
      fontSize: spec.size,
      weight: spec.latin.face === 'display' ? 'bold' : spec.latin.weight === 700 ? 'bold' : 'regular',
      face: spec.latin.face === 'display' ? 'display' : 'text',
      lineHeight: { latin: spec.latin.lineHeight, arabic: spec.arabic.lineHeight },
    };
  }
  return out;
}

/** Names for the size variants of a component text style. */
const SIZE_VARIANT_NAMES = {
  gameName: { home: 'gameNameHome', splash: 'gameNameSplash', about: 'gameNameAbout' },
  sticker: { regular: 'sticker', sm: 'stickerSm', xs: 'stickerXs' },
  segmentLabel: { regular: 'segmentLabel', inRow: 'segmentLabelInRow' },
  optionName: { languageChoice: 'optionNameChoice', languageList: 'optionNameList' },
};

/** TYPE_STYLES as type-styles.ts writes it: one entry per component text style and size. */
export function expectedTypeStyles(tokens) {
  const out = {};
  for (const [name, style] of Object.entries(tokens.type.styles)) {
    const base = {
      weight: weightOf(style),
      face: faceOf(name, style),
      lineHeight: { latin: style.lineHeight, arabic: style.arabicLineHeight },
      ...(style.letterSpacingEm ? { letterSpacingEm: style.letterSpacingEm } : {}),
      // A token underline ({ thickness, offset }, the nudge) is drawn by QuietButton as a 2 pt bar,
      // never by iOS's textDecorationLine (1 pt at its own depth), so no style is isUnderlined.
    };
    if (typeof style.size === 'number') {
      out[name] = { fontSize: style.size, ...base };
      continue;
    }
    for (const [variant, size] of Object.entries(style.size)) {
      const variantName = SIZE_VARIANT_NAMES[name]?.[variant] ?? `${name}${variant[0].toUpperCase()}${variant.slice(1)}`;
      out[variantName] = { fontSize: size, ...base };
    }
  }
  return { ...out, ...TYPE_STYLE_OVERRIDES };
}

/** The five font files every app embeds, with the shared font folder names. */
export const APP_FONT_FILES = [
  'LilitaOne.ttf',
  'Rubik-Regular.ttf',
  'Rubik-Bold.ttf',
  'Vazirmatn-Regular.ttf',
  'Vazirmatn-Bold.ttf',
];

/**
 * LOGO_TILE_VARIANTS (ui/logo-tile.tsx) as the token file's components.logoTile defines it: the
 * base border and tilt, each variant's size, and its own border, ring, tilt, drop and cut edge.
 */
export function expectedLogoTileVariants(tokens) {
  const tile = tokens.components.logoTile;
  const out = {};
  for (const [name, size] of Object.entries(tile.sizes)) {
    const own = tile[name] ?? {};
    out[name] = {
      size,
      // The edge is a CSS border in the mockup (as rendered); the ring is a box-shadow (token value).
      edgeWidth: asRenderedBorder(typeof own.border === 'number' ? own.border : tile.border),
      ring: own.ring ?? 0,
      rotateDeg: own.rotate ?? tile.rotate,
      translateY: own.translateY ?? 0,
      // A toy-ink edge is the die-cut look (About): the border is ink, not the theme outline.
      isCut: own.border === 'toyInk',
    };
  }
  return out;
}
