// packages/shell/src/i18n/use-localized-text-style.ts
import { useDirection } from './direction-context.tsx';
import { scriptFontFor } from './fonts.ts';
import { useLanguage } from './language-context.tsx';

import type { FontWeightToken } from './fonts.ts';
import type { Language } from './languages.ts';
import type { TextStyle } from 'react-native';

export type TextAlignToken = 'start' | 'center' | 'end';
export type LocalizedTextOptions = {
  readonly fontSize: number;
  readonly weight: FontWeightToken;
  readonly align: TextAlignToken;
  readonly language?: Language; // only for text in another language (language list)
};

// RN swaps 'left'/'right' when the layout is RTL (doLeftAndRightSwapInRTL), so
// 'left' means start. The default 'auto' stays physically left for an in-app RTL
// choice on an LTR phone (verified), so every text sets it explicitly.
export const TEXT_ALIGN = { start: 'left', center: 'center', end: 'right' } as const;

export function useLocalizedTextStyle(options: LocalizedTextOptions): TextStyle {
  const direction = useDirection();
  const appLanguage = useLanguage();
  const font = scriptFontFor(options.language ?? appLanguage, options.weight);
  return {
    ...(font.fontFamily === undefined ? {} : { fontFamily: font.fontFamily }),
    ...(font.fontWeight === undefined ? {} : { fontWeight: font.fontWeight }),
    fontSize: options.fontSize,
    lineHeight: Math.round(options.fontSize * font.lineHeightRatio),
    writingDirection: direction,
    textAlign: TEXT_ALIGN[options.align],
  };
}
