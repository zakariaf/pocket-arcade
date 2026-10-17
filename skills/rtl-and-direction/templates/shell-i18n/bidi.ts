// packages/shell/src/i18n/bidi.ts
// U+2068 FIRST STRONG ISOLATE ... U+2069 POP DIRECTIONAL ISOLATE.
export const FSI = '\u2068';
export const PDI = '\u2069';

// Isolates an interpolated string so its own direction cannot reorder the sentence.
export function isolate(text: string): string {
  return `${FSI}${text}${PDI}`;
}

// Removes isolates, e.g. before comparing text in tests or copying to the clipboard.
export function stripIsolates(text: string): string {
  return text.replaceAll(FSI, '').replaceAll(PDI, '');
}

// Marks drawn as nothing: ALM, ZWJ, LRM, RLM, the four isolates and the BOM. Text measuring (the
// balanced wrap's word breaks) looks through them; only this file spells bidi controls out.
const INVISIBLE_MARK = /[؜‍‎‏⁦-⁩﻿]/u;

/** True for a character drawn as nothing (a bidi mark or isolate, a joiner, the BOM). */
export function isInvisibleMark(char: string): boolean {
  return INVISIBLE_MARK.test(char);
}

// U+200F RIGHT-TO-LEFT MARK: a strong right-to-left character drawn as nothing.
export const RLM = '\u200F';

const STRONG_RTL =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;
const ISOLATE_START = /[\u2066-\u2068]/u;
// One number reads the same in either paragraph direction: digits and decimal or group marks.
const SINGLE_NUMBER = /^[\p{Nd}.,\u066B\u066C]*$/u;

function directionOfChar(char: string): 'ltr' | 'rtl' | null {
  if (char === '\u200E') return 'ltr';
  if (char === RLM || char === '\u061C') return 'rtl';
  if (!/\p{L}/u.test(char)) return null;
  return STRONG_RTL.test(char) ? 'rtl' : 'ltr';
}

/**
 * The direction of the first strong letter outside isolates (Unicode's first-strong rule, as
 * Android's TextDirectionHeuristics reads it): 'rtl', 'ltr', or null for a text of digits, signs
 * and isolates only.
 */
export function firstStrongDirection(text: string): 'ltr' | 'rtl' | null {
  let depth = 0;
  for (const char of text) {
    if (ISOLATE_START.test(char)) depth += 1;
    else if (char === PDI) depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const direction = directionOfChar(char);
      if (direction !== null) return direction;
    }
  }
  return null;
}

/**
 * A right-to-left paragraph for a text without a strong letter outside isolates ("۲۸ / ۲۷۰", a
 * date of isolated names): React Native's prepared text layout on Android reads such a text left
 * to right, where a TextView in a right-to-left layout read it right to left. Any other text is
 * returned as written, as is a single number ("۵۸", "۱٫۹۹"), which reads the same either way.
 */
export function asRtlParagraph(text: string): string {
  if (SINGLE_NUMBER.test(text) || firstStrongDirection(text) !== null) return text;
  return `${RLM}${text}`;
}
