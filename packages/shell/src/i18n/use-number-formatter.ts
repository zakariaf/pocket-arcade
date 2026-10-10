// packages/shell/src/i18n/use-number-formatter.ts
// Numbers outside catalog messages in the digits the player chose: the language and the Numbers
// setting give the locale tag (localeTagFor), and the formatter for that tag is built once
// (create-number-formatter.ts keeps one per tag). Screens, the S5 top bar and the S13 pictures
// read their formatter here instead of rebuilding the tag and the Intl object on every render.
import { selectDigits } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { createNumberFormatter, createPercentFormatter } from './create-number-formatter.ts';
import { localeTagFor } from './digits.ts';
import { useLanguage } from './language-context.tsx';

import type { NumberFormatter } from './create-number-formatter.ts';

function useLocaleTag(): string {
  return localeTagFor(useLanguage(), useSettingsStore(selectDigits));
}

/** Whole numbers in the chosen digits: 12, ۱۲. */
export function useNumberFormatter(): NumberFormatter {
  return createNumberFormatter(useLocaleTag());
}

/** A rate (0..1) as a whole percentage in the chosen digits: 62%, ۶۲٪. */
export function usePercentFormatter(): NumberFormatter {
  return createPercentFormatter(useLocaleTag());
}
