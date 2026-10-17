// packages/shell/src/ui/line-breaks.ts
// The design (Chrome) and iOS may end a line after a hyphen-minus inside a word, as Unicode line
// breaking allows (rule HY): "right-to- / left", "public- / domain". Android's line breaker breaks
// there only with hyphenation on, which would also hyphenate every other word. A zero-width space
// after such a hyphen gives Android the same break point and draws nothing.

const ZERO_WIDTH_SPACE = '​';
const IN_WORD_HYPHEN = /(?<=\p{L})-(?=\p{L})/gu;

/** The text with a zero-width break point after each hyphen between two letters. */
export function withHyphenBreaks(text: string): string {
  return text.replace(IN_WORD_HYPHEN, `-${ZERO_WIDTH_SPACE}`);
}
