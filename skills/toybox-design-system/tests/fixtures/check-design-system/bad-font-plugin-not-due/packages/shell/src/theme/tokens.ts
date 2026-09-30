// packages/shell/src/theme/tokens.ts
import type { FontWeightToken, LineHeightRatios, TypeFace } from '@e07/shell/i18n/fonts.ts';

/** 4-point spacing scale shared by every game (spec 8.12). */
export const SPACING = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Toybox layout steps off the 4-point scale: gutters, block gaps and page paddings (pt). */
export const LAYOUT = {
  screenGutter: 20,
  blockGap: 14,
  bodyPaddingTop: 6,
  bodyPaddingBottom: 34,
  topBarPaddingInline: 16,
  gameTopBarPaddingInline: 14,
  panelPaddingBlock: 14,
  panelPaddingInline: 16,
  settingsGroupGap: 20,
  longPageGap: 18,
  statsPageGap: 16,
} as const;
/** Toybox radii: blocky, never pills; 14 is the largest control radius. */
export const RADII = { xs: 6, sm: 10, md: 14, lg: 22 } as const;
/**
 * Outline widths as rendered: separators (hair), tiles and stickers (tile), controls and panels
 * (bold). The token file's tile stroke is 2.5, but the Toybox references are Chrome renders, and
 * Chrome floors a CSS border of 1 px or more to whole px (2.5 -> 2), so every reference and every
 * parity measurement shows 2. Borders use the as-rendered width; icon strokes, die-cut rings and
 * Skia strokes keep their token values.
 */
export const STROKE = { hair: 2, tile: 2, bold: 3 } as const;
/** Hard-shadow offsets in pt; a pressed control sinks by the same amount. */
export const ELEVATION = {
  flat: 0,
  knob: 2,
  tile: 3,
  iconButton: 4,
  control: 5,
  hero: 6,
  dialog: 8,
} as const;
/** Apple HIG default control size: 44 x 44 pt. */
export const MIN_TOUCH = 44;
/** Menus never grow wider than this; wider windows centre the column. */
export const CONTENT_MAX_WIDTH = 640;

export type TypeRole = 'display' | 'title' | 'number' | 'heading' | 'body' | 'label' | 'caption';
export type TypeStyle = {
  readonly fontSize: number;
  readonly weight: FontWeightToken;
  readonly face: TypeFace;
  readonly lineHeight: LineHeightRatios;
  /** Only the game name is tracked (0.01 em). */
  readonly letterSpacingEm?: number;
  /** Quiet buttons and nudges are underlined. */
  readonly isUnderlined?: boolean;
};

/** Toybox type roles, in pt before Dynamic Type. Latin / Arabic-script line heights per role. */
export const TYPE_SCALE: Readonly<Record<TypeRole, TypeStyle>> = {
  display: {
    fontSize: 38,
    weight: 'bold',
    face: 'display',
    lineHeight: { latin: 1.1, arabic: 1.45 },
  },
  title: {
    fontSize: 30,
    weight: 'bold',
    face: 'display',
    lineHeight: { latin: 1.1, arabic: 1.45 },
  },
  number: {
    fontSize: 30,
    weight: 'bold',
    face: 'display',
    lineHeight: { latin: 1.1, arabic: 1.1 },
  },
  heading: {
    fontSize: 21,
    weight: 'bold',
    face: 'display',
    lineHeight: { latin: 1.1, arabic: 1.45 },
  },
  body: { fontSize: 17, weight: 'regular', face: 'text', lineHeight: { latin: 1.32, arabic: 1.5 } },
  label: { fontSize: 17, weight: 'bold', face: 'text', lineHeight: { latin: 1.25, arabic: 1.45 } },
  caption: {
    fontSize: 13,
    weight: 'regular',
    face: 'text',
    lineHeight: { latin: 1.4, arabic: 1.6 },
  },
};
