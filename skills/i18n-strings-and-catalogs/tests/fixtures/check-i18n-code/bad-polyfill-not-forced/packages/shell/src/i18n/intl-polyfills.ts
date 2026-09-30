// packages/shell/src/i18n/intl-polyfills.ts
// Side-effect module. It must be evaluated before any other Shell or game code:
// start-shell.ts imports it first, and Jest lists it in setupFiles.
// Order is mandatory: getCanonicalLocales -> Locale -> PluralRules -> NumberFormat.
// Locale data is imported statically: Metro cannot resolve template-string imports.

// 1. Conditional: Hermes ships getCanonicalLocales, so this is normally a no-op.
import '@formatjs/intl-getcanonicallocales/polyfill.js';
// 2-4. Forced: Hermes lacks Locale and PluralRules and ignores -u-nu- in NumberFormat.
//      Forcing also makes Jest (Node ICU) produce exactly what the device produces.
import '@formatjs/intl-locale/polyfill-force.js';
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/de.js';
import '@formatjs/intl-pluralrules/locale-data/fa.js';
import '@formatjs/intl-pluralrules/locale-data/ckb.js';
import '@formatjs/intl-numberformat/polyfill-force.js';
import '@formatjs/intl-numberformat/locale-data/en.js';
import '@formatjs/intl-numberformat/locale-data/de.js';
import '@formatjs/intl-numberformat/locale-data/fa.js';
import '@formatjs/intl-numberformat/locale-data/ckb.js';
