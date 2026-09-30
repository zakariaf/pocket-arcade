// packages/shell/src/screens/debug/font-test-samples.ts
// Pure data for the S15 font test page (test builds): one sample per language, each with the
// glyphs a font or a line height gets wrong first. English: digits, the en dash and the thin
// punctuation of the Shell's lines; German: umlauts and ß; Persian: the madda (آ) and every hamza
// seat (ئ أ ؤ ء) plus Persian digits; Kurdish: ێ ڵ ڕ ۆ and Arabic-Indic digits.
import { TYPE_SCALE } from '@e07/shell/theme/tokens.ts';
import { TYPE_STYLES } from '@e07/shell/theme/type-styles.ts';

import type { Language } from '@e07/shell/i18n/languages.ts';
import type { TypeVariant } from '@e07/shell/theme/type-styles.ts';

export type FontTestSample = { readonly language: Language; readonly text: string };

export type FontTestRow = {
  /** A Toybox type role or component text style, as AppText takes it. */
  readonly variant: TypeVariant;
  readonly samples: readonly FontTestSample[];
};

export const FONT_TEST_SAMPLES: readonly FontTestSample[] = [
  { language: 'en', text: 'Level 12 · Score 1,840 – best 2,010' },
  { language: 'de', text: 'Größe, Übung, Straße – Züge 7 / Par 7' },
  { language: 'fa', text: 'آمار، مسئول، رأی، مؤمن، جزء – امتیاز ۱٬۸۴۰' },
  { language: 'ckb', text: 'ئاستی ١٢ – خاڵ ١٬٨٤٠، ڕێگا، دێو، کۆتایی' },
];

/** Every name AppText accepts as a variant: the seven type roles, then the component styles. */
export const FONT_TEST_VARIANTS: readonly TypeVariant[] = [
  ...(Object.keys(TYPE_SCALE) as (keyof typeof TYPE_SCALE)[]),
  ...(Object.keys(TYPE_STYLES) as (keyof typeof TYPE_STYLES)[]),
];

/** One row per variant, each drawing the four samples in that variant. */
export function fontTestRowsOf(
  variants: readonly TypeVariant[],
  samples: readonly FontTestSample[],
): readonly FontTestRow[] {
  return variants.map((variant) => ({ variant, samples }));
}
