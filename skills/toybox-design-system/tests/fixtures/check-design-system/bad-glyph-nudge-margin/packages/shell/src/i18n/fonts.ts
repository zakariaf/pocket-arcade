// packages/shell/src/i18n/fonts.ts
import type { Language } from './languages.ts';

export type FontWeightToken = 'regular' | 'bold';
/**
 * display: Lilita One in en/de, Vazirmatn Bold in fa/ckb (titles, headings, numbers, keys).
 * text:    Rubik Regular/Bold in en/de, Vazirmatn Regular/Bold in fa/ckb (body, labels, captions).
 * brand:   Lilita One in every language (game names only; isolate them LTR).
 */
export type TypeFace = 'display' | 'text' | 'brand';
/** Line height as a multiple of the font size, per script (Toybox type roles). */
export type LineHeightRatios = { readonly latin: number; readonly arabic: number };
export type ScriptFont = { readonly fontFamily: string; readonly isArabicScript: boolean };

/**
 * Family names = file names = PostScript names, so one string works on iOS and Android.
 * The expo-font plugin embeds the five TTFs; never combine fontWeight with these families.
 */
export const FONT_FAMILIES = {
  display: 'LilitaOne',
  textRegular: 'Rubik-Regular',
  textBold: 'Rubik-Bold',
  arabicRegular: 'Vazirmatn-Regular',
  arabicBold: 'Vazirmatn-Bold',
} as const;

/** Defaults when a style gives no line heights: display 1.1 / 1.45, text 1.32 / 1.5. */
export const DEFAULT_LINE_HEIGHTS: Readonly<Record<TypeFace, LineHeightRatios>> = {
  display: { latin: 1.1, arabic: 1.45 },
  text: { latin: 1.32, arabic: 1.5 },
  brand: { latin: 1.05, arabic: 1.05 },
};

export function isArabicScript(language: Language): boolean {
  return language === 'fa' || language === 'ckb';
}

function arabicFamily(weight: FontWeightToken, face: TypeFace): string {
  return face === 'display' || weight === 'bold'
    ? FONT_FAMILIES.arabicBold
    : FONT_FAMILIES.arabicRegular;
}

function latinFamily(weight: FontWeightToken, face: TypeFace): string {
  if (face !== 'text') return FONT_FAMILIES.display;
  return weight === 'bold' ? FONT_FAMILIES.textBold : FONT_FAMILIES.textRegular;
}

/** Font follows the language of the TEXT (autonyms in the language list use their own). */
export function scriptFontFor(
  language: Language,
  weight: FontWeightToken,
  face: TypeFace = 'text',
): ScriptFont {
  if (face === 'brand') return { fontFamily: FONT_FAMILIES.display, isArabicScript: false };
  if (isArabicScript(language)) {
    return { fontFamily: arabicFamily(weight, face), isArabicScript: true };
  }
  return { fontFamily: latinFamily(weight, face), isArabicScript: false };
}
