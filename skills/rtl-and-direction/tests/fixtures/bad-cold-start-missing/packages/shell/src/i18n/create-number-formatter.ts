// packages/shell/src/i18n/create-number-formatter.ts
// For text that is NOT a catalog message: Skia board labels, previews in Settings, level tiles.
// The tag comes from localeTagFor(language, digits); the polyfilled NumberFormat honours -u-nu-.
export type NumberFormatter = (value: number) => string;

export function createNumberFormatter(localeTag: string): NumberFormatter {
  const format = new Intl.NumberFormat(localeTag, { maximumFractionDigits: 0 });
  return (value) => format.format(value);
}

/** A rate (0..1) as a whole percentage in the chosen digits and the locale's sign: 62%, ۶۲٪. */
export function createPercentFormatter(localeTag: string): NumberFormatter {
  const format = new Intl.NumberFormat(localeTag, { style: 'percent', maximumFractionDigits: 0 });
  return (value) => format.format(value);
}
