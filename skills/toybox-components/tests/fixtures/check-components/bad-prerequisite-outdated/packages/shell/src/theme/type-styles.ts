// packages/shell/src/theme/type-styles.ts
import { TYPE_SCALE } from './tokens.ts';

import type { TypeRole, TypeStyle } from './tokens.ts';
import type { FontWeightToken } from '@e07/shell/i18n/fonts.ts';

/** [Latin, Arabic-script] line-height ratios. */
type Ratios = readonly [number, number];

/** Lilita One in en/de, Vazirmatn Bold in fa/ckb. */
function display(fontSize: number, [latin, arabic]: Ratios): TypeStyle {
  return { fontSize, weight: 'bold', face: 'display', lineHeight: { latin, arabic } };
}

/** Rubik in en/de, Vazirmatn in fa/ckb, at the same size and weight. */
function text(fontSize: number, weight: FontWeightToken, [latin, arabic]: Ratios): TypeStyle {
  return { fontSize, weight, face: 'text', lineHeight: { latin, arabic } };
}

/** Game names: Lilita One in every language, tracked +0.01 em, isolated LTR by AppText. */
function brand(fontSize: number): TypeStyle {
  return {
    fontSize,
    weight: 'bold',
    face: 'brand',
    lineHeight: { latin: 1.05, arabic: 1.05 },
    letterSpacingEm: 0.01,
  };
}

/**
 * Toybox component text styles (pt before Dynamic Type). Components pick one of these or a
 * TYPE_SCALE role, never a raw size. Colour, alignment and wrapping belong to the component.
 */
export const TYPE_STYLES = {
  gameNameHome: brand(28),
  gameNameSplash: brand(50),
  gameNameAbout: brand(34),
  topBarTitle: display(27, [1.1, 1.45]),
  heroKeyLabel: display(25, [1.1, 1.45]),
  dialogTitle: display(25, [1.1, 1.45]),
  /** Colour onPop. */
  groupTab: display(15, [1.1, 1.45]),
  levelNumber: display(21, [1, 1.45]),
  scoreValue: display(44, [1, 1]),
  /** No wrap. */
  statValueCompact: display(23, [1.1, 1.1]),
  /** Align end. */
  statListValue: display(22, [1.1, 1.1]),
  streakValue: display(28, [1.1, 1.45]),
  gameTopBarScore: display(24, [1.1, 1.45]),
  /** Colour onPrimary. */
  calendarMonth: display(16, [1.4, 1.4]),
  calendarDay: display(42, [1.15, 1.15]),
  /** Colour toyInk. */
  sticker: display(16, [1.15, 1.45]),
  stickerSm: display(14, [1.15, 1.45]),
  stickerXs: display(12, [1.15, 1.45]),
  chip: text(15, 'bold', [1.3, 1.5]),
  /** Colour textMuted on secondary, onPop on pop. */
  rowButtonDescription: text(14, 'regular', [1.3, 1.5]),
  keyLabel: text(15, 'bold', [1.2, 1.4]),
  toggleKeyLabel: text(14, 'bold', [1.2, 1.45]),
  toggleKeyState: text(13, 'regular', [1.2, 1.45]),
  segmentLabel: text(15, 'bold', [1.2, 1.45]),
  segmentLabelInRow: text(14, 'bold', [1.2, 1.45]),
  segmentPreview: text(13, 'regular', [1.2, 1.45]),
  rowLabel: text(17, 'regular', [1.32, 1.5]),
  /** Colour textMuted. */
  rowDescription: text(14, 'regular', [1.3, 1.5]),
  /** Colour textMuted; align end. */
  rowValue: text(15, 'regular', [1.32, 1.5]),
  /** Colour textMuted. */
  subRowLabel: text(14, 'regular', [1.32, 1.5]),
  /** Each autonym in its own script: pass language to AppText. */
  optionNameChoice: text(21, 'bold', [1.3, 1.5]),
  optionNameList: text(18, 'bold', [1.3, 1.5]),
  lead: text(18, 'regular', [1.32, 1.5]),
  /** S11c policy paragraphs. */
  prose: text(16, 'regular', [1.5, 1.75]),
  /** Colour toastInk. */
  toast: text(15, 'regular', [1.35, 1.55]),
  /** Underline 2 pt, offset 5. */
  nudge: { ...text(15, 'regular', [1.25, 1.45]), isUnderlined: true },
  /** Colour textMuted. */
  scoreLabel: text(17, 'bold', [1.32, 1.5]),
  scoreLines: text(16, 'regular', [1.32, 1.5]),
  /** Colour textMuted. */
  statLabel: text(14, 'regular', [1.3, 1.5]),
  statListKey: text(15, 'regular', [1.32, 1.5]),
  /** Colour textMuted. */
  streakLabel: text(14, 'bold', [1.32, 1.5]),
  packProgress: text(15, 'bold', [1.32, 1.5]),
  /** Colour textMuted. */
  weekdayLetter: text(13, 'bold', [1.2, 1.5]),
  /** Colour toyInk. */
  weekTodayTag: text(11, 'bold', [1.3, 1.3]),
  /** Colour text. */
  barValue: text(13, 'bold', [1.2, 1.2]),
  /** Colour textMuted. */
  barDay: text(13, 'bold', [1.3, 1.5]),
  /** Colour textMuted. */
  legend: text(14, 'regular', [1.32, 1.5]),
  /** Colour textMuted. */
  rule: text(15, 'regular', [1.32, 1.5]),
  /** Colour textMuted. */
  settingsFooter: text(14, 'regular', [1.32, 1.5]),
  /** Colour textMuted; align center; max width 290. */
  splashTagline: text(18, 'regular', [1.32, 1.5]),
  gameTopBarLevel: text(16, 'bold', [1.32, 1.5]),
  /** Colour textMuted. */
  gameTopBarProgress: text(13, 'regular', [1.32, 1.5]),
  /** Colour adBg on adInk. */
  adChip: text(11, 'bold', [1.3, 1.3]),
  /** Colour adInk. */
  adSize: text(12, 'regular', [1, 1]),
} satisfies Readonly<Record<string, TypeStyle>>;

export type TypeStyleName = keyof typeof TYPE_STYLES;
/** Every name AppText accepts as `variant`: a type role or a component text style. */
export type TypeVariant = TypeRole | TypeStyleName;

const TYPE_VARIANTS: Readonly<Record<TypeVariant, TypeStyle>> = { ...TYPE_SCALE, ...TYPE_STYLES };

export function typeStyleOf(variant: TypeVariant): TypeStyle {
  return TYPE_VARIANTS[variant];
}
