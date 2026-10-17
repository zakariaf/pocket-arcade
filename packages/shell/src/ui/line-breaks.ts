// packages/shell/src/ui/line-breaks.ts
// The design (Chrome) and iOS may end a line after a hyphen-minus inside a word, as Unicode line
// breaking allows (rule HY): "right-to- / left", "public- / domain". Android's line breaker breaks
// there only with hyphenation on, which would also hyphenate every other word. A zero-width space
// after such a hyphen gives Android the same break point and draws nothing.

import { asRtlParagraph } from '@e07/shell/i18n/bidi.ts';

const ZERO_WIDTH_SPACE = '\u200B';
const IN_WORD_HYPHEN = /(?<=\p{L})-(?=\p{L})/gu;

/** The text with a zero-width break point after each hyphen between two letters. */
export function withHyphenBreaks(text: string): string {
  return text.replace(IN_WORD_HYPHEN, `-${ZERO_WIDTH_SPACE}`);
}

const NO_BREAK_SPACE = /\u00A0/gu;
const WORD_JOINER = '\u2060';

/**
 * The text with each no-break space drawn as a plain space between two word joiners. Intl writes
 * German numbers and prices with U+00A0 ("62 %", "1,99 €"), and Lilita One has no such glyph:
 * Android then takes it from a fallback font whose space is wider (1.7 pt at 30 pt, E18-T23),
 * where Chrome and iOS draw the font's own space. The joiners keep the line unbroken there.
 */
export function withFontSpaces(text: string): string {
  return text.replace(NO_BREAK_SPACE, `${WORD_JOINER} ${WORD_JOINER}`);
}

/**
 * The marks Android needs to draw a text as the design does: a break point after each in-word
 * hyphen, a no-break space in the text's own font, and in a right-to-left paragraph a right-to-left mark before a text without a strong
 * letter (React Native's prepared layout reads it left to right, where a TextView did not).
 */
export function androidMarksOf(text: string, isRtlParagraph: boolean): string {
  const breakable = withHyphenBreaks(withFontSpaces(text));
  return isRtlParagraph ? asRtlParagraph(breakable) : breakable;
}
