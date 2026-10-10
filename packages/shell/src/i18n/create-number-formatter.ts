// packages/shell/src/i18n/create-number-formatter.ts
// For text that is NOT a catalog message: Skia board labels, previews in Settings, level tiles.
// The tag comes from localeTagFor(language, digits); the polyfilled NumberFormat honours -u-nu-.
// Each formatter is built once per locale tag and kept for the life of the app (an Intl.NumberFormat
// is costly to build, and screens ask for one on every render: useNumberFormatter).
export type NumberFormatter = (value: number) => string;

const NUMBER_FORMATTERS = new Map<string, NumberFormatter>();
const PERCENT_FORMATTERS = new Map<string, NumberFormatter>();

function cached(
  cache: Map<string, NumberFormatter>,
  localeTag: string,
  options: Intl.NumberFormatOptions,
): NumberFormatter {
  const known = cache.get(localeTag);
  if (known !== undefined) return known;
  const format = new Intl.NumberFormat(localeTag, options);
  const formatter: NumberFormatter = (value) => format.format(value);
  cache.set(localeTag, formatter);
  return formatter;
}

export function createNumberFormatter(localeTag: string): NumberFormatter {
  return cached(NUMBER_FORMATTERS, localeTag, { maximumFractionDigits: 0 });
}

/** A rate (0..1) as a whole percentage in the chosen digits and the locale's sign: 62%, ۶۲٪. */
export function createPercentFormatter(localeTag: string): NumberFormatter {
  return cached(PERCENT_FORMATTERS, localeTag, { style: 'percent', maximumFractionDigits: 0 });
}
