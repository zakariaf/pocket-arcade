// packages/shell/src/i18n/use-localized-text-style.ts
import { PixelRatio } from 'react-native';

import { snapToGrid } from '@e07/shell/theme/type-styles.ts';

import { useDirection } from './direction-context.tsx';
import { DEFAULT_LINE_HEIGHTS, scriptFontFor } from './fonts.ts';
import { useLanguage } from './language-context.tsx';

import type { FontWeightToken, LineHeightRatios, TypeFace } from './fonts.ts';
import type { Language } from './languages.ts';
import type { TextStyle } from 'react-native';

export type TextAlignToken = 'start' | 'center' | 'end';
export type LocalizedTextOptions = {
  readonly fontSize: number;
  readonly weight: FontWeightToken;
  readonly align: TextAlignToken;
  /** Toybox face; default 'text' (Rubik / Vazirmatn). */
  readonly face?: TypeFace;
  /** Line-height ratios of the type role or style; default: the face's defaults. */
  readonly lineHeight?: LineHeightRatios;
  /** Tracking in em; Toybox tracks only the game name (0.01 em), never Arabic script. */
  readonly letterSpacingEm?: number;
  readonly language?: Language; // only for text in another language (language list)
};

// RN swaps 'left'/'right' when the layout is RTL (doLeftAndRightSwapInRTL), so
// 'left' means start. The default 'auto' stays physically left for an in-app RTL
// choice on an LTR phone (verified), so every text sets it explicitly.
export const TEXT_ALIGN = { start: 'left', center: 'center', end: 'right' } as const;

/**
 * A length on this device's pixel grid (the nearest whole pixel). React Native rounds every
 * measured text box UP to whole pixels, so a fractional line height (17 x 1.32 = 22.44) grew each
 * line by up to 1/3 pt, and whole points (26 for 25.5) by up to 0.5 pt; on the grid a text box is
 * exactly lines x lineHeight. At 3x: 18.2 -> 55/3, 22.44 -> 67/3, 25.5 -> 77/3.
 */
export function snapToPixels(points: number): number {
  return snapToGrid(points, PixelRatio.get());
}

export function useLocalizedTextStyle(options: LocalizedTextOptions): TextStyle {
  const direction = useDirection();
  const appLanguage = useLanguage();
  const face = options.face ?? 'text';
  const font = scriptFontFor(options.language ?? appLanguage, options.weight, face);
  const ratios = options.lineHeight ?? DEFAULT_LINE_HEIGHTS[face];
  const ratio = font.isArabicScript ? ratios.arabic : ratios.latin;
  const tracking = font.isArabicScript ? 0 : (options.letterSpacingEm ?? 0);
  return {
    fontFamily: font.fontFamily,
    fontSize: options.fontSize,
    // Never Math.round to whole points, and never nudge glyphs with padding or translateY here.
    lineHeight: Math.round(options.fontSize * ratio),
    ...(tracking === 0 ? {} : { letterSpacing: options.fontSize * tracking }),
    writingDirection: direction,
    textAlign: TEXT_ALIGN[options.align],
  };
}
