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

/**
 * The marks Android needs to draw a text as the design does: a break point after each in-word
 * hyphen, and in a right-to-left paragraph a right-to-left mark before a text without a strong
 * letter (React Native's prepared layout reads it left to right, where a TextView did not).
 */
export function androidMarksOf(text: string, isRtlParagraph: boolean): string {
  const breakable = withHyphenBreaks(text);
  return isRtlParagraph ? asRtlParagraph(breakable) : breakable;
}
