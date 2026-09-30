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
