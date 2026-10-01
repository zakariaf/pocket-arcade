# 10 · Languages, right-to-left and numbers

> **What this doc decides.** How the Shell and every game speak English, German, Persian and Sorani (spec N6, N12, section 7). It covers the catalog format and key names, the `t()` / `<T>` API, the Intl polyfills that make Hermes and Jest agree, language resolution, digits, dates, bidi isolation, and the layout-direction switch (`forceRTL` + `reloadAppAsync`, run first in `index.ts`). It also sets the RTL styling rules, board handling, fonts, the catalog linter behind `npm run i18n:verify`, the tests, and the translation workflow.
> **Binding source:** [99-final-decisions.md](99-final-decisions.md) items 28–32 (plus 4, 7, 18 and 34). Problems found while writing are listed under [Open issues](#open-issues).
> **Related docs:** [03-naming.md](03-naming.md) (key naming), [05-components-hooks-styling.md](05-components-hooks-styling.md) (AppText and Icon), [06-navigation-state-persistence.md](06-navigation-state-persistence.md) (boot sequence and settings store), [07-testing-and-tdd.md](07-testing-and-tdd.md) (Jest setup and screenshot matrix), [02-architecture-and-folders.md](02-architecture-and-folders.md) (shellPlugins and index.ts). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

---

## 1. Introduction

Four languages ship from day one. Two are left-to-right (en, de) and two are right-to-left (fa, ckb). The hard parts are not the translations. They are the platform traps found and verified on 2026-09-26:

- **Hermes has no `Intl.PluralRules` and no `Intl.Locale`, and it ignores `-u-nu-` digit selection.** `fa` dates come out in the Solar Hijri calendar. So every plural and every digit would be wrong on the phone while Jest (Node, full ICU) passes. The fix is one polyfill module, forced, loaded first on the device and in Jest.
- **ICU `{n}` (a plain argument) prints a number with Latin digits.** `intl-messageformat` 12.1.2 calls `String(value)` for plain arguments (read in its source), so the chosen digits only apply to `{n, number}` and plural `#`. The catalog linter enforces this.
- **An in-app RTL choice on an LTR phone keeps text left-aligned** unless every `Text` sets `textAlign`. The Shell's `AppText` does.
- **`I18nManager.isRTL` is a constant for the whole JS run.** A direction change needs `allowRTL` + `forceRTL` and a JS reload (`reloadAppAsync` from `expo`). Module-level code runs once before the reload, so the direction check comes before anything writes the save.

Everything that decides language, direction, digits and text is a pure function with tests. Layout correctness is checked by the screenshot matrix (docs/07 section 3.13), because Jest computes no layout.

---

## 2. Rules

1. **Render every user-visible string through `t()` or `<T>` from `@e07/shell/i18n/*`, from a catalog key.** No string literals in JSX, in accessibility props, or in `Alert`-style APIs.
   *Why:* spec N12; ESLint `react/jsx-no-literals`, `formatjs/no-literal-string-in-jsx` and the literal-a11y-prop selector make it a compile error (FINAL 28, 34).
2. **Keep the catalogs JSON-first, one flat file per language, English as the source, keys sorted alphabetically.** Shell: `packages/shell/src/i18n/catalogs/{en,de,fa,ckb}.json`. Game: `apps/<game-id>/src/i18n/{en,de,fa,ckb}.json`, every key starting with the game id (`line-siege.…`).
   *Why:* FINAL 28 and A.8; key grammar and namespaces are fixed by `docs/03-naming.md` section 9. The game-id prefix makes a Shell/game collision impossible.
3. **Name keys `<area>.<element>[.<variant>]`: 2 to 5 dot-separated, lowercase kebab-case segments** (for example `home.play-button.continue`, `result.win.moves`). Never encode the English text in the key. Write keys as string literals at the call site or in a typed table of literals, never by string building.
   *Why:* semantic keys survive rewording, and the tools can only check keys they can see (`docs/03`). The catalog linter rejects other shapes.
4. **Import `@e07/shell/i18n/intl-polyfills.ts` as the first import of `packages/shell/src/app/start-shell.ts`, and list it in Jest `setupFiles`** (docs/07's `jest.config.js` does, for both the `unit` and the `golden` project). Force `intl-locale`, `intl-pluralrules` and `intl-numberformat` with en/de/fa/ckb data; `intl-getcanonicallocales` stays conditional.
   *Why:* Hermes lacks `PluralRules` and `Locale` and drops numbering systems (verified on device). Forcing makes Jest identical to the phone. **Source:** [Hermes Features.md](https://github.com/facebook/hermes/blob/static_h/doc/Features.md), [Hermes IntlAPIs.md](https://github.com/facebook/hermes/blob/main/doc/IntlAPIs.md).
5. **Write every number that appears in a sentence as `{x, number}`, `{x, number, ::percent}` or inside a plural (`#`).** A plain `{x}` is only for text, and its name must end in `Name` or `Text`.
   *Why:* a plain argument prints `String(value)`, which is Latin digits in every language (verified in `intl-messageformat` 12.1.2).
6. **Use `{count, plural, one {…} other {…}}` with both `one` and `other` in all four languages whenever a number is followed by a counted noun.** Never branch on "is it 1?" in code. Exact matches (`=0`) are allowed and must then appear in every language.
   *Why:* spec 7.4. CLDR gives fa `one` for **0 and 1**, so an English-only `=0` would print the fa `one` form for zero. **Source:** [CLDR plural rules](https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html).
7. **Select digits only through the locale tag from `localeTagFor(language, digits)`** (`fa-u-nu-arabext`, `ckb-u-nu-arabext`, `fa-u-nu-latn`, `ckb-u-nu-latn`, `en`, `de`). Pass that tag to `I18nProvider` and to every `Intl.NumberFormat`.
   *Why:* spec 7.3. ckb's CLDR default is Arabic-Indic `٠١٢`; the spec wants Persian-style `۰۱۲` for Sorani too.
8. **Never call `Intl.DateTimeFormat`, `Date#toLocale*String` or use ICU `{x, date}` / `{x, time}`.** Format dates with `formatDayMonth()` and the month names in the catalogs (Gregorian in all four languages).
   *Why:* on iOS Hermes `DateTimeFormat('fa')` gives the Solar Hijri date (`۴ مهر` for 2026-09-26) and ignores the digit choice (verified). The daily challenge is keyed by the Gregorian local date.
9. **Resolve the language with the pure `resolveLanguage(saved, getLocales())`.** Saved choice first; then the first device locale that is ckb (or `ku` in Arab script), fa or prs, de, en; otherwise en. `ku`/`kmr` in Latin script never map to ckb.
   *Why:* spec 7.2.
10. **Configure `expo-localization` with `supportedLocales` only. Never set its `supportsRTL` or `forcesRTL`.**
    *Why:* those options re-derive direction from the device language at every launch and would undo an in-app Persian choice on an English phone (read in the 57.0.2 source). **Source:** [Expo localization guide](https://docs.expo.dev/guides/localization/).
11. **Only `packages/shell/src/i18n/direction.ts` reads `I18nManager.isRTL`, and only `startShell()` (startup) and the S2/Settings language flows change direction.** They call `allowRTL(rtl)` **and** `forceRTL(rtl)`, record a pending-restart marker, then `reloadAppAsync()` from `expo`, always from a mounted component (a button handler or the startup splash's effect).
    *Why:* `isRTL` is fixed at JS load; a reload is enough on iOS (verified in a Release build). Reloading during bundle evaluation crashed a Release build (docs/06). `expo-updates` is banned (N3). **Source:** [`reloadAppAsync`](https://docs.expo.dev/versions/latest/sdk/expo/#reloadappasyncreason), [I18nManager](https://reactnative.dev/docs/i18nmanager).
12. **Run the direction check before anything writes the save.** `startShell()` reads the language with a read-only peek, plans the direction, and reloads before any migration, backup refresh or render.
    *Why:* module-level code runs once before the reload (verified: a save was written twice).
13. **Never reload more than once for the same direction.** If a reload for direction D has already happened and the layout is still not D, continue in the current layout and log an error.
    *Why:* spec 8.14, never a crash loop. The marker lives in `expo-sqlite/kv-store` (through `sqlite-kv-direction-guard-adapter.ts`), not in the save document.
14. **Give navigation the same direction as layout:** `<Navigation direction={readLayoutDirection()} />`, never the language setting.
    *Why:* FINAL 4. Between a language change and the restart, text is already in the new language but layout is not; both navigation and layout must agree.
15. **Style with logical properties only** (`marginStart/End`, `paddingStart/End`, `start/end`, `borderStart*/End*`, `borderTop/BottomStart/EndRadius`). No physical `left`/`right` style keys, no `textAlign: 'left' | 'right'` literals (only `AppText` sets them, through the `TEXT_ALIGN` start/end map in `use-localized-text-style.ts`), no `flexDirection: 'row-reverse'` for mirroring.
    *Why:* spec N11; docs/04's ESLint config enforces it (FINAL 34). `flexDirection: 'row'` already mirrors.
16. **Render all text through `AppText` (or `<T>`, which uses it).** `AppText` sets `writingDirection` from `DirectionContext`, `textAlign` explicitly, the script font and the line height.
    *Why:* the default `textAlign: 'auto'` stays physically left under a forced RTL layout on an LTR-language phone (verified).
17. **Wrap every game board in `direction: 'ltr'` unless the game opts in to mirroring; mirror an opted-in board in its `BoardLayout` mapping, never with `scaleX: -1`.**
    *Why:* spec 7.5 and FINAL 18. A physical board must not flip with the text.
18. **Flip only directional icons (back, next/previous, chevrons, progress arrows) with `transform: [{ scaleX: -1 }]` in RTL.** Clocks, circular progress, logos, play/pause and object icons never flip.
    *Why:* spec 7.5.
19. **Use Vazirmatn v33.003 (`Vazirmatn-Regular`, `Vazirmatn-Bold`) for fa and ckb text, embedded by the `expo-font` config plugin, with `lineHeight ≈ 1.5 × fontSize`. Never set `fontWeight` together with a custom family.**
    *Why:* FINAL 32. Verified coverage of every Sorani letter (ڕ ڵ ۆ ێ ە ڤ). A too-small line height clips marks.
20. **`npm run i18n:verify` must pass before every commit that touches a catalog.** It runs `formatjs verify --source-locale en --missing-keys --extra-keys --structural-equality` and the catalog linter for the Shell and every game.
    *Why:* spec 7.4, "a missing text fails the build" (FINAL 28).
21. **Claude writes all four languages; the owner reads fa and ckb personally, and that review is never a release gate.** The reviewed state is recorded per key; every report and `release:ios` list the fa/ckb texts still waiting as an owner step (not blocking), and nothing waits for them.
    *Why:* spec 7.4. Machine-written Sorani especially can sound unnatural, so the owner reads it; the owner also ruled that the review never holds back a build or a release (FINAL H.6 and H.20, L14).

---

## 3. Details

### 3.1 Packages and versions

| Package | Version (2026-09-26) | Where | How it is installed |
|---|---|---|---|
| `react-intl` | 12.1.3 exact | Shell runtime | `npm install -E` (not in the Expo map) |
| `@formatjs/intl-getcanonicallocales` | 3.2.12 exact | Shell runtime | npm, exact |
| `@formatjs/intl-locale` | 5.3.12 exact | Shell runtime | npm, exact |
| `@formatjs/intl-pluralrules` | 6.3.15 exact | Shell runtime | npm, exact |
| `@formatjs/intl-numberformat` | 9.4.3 exact | Shell runtime | npm, exact |
| `expo-localization` | ~57.0.2 | app | `npx expo install expo-localization` |
| `expo-font` | ~57.0.4 | app | `npx expo install expo-font` |
| `expo-sqlite` (its `kv-store`) | ~57.0.3 | app | already installed for saves |
| `@formatjs/cli` | 6.16.32 exact | root dev | npm, exact |
| `@formatjs/icu-messageformat-parser` | 3.5.20 exact | `@e07/tooling` dev | npm, exact (the linter imports it, so knip needs it listed) |
| `eslint-plugin-formatjs` | 8.1.0 exact | root dev | npm, exact |
| Vazirmatn | v33.003 static TTF | `apps/<game>/assets/fonts/` | GitHub release zip, committed with `OFL.txt` |

The versions table in `docs/01-stack-and-versions.md` is the single source of truth. **Re-verify** before relying on these numbers: `npm view react-intl version`, `npm view @formatjs/intl-pluralrules version` (and the other three polyfills), `npx expo install --check` in each app, then `npx jest packages/shell/src/i18n`. After any React Native or Hermes upgrade, rerun the on-device Intl probe in section 3.15.

### 3.2 Catalog files and key naming

```
packages/shell/src/i18n/
  catalogs/en.json  de.json  fa.json  ckb.json   # Shell texts
  intl-polyfills.ts  intl-status.ts
  languages.ts  resolve-language.ts  digits.ts  create-number-formatter.ts
  bidi.ts  messages.ts  create-t.ts  t-context.ts  t-bridge.tsx  i18n-provider.tsx  t.tsx
  format-date.ts
  direction.ts  direction-plan.ts  direction-guard.ts  direction-context.tsx
  language-context.tsx  fonts.ts  use-localized-text-style.ts
packages/shell/src/services/save/sqlite-kv-direction-guard-adapter.ts   # expo-sqlite kv-store (vendor code stays in adapters)
apps/line-siege/src/i18n/en.json  de.json  fa.json  ckb.json   # game texts, keys "line-siege.*"
```

A catalog is a flat JSON object: key → ICU MessageFormat string. Example (English, the source):

```json
{
  "common.back": "Back",
  "daily.streak": "{daysCount, plural, =0 {No streak yet} one {# day streak} other {# day streak}}",
  "date.day-month": "{day, number} {monthName}",
  "date.month-short.1": "Jan",
  "date.month-short.10": "Oct",
  "date.month-short.11": "Nov",
  "date.month-short.12": "Dec",
  "date.month-short.2": "Feb",
  "date.month-short.3": "Mar",
  "date.month-short.4": "Apr",
  "date.month-short.5": "May",
  "date.month-short.6": "Jun",
  "date.month-short.7": "Jul",
  "date.month-short.8": "Aug",
  "date.month-short.9": "Sep",
  "game-screen.mode.daily": "Daily - {dateText}",
  "home.play-button.continue": "Continue - Level {level, number}",
  "levels.pack.locked": "Collect {starsCount, plural, one {# more star} other {# more stars}} to unlock {packName}.",
  "levels.pack.progress": "{earned, number} / {total, plural, one {# star} other {# stars}}",
  "result.win.moves": "{movesCount, plural, one {# move} other {# moves}} - par {par, number}",
  "settings.language.restart.body": "The layout direction changes after a quick restart. Your progress is saved.",
  "settings.language.restart.title": "Restart to apply",
  "stats.duration": "{hours, plural, one {# h} other {# h}} {minutes, plural, one {# min} other {# min}}",
  "stats.win-rate": "Win rate {rate, number, ::percent}"
}
```

Key rules (checked by the linter):

| Rule | Example | Rejected |
|---|---|---|
| 2 to 5 dot-separated segments, lowercase kebab-case | `settings.language.restart.title` | `Home.Play`, `homePlay` |
| Game keys start with the game id; Shell keys never start with any game id | `line-siege.enemy.wolf` | `enemy.wolf` in a game file |
| Keys sorted alphabetically in every file | (the sample above) | unsorted files |
| Keys are literals or come from a typed table | `MONTH_SHORT_KEYS[month - 1]` | `` `date.month-short.${month}` `` |
| The key names the place, not the words | `result.lose.reason.breakthrough` | `result.the-monsters-broke-through` |
| One key per full sentence or label | `result.win.moves` | `result.win.moves.prefix` + `...suffix` |

Placeholder rules (checked by the linter):

| Kind | Syntax | Name | Value passed to `t()` |
|---|---|---|---|
| Number | `{level, number}`, `{rate, number, ::percent}` | camelCase, not ending in Name/Text | `number` |
| Counted noun | `{movesCount, plural, one {# move} other {# moves}}` | camelCase | `number` |
| Choice | `{mode, select, daily {…} other {…}}` | camelCase, not ending in Name/Text | `string` key |
| Free text | `{packName}`, `{dateText}` | must end in `Name` or `Text` | `string` (bidi-isolated by `t()`) |

TypeScript knows the Shell keys: `ShellMessageKey = keyof typeof en` (from the JSON import), so a typo in a Shell key is a type error. The Shell cannot know game keys, so a game exports a typed table built with `asGameKey` (for example `apps/line-siege/src/i18n/keys.ts`: `export const LOSE_REASON_KEYS = { breakthrough: asGameKey('line-siege.lose.broke-through') } as const;`) and hands those branded keys to the Shell through the `GameModule` contract; a plain string is not accepted by `t()`.

### 3.3 The intl-polyfills module (complete file)

```ts
// packages/shell/src/i18n/intl-polyfills.ts
// Side-effect module. It must be evaluated before any other Shell or game code.
// Order is mandatory: getCanonicalLocales -> Locale -> PluralRules -> NumberFormat.
// Locale data is imported statically: Metro cannot resolve template-string imports.

// 1. Conditional: Hermes ships getCanonicalLocales, so this is normally a no-op.
import '@formatjs/intl-getcanonicallocales/polyfill.js';
// 2-4. Forced: Hermes lacks Locale and PluralRules and ignores -u-nu- in NumberFormat.
//      Forcing also makes Jest (Node ICU) produce exactly what the device produces.
import '@formatjs/intl-locale/polyfill-force.js';
import '@formatjs/intl-pluralrules/polyfill-force.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/de.js';
import '@formatjs/intl-pluralrules/locale-data/fa.js';
import '@formatjs/intl-pluralrules/locale-data/ckb.js';
import '@formatjs/intl-numberformat/polyfill-force.js';
import '@formatjs/intl-numberformat/locale-data/en.js';
import '@formatjs/intl-numberformat/locale-data/de.js';
import '@formatjs/intl-numberformat/locale-data/fa.js';
import '@formatjs/intl-numberformat/locale-data/ckb.js';
```

`@formatjs/intl-getcanonicallocales/polyfill.js` is the conditional ("should-polyfill") variant: it installs itself only when `shouldPolyfill()` is true (read in the 3.2.12 source), so no `require()` is needed.

A cheap runtime assertion, used by the debug menu and by one unit test:

```ts
// packages/shell/src/i18n/intl-status.ts
type MaybePolyfilled = { readonly polyfilled?: boolean };

// True only when the forced FormatJS polyfills are the active implementations.
export function areIntlPolyfillsActive(): boolean {
  const plural = Intl.PluralRules as unknown as MaybePolyfilled;
  const numbers = Intl.NumberFormat as unknown as MaybePolyfilled;
  return plural.polyfilled === true && numbers.polyfilled === true;
}
```

Cost: the eight locale-data files (four plural-rule files and four number-format files) are about 578 KB raw (70 KB gzip); nearly all of it is number-format data. The polyfills loaded in 11 ms on the iOS 26.5 simulator. The owner's on-device cold-start log (FINAL 47) is the real check against the < 1 s splash budget.

### 3.4 Languages and `resolveLanguage`

```ts
// packages/shell/src/i18n/languages.ts
export const LANGUAGES = ['en', 'de', 'fa', 'ckb'] as const;
export type Language = (typeof LANGUAGES)[number];
export type Direction = 'ltr' | 'rtl';

const RTL_LANGUAGES: ReadonlySet<Language> = new Set<Language>(['fa', 'ckb']);

// Each language's name in its own language and script (spec S2, S11a, 7.2).
// Deliberately NOT in the catalogs: translators must never change them.
export const LANGUAGE_AUTONYMS: Readonly<Record<Language, string>> = {
  en: 'English',
  de: 'Deutsch',
  fa: 'فارسی',
  ckb: 'کوردیی ناوەندی',
};

export function directionOf(language: Language): Direction {
  return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
```

```ts
// packages/shell/src/i18n/resolve-language.ts
import type { Language } from './languages.ts';

// The two fields we read from expo-localization's getLocales() entries.
export type DeviceLocale = {
  readonly languageCode: string | null;
  readonly languageScriptCode: string | null;
};

// 'prs' is Dari (counts as Persian). 'ku' is decided by script below; 'kmr' is Latin Kurmanji.
const BY_CODE: Readonly<Record<string, Language>> = {
  en: 'en',
  de: 'de',
  fa: 'fa',
  prs: 'fa',
  ckb: 'ckb',
};

// Maps one device locale to a supported language, or null to try the next one (spec 7.2).
export function languageFromDeviceLocale(locale: DeviceLocale): Language | null {
  const code = locale.languageCode?.toLowerCase() ?? '';
  if (code === 'ku') return locale.languageScriptCode === 'Arab' ? 'ckb' : null;
  return BY_CODE[code] ?? null;
}

// Saved choice wins, then the first supported device language, then English.
export function resolveLanguage(
  saved: Language | null,
  deviceLocales: readonly DeviceLocale[],
): Language {
  if (saved !== null) return saved;
  for (const locale of deviceLocales) {
    const language = languageFromDeviceLocale(locale);
    if (language !== null) return language;
  }
  return 'en';
}
```

The saved value is `settings.language` in the save document, `null` meaning "System". The same resolver runs for S2's pre-selection and for the "System" row in Settings.

The `expo-localization` plugin entry lives in docs/02's `shellPlugins` (section 9.1, the one plugin list): `['expo-localization', { supportedLocales: { ios: LOCALES, android: LOCALES } }]` with `LOCALES = ['en', 'de', 'fa', 'ckb']`, and nothing else. Never add `supportsRTL` or `forcesRTL`: the Shell owns direction (rule 10).

`supportedLocales` writes `CFBundleLocalizations` (and Android's `locales_config`), so the per-app language setting in iOS Settings lists the four languages. Localized home-screen names go through `expo.locales` (one `InfoPlist.strings` per language), which `withShell` writes from `GameConfig.appName` (docs/02 section 9.1). The same files carry `NSUserTrackingUsageDescription`, the sentence in Apple's "Allow tracking?" prompt (FINAL H.1): its four texts are the copy-deck key `consent.tracking.usage-description`, kept in the Shell catalogs like every other deck string; `shell-plugins.ts` reads them from the four catalogs (JSON imports) as `TRACKING_USAGE_DESCRIPTIONS`, so there is no second copy (FINAL H.20, L14). It is a system dialog text: plain, with no ICU argument or brace, because nothing formats ICU in `Info.plist`. The fa and ckb drafts go to the owner's own review (FINAL H.6) like every other text.

### 3.5 Digits and number formatting

| Language | Automatic | Latin | Local | Output of 1234567.89 (Automatic) |
|---|---|---|---|---|
| en | `en` | `en` | `en` | `1,234,568` |
| de | `de` | `de` | `de` | `1.234.568` |
| fa | `fa-u-nu-arabext` | `fa-u-nu-latn` | `fa-u-nu-arabext` | `۱٬۲۳۴٬۵۶۸` |
| ckb | `ckb-u-nu-arabext` | `ckb-u-nu-latn` | `ckb-u-nu-arabext` | `۱٬۲۳۴٬۵۶۸` |

(Outputs from the Jest test in section 3.15, formatter with `maximumFractionDigits: 0`.) Persian and Sorani use `٬` (U+066C) for grouping, `٫` (U+066B) for decimals and `٪` (U+066A) for percent, exactly as spec 7.3 asks: `ckb-u-nu-arabext` formats 1234.5 as `۱٬۲۳۴٫۵` and 0.42 as `۴۲٪`.

```ts
// packages/shell/src/i18n/digits.ts
import type { Language } from './languages.ts';

export type DigitStyle = 'automatic' | 'latin' | 'local';

// BCP 47 tag handed to IntlProvider and to every Intl.NumberFormat (spec 7.1, 7.3).
// ckb's CLDR default is 'arab' (U+0660..); the spec wants Persian-style 'arabext' (U+06F0..).
const TAGS: Readonly<Record<Language, Readonly<Record<DigitStyle, string>>>> = {
  en: { automatic: 'en', latin: 'en', local: 'en' },
  de: { automatic: 'de', latin: 'de', local: 'de' },
  fa: { automatic: 'fa-u-nu-arabext', latin: 'fa-u-nu-latn', local: 'fa-u-nu-arabext' },
  ckb: { automatic: 'ckb-u-nu-arabext', latin: 'ckb-u-nu-latn', local: 'ckb-u-nu-arabext' },
};

export function localeTagFor(language: Language, digits: DigitStyle): string {
  return TAGS[language][digits];
}
```

Numbers that are **not** inside a catalog sentence (a level number on a tile, monster health drawn by Skia, the previews in Settings) use a formatter built from the same tag. Formatting happens in JS; the board receives strings (FINAL 18).

```ts
// packages/shell/src/i18n/create-number-formatter.ts
// For text that is NOT a catalog message: Skia board labels, previews in Settings.
// The tag comes from localeTagFor(language, digits); the polyfilled NumberFormat honours -u-nu-.
export type NumberFormatter = (value: number) => string;

export function createNumberFormatter(localeTag: string): NumberFormatter {
  const format = new Intl.NumberFormat(localeTag, { maximumFractionDigits: 0 });
  return (value) => format.format(value);
}
```

- A game that shows a code or symbol that must stay Latin (spec 7.3) builds its formatter with `localeTagFor(language, 'latin')` for that value only, and says so in a comment.
- The Settings "Numbers" row (Automatic / Latin / Local) shows each option with a live preview, e.g. "Local ۱۲۳", produced by `createNumberFormatter(localeTagFor(language, option))(123)`. No digits are typed into the catalogs (the linter forbids literal digits). For en and de all three options give Latin digits, which the previews make obvious.
- Saves always store plain numbers; digits are display only (spec 7.3).
- Prices on S12 come from the store and are re-formatted with the same tag when the store gives a numeric price (see `12-in-app-purchase.md`, section 3.6).

### 3.6 `t()`, `<T>` and the provider

`t(key, values)` wraps `react-intl`'s `formatMessage`. It adds two things: bidi isolation of text placeholders, and a guard against numbers passed to text placeholders.

```ts
// packages/shell/src/i18n/create-t.ts
import { isolate } from './bidi.ts';

import type { MessageKey } from './messages.ts';
import type { IntlShape } from 'react-intl';

export type MessageValues = Readonly<Record<string, string | number>>;
export type TFunction = (key: MessageKey, values?: MessageValues) => string;
export type CreateTOptions = {
  readonly intl: IntlShape;
  readonly onError: (error: Error) => void;
};

// Placeholders that receive free text (names, pre-formatted dates) end in Name or Text.
// Only those are bidi-isolated; numbers and select keys pass through untouched.
const TEXT_ARGUMENT = /(Name|Text)$/;

function prepareValue(
  name: string,
  value: string | number,
  onError: (error: Error) => void,
): string | number {
  if (!TEXT_ARGUMENT.test(name)) return value;
  if (typeof value === 'number') {
    onError(new Error(`i18n: "${name}" is a text placeholder; pass a string, not a number`));
    return String(value);
  }
  return isolate(value);
}

export function createT({ intl, onError }: CreateTOptions): TFunction {
  return (key, values) => {
    if (values === undefined) return intl.formatMessage({ id: key });
    const prepared = Object.fromEntries(
      Object.entries(values).map(([name, value]) => [name, prepareValue(name, value, onError)]),
    );
    return intl.formatMessage({ id: key }, prepared);
  };
}
```

```ts
// packages/shell/src/i18n/messages.ts
import ckb from './catalogs/ckb.json';
import de from './catalogs/de.json';
import en from './catalogs/en.json';
import fa from './catalogs/fa.json';

import type { Language } from './languages.ts';

export type Catalog = Readonly<Record<string, string>>;
export type ShellMessageKey = keyof typeof en;
// Game keys start with the game id (docs/03: "line-siege.lose.broke-through"). The Shell cannot
// know them statically, so games hand them over branded (see asGameKey): a typo in a Shell key
// stays a type error, and a plain string is never accepted.
export type GameMessageKey = string & { readonly brand: 'GameMessageKey' };
export type MessageKey = ShellMessageKey | GameMessageKey;

// Used only by a game's typed key table: apps/<game>/src/i18n/keys.ts.
export function asGameKey(key: string): GameMessageKey {
  return key as GameMessageKey;
}

const SHELL_CATALOGS: Readonly<Record<Language, Catalog>> = { en, de, fa, ckb };

export function messagesFor(
  language: Language,
  gameCatalogs: Readonly<Record<Language, Catalog>>,
): Catalog {
  return { ...SHELL_CATALOGS[language], ...gameCatalogs[language] };
}
```

```ts
// packages/shell/src/i18n/t-context.ts
import { createContext, use } from 'react';

import type { TFunction } from './create-t.ts';

export const TContext = createContext<TFunction | null>(null);

// The only way screens get t(). Throws when rendered outside <I18nProvider>.
export function useT(): TFunction {
  const t = use(TContext);
  if (t === null) throw new Error('useT() must be used inside <I18nProvider>');
  return t;
}
```

```tsx
// packages/shell/src/i18n/t-bridge.tsx
import { useIntl } from 'react-intl';

import { createT } from './create-t.ts';
import { TContext } from './t-context.ts';

import type { ReactNode } from 'react';

export type TBridgeProps = {
  readonly onError: (error: Error) => void;
  readonly children: ReactNode;
};

// Turns react-intl's IntlShape into the Shell's t() (React Compiler memoizes it).
export function TBridge({ onError, children }: TBridgeProps): ReactNode {
  const intl = useIntl();
  return <TContext value={createT({ intl, onError })}>{children}</TContext>;
}
```

```tsx
// packages/shell/src/i18n/i18n-provider.tsx
import { IntlProvider } from 'react-intl';

import { localeTagFor } from './digits.ts';
import { LanguageContext } from './language-context.tsx';
import { messagesFor } from './messages.ts';
import { TBridge } from './t-bridge.tsx';

import type { DigitStyle } from './digits.ts';
import type { Language } from './languages.ts';
import type { Catalog } from './messages.ts';
import type { ReactNode } from 'react';

export type I18nProviderProps = {
  readonly language: Language;
  readonly digits: DigitStyle;
  readonly gameCatalogs: Readonly<Record<Language, Catalog>>;
  readonly onError: (error: Error) => void; // ErrorLogPort in the app, `throw` in tests
  readonly children: ReactNode;
};

export function I18nProvider(props: I18nProviderProps): ReactNode {
  const { language, digits, gameCatalogs, onError, children } = props;
  return (
    <IntlProvider
      locale={localeTagFor(language, digits)}
      messages={messagesFor(language, gameCatalogs)}
      defaultLocale="en"
      onError={onError}
    >
      <LanguageContext value={language}>
        <TBridge onError={onError}>{children}</TBridge>
      </LanguageContext>
    </IntlProvider>
  );
}
```

```tsx
// packages/shell/src/i18n/language-context.tsx
import { createContext, use } from 'react';

import type { Language } from './languages.ts';

export const LanguageContext = createContext<Language>('en');

export function useLanguage(): Language {
  return use(LanguageContext);
}
```

```tsx
// packages/shell/src/i18n/t.tsx
import { AppText } from '@e07/shell/ui/app-text.tsx';

import { useT } from './t-context.ts';

import type { MessageValues } from './create-t.ts';
import type { MessageKey } from './messages.ts';
import type { AppTextProps } from '@e07/shell/ui/app-text.tsx';
import type { ReactNode } from 'react';

export type TProps = Omit<AppTextProps, 'text' | 'language'> & {
  readonly id: MessageKey;
  readonly values?: MessageValues;
};

// <T id="home.play-button.continue" values={{ level: 12 }} variant="heading" />
export function T({ id, values, ...textProps }: TProps): ReactNode {
  const t = useT();
  return <AppText text={t(id, values)} {...textProps} />;
}
```

Usage rules:
- In JSX use `<T id=… />`. Where a string is needed (accessibility labels, `AppText` with extra layout, Skia paragraphs), call `const t = useT()` in the component and pass `t('…')`.
- Do not import anything from `react-intl` outside `packages/shell/src/i18n/`. docs/04's `REACT_INTL_IMPORT` entry enforces this.
- Changing the language re-renders `I18nProvider` with new messages, so text switches at once (spec S11). Direction does not; see section 3.10.
- Missing key: `react-intl` calls `onError` and shows the key. `onError` goes to `ErrorLogPort` in the app (`errorLog.record('i18n', error)`) and throws in tests, so a missing key fails the test run; `i18n:verify` catches it earlier.

### 3.7 ICU plural examples (verified outputs)

CLDR cardinal categories for our languages (the only ones that exist):

| Language | `one` | `other` | Note |
|---|---|---|---|
| en | 1 | everything else | 0 → other |
| de | 1 | everything else | 0 → other |
| fa | **0** and 1 | everything else | an `=0` branch must exist in fa too if en has one |
| ckb | 1 | everything else | nouns after a number stay singular |

The same key in four languages, and what `t()` returns (each line is an assertion in `create-t.test.ts`):

| Language | Message | Values | Output |
|---|---|---|---|
| en | `{movesCount, plural, one {# move} other {# moves}} - par {par, number}` | 1, 7 | `1 move - par 7` |
| en | same | 0, 7 | `0 moves - par 7` |
| de | `{movesCount, plural, one {# Zug} other {# Züge}} - Par {par, number}` | 1, 7 | `1 Zug - Par 7` |
| de | same | 2, 7 | `2 Züge - Par 7` |
| fa | `{movesCount, plural, one {# حرکت} other {# حرکت}} - پار {par, number}` | 0, 7 | `۰ حرکت - پار ۷` |
| ckb | `{movesCount, plural, one {# جووڵە} other {# جووڵە}} - پار {par, number}` | 3, 7 | `۳ جووڵە - پار ۷` |
| fa | `{daysCount, plural, =0 {هنوز رکوردی ندارید} one {# روز پیاپی} other {# روز پیاپی}}` | 0 | `هنوز رکوردی ندارید` (`=0` wins over fa `one`) |
| fa | same | 1 | `۱ روز پیاپی` |
| ckb (Latin digits) | `بەردەوامبوون - ئاستی {level, number}` | 12 | `بەردەوامبوون - ئاستی 12` |
| fa | `درصد برد {rate, number, ::percent}` | 0.42 | `درصد برد ۴۲٪` |

Writing rules for translators (Claude included):
- Keep `one` and `other` in fa and ckb even when both forms are the same word; `--structural-equality` does not require it (verified), but the linter does, so nobody drops a form that en needs.
- Persian and Sorani nouns after a number stay singular (`۳ جووڵە`, `۵ ستاره`); German and English change the noun.
- Durations are full sentences with plurals (`stats.duration`), never `"2" + " h"`.

### 3.8 Bidi isolation (FSI … PDI)

Any free text interpolated into a sentence (a pack name, a formatted date, the language autonym in "System (فارسی)") is wrapped in U+2068 FIRST STRONG ISOLATE … U+2069 POP DIRECTIONAL ISOLATE by `t()`, so its own direction cannot reorder the surrounding sentence (spec 7.4).

```ts
// packages/shell/src/i18n/bidi.ts
// U+2068 FIRST STRONG ISOLATE ... U+2069 POP DIRECTIONAL ISOLATE (spec 7.4).
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
```

Verified: `t('levels.pack.locked', { starsCount: 2, packName: 'Beginnings' })` in fa returns `برای باز کردن ⁨Beginnings⁩، ۲ ستارهٔ دیگر جمع کنید.` with the isolates around the Latin name. On iOS 26.5 with Vazirmatn the isolates render invisibly (no tofu). Rules:
- Numbers are never isolated: they are formatted by ICU inside the sentence and take the sentence's digits.
- Select keys (`{mode, select, …}`) are never isolated (the match would fail); that is why only `*Name` / `*Text` arguments are isolated.
- Catalogs never contain bidi controls themselves (U+202A–U+202E, U+2066–U+2069) or the Arabic Letter Mark U+061C, which Vazirmatn lacks. The linter rejects them.
- Tests compare with `FSI`/`PDI` in the expected string, or use `stripIsolates`.

### 3.9 Dates: the Shell formatter

The Shell never formats `Date` objects. `ClockPort.today()` (docs/02, docs/06) returns the player's local calendar day as a `DateKey` (`'YYYY-MM-DD'`, from `@e07/game-kit/dates/date-key.ts`, integer arithmetic only); formatting is a catalog message.

```ts
// packages/shell/src/i18n/format-date.ts
import { dayNumber } from '@e07/game-kit/dates/date-key.ts';

import type { TFunction } from './create-t.ts';
import type { ShellMessageKey } from './messages.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

// Month names come from the catalogs (Gregorian in all four languages).
// Never use Intl.DateTimeFormat or Date#toLocale*: Hermes picks the Solar Hijri
// calendar for fa and ignores the digit choice. Keys are literals (docs/03), never built.
const MONTH_SHORT_KEYS = [
  'date.month-short.1',
  'date.month-short.2',
  'date.month-short.3',
  'date.month-short.4',
  'date.month-short.5',
  'date.month-short.6',
  'date.month-short.7',
  'date.month-short.8',
  'date.month-short.9',
  'date.month-short.10',
  'date.month-short.11',
  'date.month-short.12',
] as const satisfies readonly ShellMessageKey[];

// ISO weekday of a DateKey: 1 = Monday ... 7 = Sunday (1970-01-01, day 0, was a Thursday).
export function isoWeekday(date: DateKey): number {
  return ((((dayNumber(date) + 3) % 7) + 7) % 7) + 1;
}

// '2026-09-26' -> "26 Sep" / "26. Sept." / "۲۶ سپتامبر" / "۲۶ی ئەیلوول" (catalog + digits).
export function formatDayMonth(date: DateKey, t: TFunction): string {
  const [, month = 1, day = 1] = date.split('-').map(Number);
  const monthKey = MONTH_SHORT_KEYS[month - 1] ?? 'date.month-short.1';
  return t('date.day-month', { day, monthName: t(monthKey) });
}
```

Catalog entries (the full set of 12 months, plus `date.weekday-short.1`…`7` for the 7-day strip, indexed by `isoWeekday`):

| Key | en | de | fa | ckb |
|---|---|---|---|---|
| `date.day-month` | `{day, number} {monthName}` | `{day, number}. {monthName}` | `{day, number} {monthName}` | `{day, number}ی {monthName}` |
| `date.month-short.9` | `Sep` | `Sept.` | `سپتامبر` | `ئەیلوول` |
| 2026-09-26 → | `26 Sep` | `26. Sept.` | `۲۶ سپتامبر` | `۲۶ی ئەیلوول` |

- Month and weekday names are copied from CLDR, not invented. Take the **format-context** short names (the ones CLDR uses next to a day number) with `node -e "const f=new Intl.DateTimeFormat(process.argv[1],{day:'numeric',month:'short',timeZone:'UTC'}); for (let m=1;m<=12;m++) console.log(f.formatToParts(new Date(Date.UTC(2026,m-1,15))).find((p)=>p.type==='month').value)" de` (Node 26.4 ships ICU 78.3 / CLDR 48). Run it for `en`, `de` (`Jan.` … `Sept.` … `Dez.`; a bare `{month:'short'}` would give the stand-alone `Sep` instead), `fa-u-ca-gregory` for Persian (Gregorian months: ژانویه … دسامبر) and `ckb` for Sorani (کانوونی دووەم … کانونی یەکەم; CLDR has no shorter forms for either). This one-off Node command is tooling, so `Intl.DateTimeFormat` is fine there.
- CLDR 48 spells Sorani December `کانونی یەکەم` but January `کانوونی دووەم`; the Shell catalog uses `کانوونی یەکەم` for consistency and marks it for the native-speaker review.
- The English pattern follows spec S5 ("Daily - 26 Sep"), not en-US CLDR ("Sep 26").
- Durations ("2 h 14 min") are the `stats.duration` message; relative time ("3 days ago") is not used in v1.

### 3.10 Switching direction

#### Ordering inside `index.ts`

Each game's entry is three lines of code (FINAL A.8), plus the blank line that `import/order` requires between the package import and the sibling import. The polyfills are the first import of `start-shell.ts`, so they run before any other Shell or game module.

```ts
// apps/line-siege/index.ts
import { startShell } from '@e07/shell/app/start-shell.ts';

import { lineSiegeGame } from './src/index.ts';
startShell(lineSiegeGame);
```

```ts
// packages/shell/src/app/start-shell.ts
// MUST stay the first import: evaluated before any other Shell or game module.
import '@e07/shell/i18n/intl-polyfills.ts';

import { registerRootComponent } from 'expo';
import { getLocales } from 'expo-localization';

import { createShellApp } from '@e07/shell/app/create-shell-app.tsx';
import { markJsEntry } from '@e07/shell/app/perf/cold-start.ts';
import { createStartupSplash } from '@e07/shell/app/startup-splash.tsx';
import { languageFromRawSave, planDirection } from '@e07/shell/i18n/direction-plan.ts';
import { readLayoutDirection, restartForDirection } from '@e07/shell/i18n/direction.ts';
import { directionOf } from '@e07/shell/i18n/languages.ts';
import { resolveLanguage } from '@e07/shell/i18n/resolve-language.ts';
import { peekCurrentSave } from '@e07/shell/services/save/peek-current-save.ts';
import { createSqliteKvDirectionGuardAdapter } from '@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts';

import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';

// docs/15: the first JS timestamp of this runtime (a pure in-memory mark; harmless on reload).
markJsEntry();

// Called by apps/<game>/index.ts. Nothing here writes the save before the direction check:
// a reload re-runs every module, so writes before it would happen twice (verified gotcha).
export function startShell<T extends ShellGameTypes>(game: ShellGameModule<T>): void {
  const guard = createSqliteKvDirectionGuardAdapter();
  const language = resolveLanguage(languageFromRawSave(peekCurrentSave()), getLocales());
  const pendingRestart = guard.readPending();
  const plan = planDirection({ language, layout: readLayoutDirection(), pendingRestart });
  if (plan === 'restart') {
    // The splash calls restart() in its mount effect. Reloading while the bundle is still being
    // evaluated crashed a Release build ("startSurface failed. Global was not installed", docs/06).
    const restart = (): Promise<void> => restartForDirection(directionOf(language), guard);
    registerRootComponent(createStartupSplash(restart));
    return;
  }
  guard.writePending(null); // 'keep' or 'give-up' ('give-up' is logged by the app)
  registerRootComponent(createShellApp({ game, language, directionPlan: plan }));
}
```

- docs/06 section 7.2 owns `peekCurrentSave()` (opens `save.db` and returns the parsed `current` payload **without validating, migrating or writing**, or `null`), `createStartupSplash(restart)` (a flat view that calls `restart()` in `useEffect`) and `createShellApp`. docs/02 owns `ShellGameModule`. They were type-checked here as stubs, with docs/06's `startup-splash.tsx` used verbatim.
- **Import order is guarded by a test** in the guardrail project (which has Node types): read `start-shell.ts` and assert that its first `import` line is `import '@e07/shell/i18n/intl-polyfills.ts';`. `import/order` keeps side-effect imports where they are (verified: the file above passes docs/04's ESLint config).
- No Shell module may do I/O at import time: no database open, no store hydration, no save write. The polyfills and pure in-memory marks such as docs/15's `markJsEntry()` are the only module-level side effects, because running them twice across a reload is harmless.

#### The pure decision and the guard

```ts
// packages/shell/src/i18n/direction-plan.ts
import { directionOf, isLanguage } from './languages.ts';

import type { Direction, Language } from './languages.ts';

export type DirectionPlan = 'keep' | 'restart' | 'give-up';

export type DirectionPlanInput = {
  readonly language: Language;
  readonly layout: Direction; // what I18nManager reports for this JS run
  readonly pendingRestart: Direction | null; // set just before our previous reload
};

// Pure decision, run first at every startup and after S2/Settings language changes.
export function planDirection({
  language,
  layout,
  pendingRestart,
}: DirectionPlanInput): DirectionPlan {
  const desired = directionOf(language);
  if (desired === layout) return 'keep';
  // We already reloaded for this direction and it still does not match: never loop.
  if (pendingRestart === desired) return 'give-up';
  return 'restart';
}

// Reads settings.language from an unvalidated, un-migrated save document (read-only peek).
export function languageFromRawSave(raw: unknown): Language | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const settings: unknown = Reflect.get(raw, 'settings');
  if (typeof settings !== 'object' || settings === null) return null;
  const language: unknown = Reflect.get(settings, 'language');
  return isLanguage(language) ? language : null;
}
```

```ts
// packages/shell/src/i18n/direction-guard.ts
import type { Direction } from './languages.ts';

// Remembers "we are reloading to reach this direction" across one JS reload.
export type DirectionGuard = {
  readonly readPending: () => Direction | null;
  readonly writePending: (direction: Direction | null) => void;
};
```

```ts
// packages/shell/src/services/save/sqlite-kv-direction-guard-adapter.ts
// Vendor code lives in adapters (docs/04): this is the expo-sqlite/kv-store DirectionGuard.
import Storage from 'expo-sqlite/kv-store';

import type { DirectionGuard } from '@e07/shell/i18n/direction-guard.ts';

const KEY = 'shell.pending-direction-restart';

// Separate key-value database (expo-sqlite/kv-store), so the save document is not touched
// before the direction check. Sync API: safe to call before the first render.
export function createSqliteKvDirectionGuardAdapter(): DirectionGuard {
  return {
    readPending: () => {
      const value = Storage.getItemSync(KEY);
      return value === 'ltr' || value === 'rtl' ? value : null;
    },
    writePending: (direction) => {
      if (direction === null) Storage.removeItemSync(KEY);
      else Storage.setItemSync(KEY, direction);
    },
  };
}
```

```ts
// packages/shell/src/i18n/direction.ts
// The ONLY module allowed to read I18nManager.isRTL (ESLint exemption in eslint.config.mjs).
import { reloadAppAsync } from 'expo';
import { I18nManager } from 'react-native';

import type { DirectionGuard } from './direction-guard.ts';
import type { Direction } from './languages.ts';

// Constant for the whole JS run: RN computes it once when the module loads.
export function readLayoutDirection(): Direction {
  return I18nManager.isRTL ? 'rtl' : 'ltr';
}

// allowRTL AND forceRTL, always: allowRTL(false) keeps English LTR on a Persian phone.
export function forceLayoutDirection(direction: Direction): void {
  const isRtl = direction === 'rtl';
  I18nManager.allowRTL(isRtl);
  I18nManager.forceRTL(isRtl);
}

// Call only after the save is written (sync SQLite writes are complete on return).
export async function restartForDirection(
  direction: Direction,
  guard: DirectionGuard,
): Promise<void> {
  guard.writePending(direction);
  forceLayoutDirection(direction);
  await reloadAppAsync(`layout direction -> ${direction}`);
}
```

```tsx
// packages/shell/src/i18n/direction-context.tsx
import { createContext, use } from 'react';

import type { Direction } from './languages.ts';
import type { ReactNode } from 'react';

const DirectionContext = createContext<Direction>('ltr');

export type DirectionProviderProps = {
  readonly direction: Direction;
  readonly children: ReactNode;
};

// Root passes readLayoutDirection(); tests pass 'rtl' explicitly (Jest mocks isRTL=false).
export function DirectionProvider({ direction, children }: DirectionProviderProps): ReactNode {
  return <DirectionContext value={direction}>{children}</DirectionContext>;
}

export function useDirection(): Direction {
  return use(DirectionContext);
}
```

#### The three flows

| When | What happens |
|---|---|
| **Every startup** | `startShell` → `planDirection`. `keep`: clear the marker, render. `restart`: register the splash, which calls `restartForDirection` once mounted (no dialog; the player sees at most one extra splash frame). `give-up`: clear the marker, render in the current layout, log `direction-restart-failed` to `ErrorLogPort` (visible in the debug menu). This also repairs drift, e.g. after a device restore brought back an old `forceRTL` value. |
| **S2, first-run language choice** | Tapping a language previews it (the text, including "Continue", switches at once). **Continue** dispatches docs/06's `set-language`, which saves `settings.language` and `firstRun.languageChosen` together; if `planDirection` says `restart`, it then awaits `audio.dispose()` (docs/09 section 4.4) and calls `restartForDirection` (the Continue tap is the one tap). After the reload the first-run flow sees `languageChosen && !tutorialDone` and opens S13. |
| **Settings → Language** | Selecting a language saves it and switches the text at once. If the direction differs from `readLayoutDirection()`, show the S14 dialog `settings.language.restart.title` / `.body` with one primary button (**Restart**) and a secondary **Later**. **Restart** awaits `audio.dispose()` (docs/09 section 4.4), then calls `restartForDirection`. **Later** keeps the current layout until the next cold start, where the startup check fixes it. |

`DirectionContext` and React Navigation both get `readLayoutDirection()`: `<Navigation direction={readLayoutDirection()} theme={…} />` (React Navigation 7 static API; docs/06 section 3.4 owns the container). Page transitions then slide in the reading direction.

What is verified: in a Release build on an English iOS 26.5 simulator, `allowRTL(true) + forceRTL(true) + reloadAppAsync()` from a mounted component gave `isRTL = true` after the reload, a `flexDirection: 'row'` strip with `marginStart` mirrored, and the forced RTL persisted across relaunch and reinstall. Calling `reloadAppAsync` during bundle evaluation (right after `registerRootComponent`) crashed; reloading from the mounted splash worked for both flips (docs/06, verified twice). Not verified: Android (`reloadAppAsync` + `forceRTL`), which is re-checked when Android starts.

### 3.11 Styling rules

`AppText` is the only component that renders text. Its i18n-relevant part:

```ts
// packages/shell/src/i18n/use-localized-text-style.ts
import { useDirection } from './direction-context.tsx';
import { scriptFontFor } from './fonts.ts';
import { useLanguage } from './language-context.tsx';

import type { FontWeightToken } from './fonts.ts';
import type { Language } from './languages.ts';
import type { TextStyle } from 'react-native';

export type TextAlignToken = 'start' | 'center' | 'end';
export type LocalizedTextOptions = {
  readonly fontSize: number;
  readonly weight: FontWeightToken;
  readonly align: TextAlignToken;
  readonly language?: Language; // only for text in another language (language list)
};

// RN swaps 'left'/'right' when the layout is RTL (doLeftAndRightSwapInRTL), so
// 'left' means start. The default 'auto' stays physically left for an in-app RTL
// choice on an LTR phone (verified), so every text sets it explicitly.
export const TEXT_ALIGN = { start: 'left', center: 'center', end: 'right' } as const;

export function useLocalizedTextStyle(options: LocalizedTextOptions): TextStyle {
  const direction = useDirection();
  const appLanguage = useLanguage();
  const font = scriptFontFor(options.language ?? appLanguage, options.weight);
  return {
    ...(font.fontFamily === undefined ? {} : { fontFamily: font.fontFamily }),
    ...(font.fontWeight === undefined ? {} : { fontWeight: font.fontWeight }),
    fontSize: options.fontSize,
    lineHeight: Math.round(options.fontSize * font.lineHeightRatio),
    writingDirection: direction,
    textAlign: TEXT_ALIGN[options.align],
  };
}
```

`AppText` itself is owned by docs/05 (`packages/shell/src/ui/app-text.tsx`). Its i18n contract is: take `variant` (a `TypeRole`) and look up `fontSize` and `weight` in `TYPE_SCALE`; pass them, `align` (default `'start'`) and the optional `language` to `useLocalizedTextStyle`; render `<Text style={[localized, { color }]} maxFontSizeMultiplier={2}>`; and set `accessibilityLanguage` when `language` is given. `<T>` forwards every `AppTextProps` except `text` and `language`. `maxFontSizeMultiplier={2}` caps growth at 200% (spec 8.11). Verified alignment facts (iOS 26.5, forced RTL on an English phone): `textAlign: 'left'` rendered on the right, `'right'` on the left, `'auto'` stayed on the left, and `writingDirection: 'rtl'` produced a correct RTL paragraph.

ESLint: docs/04's `eslint.config.mjs` already carries every i18n rule; do not add copies. For reference:
- `SYNTAX.physicalStyleKeys` bans left/right keys only inside style contexts (`StyleSheet.create`, `*style` props, `*Style`-typed variables), so pure game rules can keep `left`/`right` as data (for example swipe vectors). `SYNTAX.textAlignLiteral` and `SYNTAX.rowReverse` cover the rest of rule 15.
- `RESTRICTED_PROPERTIES` bans `I18nManager.isRTL`, and `I18N_MANAGER_IMPORT` bans the `I18nManager` import. The `DIRECTION_MODULE` block exempts `direction.ts` only.
- `TEXT_IMPORT` bans `Text` from `react-native` everywhere except `app-text.tsx`. `REACT_INTL_IMPORT` bans `react-intl` everywhere except `packages/shell/src/i18n/`.
- Block 5-i18n runs `formatjs/no-literal-string-in-jsx` (eslint-plugin-formatjs 8.1.0) on the translatable props, with `settings.formatjs.additionalFunctionNames: ['t']` and `additionalComponentNames: ['T']`.
- The formatjs content rules (`enforce-placeholders`, `enforce-plural-rules`, …) are **not** used: they skip id-only calls, so with JSON-first catalogs they check nothing (FINAL 28). The catalog linter replaces them.

Icons: docs/05's `Icon` flips the icons listed in its `DIRECTIONAL_ICONS` with `transform: [{ scaleX: -1 }]` when `useDirection()` is `'rtl'` (docs/05 section 3.10), so no call site can forget it. Only back/next/previous arrows, chevrons and "forward" progress arrows are in that list. The 7-day strip, bar charts and progress bars mirror through `flexDirection: 'row'` and `start`/`end`, not through transforms.

### 3.12 Game boards

- The Shell's board host wraps the board area: `<View style={isMirrored ? styles.board : styles.boardLtr}>` with `boardLtr: { direction: 'ltr' }`. `isMirrored` is the game module's `isMirroredInRtl` declaration (spec 10 "Declares whether the board mirrors in RTL (default: no)"; defined in `docs/08-game-engine.md`). Verified: a `direction: 'ltr'` view kept `1 2 3` left-to-right and an absolute `left: 0` marker on the left while the surrounding UI mirrored.
- Skia draws in physical coordinates, so `direction` only affects RN views inside the board (trays, overlays). A game that opts in to mirroring mirrors inside its `BoardLayout` mapping (x → width − x), used by both `draw` and `hitTest` (FINAL 18). Gestures are physical: a swipe left moves things left.
- Numbers on boards are formatted in JS with `createNumberFormatter(localeTagFor(language, digits))` and passed to the draw function as strings. Arabic-script text on a board goes through a Skia `Paragraph` with `TextDirection.RTL` and the Vazirmatn typeface registered from the bundled TTF; `drawText` is only for Latin strings and lone digits. Golden tests register the same font files explicitly.
- Physical style keys inside board code are allowed only in data, never in `StyleSheet.create`; the ESLint selector above enforces that.

### 3.13 Fonts and line height

```ts
// packages/shell/src/i18n/fonts.ts
import type { Language } from './languages.ts';

export type FontWeightToken = 'regular' | 'bold';
export type ScriptFont = {
  readonly fontFamily?: string;
  readonly fontWeight?: '400' | '700';
  readonly lineHeightRatio: number;
};

// Vazirmatn v33.003 static TTFs, embedded by the expo-font config plugin.
// The file name equals the PostScript name, so the same string works on iOS and Android.
// Never combine fontWeight with a custom family: pick the weight's own family instead.
const ARABIC_SCRIPT: Readonly<Record<FontWeightToken, ScriptFont>> = {
  regular: { fontFamily: 'Vazirmatn-Regular', lineHeightRatio: 1.5 },
  bold: { fontFamily: 'Vazirmatn-Bold', lineHeightRatio: 1.5 },
};

// Latin family is decided in the design step; until then the platform font with weights.
const LATIN_SCRIPT: Readonly<Record<FontWeightToken, ScriptFont>> = {
  regular: { fontWeight: '400', lineHeightRatio: 1.3 },
  bold: { fontWeight: '700', lineHeightRatio: 1.3 },
};

// Font follows the language of the TEXT (autonyms in the language list use their own).
export function scriptFontFor(language: Language, weight: FontWeightToken): ScriptFont {
  return language === 'fa' || language === 'ckb' ? ARABIC_SCRIPT[weight] : LATIN_SCRIPT[weight];
}
```

The `expo-font` plugin entry lives in docs/02's `shellPlugins` (section 9.1): `['expo-font', { fonts: ['./assets/fonts/Vazirmatn-Regular.ttf', './assets/fonts/Vazirmatn-Bold.ttf'] }]`, with paths relative to the app folder. The files live in each app's `assets/fonts/` (this doc owns them; the new-game scaffold copies them, and the board goldens and art scripts load them from there).

- Source: `https://github.com/rastikerdar/vazirmatn/releases/download/v33.003/vazirmatn-v33.003.zip`, path `fonts/ttf/Vazirmatn-{Regular,Bold}.ttf` (about 123 KB each). Commit them with `OFL.txt`; S11d lists "Vazirmatn 33.003, SIL Open Font License 1.1".
- Coverage (fontTools cmap, verified): all Persian letters, all Sorani letters including ڕ ڵ ۆ ێ ە ڤ ھ, `۰–۹`, `٠–٩`, `٫ ٬ ٪ ، ؛ ؟`, ZWNJ/ZWJ, LRM/RLM. Missing: U+061C ALM (so we use FSI/PDI) and U+1E9E ẞ (German capital sharp s, handled by the Latin font). Backup font: Noto Sans Arabic 2.012 (OFL, covers ALM, variable, 845 KB).
- Never load fonts at runtime (`useFonts`, `Font.loadAsync` with URLs): the config plugin embeds them, so they exist at the first frame and nothing is downloaded (N1).
- The line-height ratios are starting values; the screenshot matrix (fa, ckb at 200% text) is the judge, and the design step may tune them in the theme.
- The debug menu has a font test page: every Persian and Sorani letter, both digit sets, the separators, and a mixed-direction sentence with isolates, in every font and weight (spec 7.6). It is part of the screenshot matrix before each release.

### 3.14 `npm run i18n:verify`: formatjs verify + the catalog linter

```json
{ "scripts": { "i18n:verify": "node packages/tooling/src/i18n/verify-catalogs.ts" } }
```

(The script name and path are the contract in `docs/16-quality-gates-hooks-ci.md`.)

```ts
// packages/tooling/src/i18n/verify-catalogs.ts
// `npm run i18n:verify`: FormatJS parity check + our catalog linter, for the Shell and every game.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { lintDirectory } from './catalog-lint.ts';

import type { Namespace } from './catalog-lint-rules.ts';

type CatalogDir = { readonly dir: string; readonly namespace: Namespace };

// The game id is the app folder name (apps/<game-id>), which is also the key prefix (docs/03).
function catalogDirs(root: string): CatalogDir[] {
  const apps = join(root, 'apps');
  const gameIds = existsSync(apps) ? readdirSync(apps) : [];
  const games = gameIds
    .map((gameId) => ({ gameId, dir: join(apps, gameId, 'src', 'i18n') }))
    .filter(({ dir }) => existsSync(dir))
    .map(({ gameId, dir }) => ({ dir, namespace: { kind: 'game', gameId } as const }));
  const shellDir = join(root, 'packages', 'shell', 'src', 'i18n', 'catalogs');
  return [{ dir: shellDir, namespace: { kind: 'shell', gameIds } }, ...games];
}

// Exits non-zero on a missing/extra key or a placeholder/structure mismatch (verified).
function formatjsVerify(dir: string): boolean {
  const args = ['formatjs', 'verify', '--source-locale', 'en', '--missing-keys', '--extra-keys'];
  try {
    execFileSync('npx', [...args, '--structural-equality', join(dir, '*.json')], {
      stdio: 'inherit',
    });
    return true;
  } catch {
    return false;
  }
}

function main(root: string): void {
  let failures = 0;
  for (const { dir, namespace } of catalogDirs(root)) {
    const problems = lintDirectory(dir, namespace);
    for (const line of problems) console.error(line);
    if (!formatjsVerify(dir) || problems.length > 0) failures += 1;
  }
  console.error(`i18n:verify: ${String(failures)} catalog dir(s) failing`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main(process.cwd());
```

What `formatjs verify` catches (verified with `@formatjs/cli` 6.16.32): a key missing in any language, an extra key, a different set of variables, and a variable whose type differs (`Variable level has conflicting types: number vs argument`). It does **not** require the same plural categories in every language (a fa message with only `other` passed), which is why the linter checks plurals.

#### The catalog-linter spec

| Id | Rule | Applies to | Message |
|---|---|---|---|
| L1 | Key shape: 2–5 lowercase kebab segments; game keys start with `<game-id>.`; Shell keys never start with a game id | all | `key must be 2-5 dot-separated kebab-case segments` |
| L2 | Message parses as ICU (`requiresOtherClause: true`) | all | `ICU syntax error: …` |
| L3 | No `{x, date}`, `{x, time}` or rich-text tags | all | `no {x, date}/{x, time}: use formatDayMonth` |
| L4 | Placeholder names camelCase; plain `{x}` only for `*Name`/`*Text`; those names never used for numbers, plurals or selects | all | `{level} is plain text: name it *Name/*Text, or use {level, number} / plural` |
| L5 | Plural: no `selectordinal`, no `offset`, only `one`, `other`, `=N`; `one` present | all | `plural category "few" does not exist in en/de/fa/ckb` |
| L6 | A `{x, number}` directly followed by a word must be a plural | en | `{moves, number} is followed by a word: use {moves, plural, …}` |
| L7 | No literal digits in any script (numbers are placeholders) | all | `literal digits: numbers must be placeholders` |
| L8 | No bidi controls (U+202A–U+202E, U+2066–U+2069) or ALM (U+061C) | all | `bidi controls/ALM in catalog: t() isolates values` |
| L9 | No Arabic ي (U+064A) or ك (U+0643): use Persian ی (U+06CC) and ک (U+06A9) | fa, ckb | `Arabic ي/ك: use Persian ی/ک` |
| L10 | No Latin `,` `;` `?` in text: use `،` `؛` `؟` | fa, ckb | `Latin , ; ? in fa/ckb: use ، ؛ ؟` |
| L11 | Full sentence: not empty, no leading/trailing space or joiner (`, ; : + & / – -`), no double space, English does not start lowercase, not a bare placeholder | all (lowercase check: en) | `starts/ends with space or joiner: fragment of a glued sentence?` |
| L12 | Keys sorted alphabetically in each file | all | `keys are not sorted alphabetically` |

All rules fired on deliberately bad catalogs (verified, including a game catalog with a Shell-style key and unsorted keys). The implementation (complete, 3 files):

```ts
// packages/tooling/src/i18n/icu-walk.ts
import { isPluralElement, isSelectElement, isTagElement } from '@formatjs/icu-messageformat-parser';

import type { MessageFormatElement } from '@formatjs/icu-messageformat-parser';

// Depth-first visit of every element, including those inside plural/select options and tags.
// `next` is the sibling that follows the element (used by the count-needs-plural rule).
export type Visit = (el: MessageFormatElement, next: MessageFormatElement | undefined) => void;

export function walk(elements: readonly MessageFormatElement[], visit: Visit): void {
  elements.forEach((el, index) => {
    visit(el, elements[index + 1]);
    if (isPluralElement(el) || isSelectElement(el)) {
      for (const option of Object.values(el.options)) walk(option.value, visit);
    }
    if (isTagElement(el)) walk(el.children, visit);
  });
}
```

```ts
// packages/tooling/src/i18n/catalog-lint-rules.ts
import {
  isArgumentElement,
  isDateElement,
  isLiteralElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  isTimeElement,
  parse,
} from '@formatjs/icu-messageformat-parser';

import { walk } from './icu-walk.ts';

import type { MessageFormatElement } from '@formatjs/icu-messageformat-parser';

export type Language = 'en' | 'de' | 'fa' | 'ckb';
// Shell keys must not start with a game id; game keys must start with their own (docs/03).
export type Namespace =
  | { readonly kind: 'shell'; readonly gameIds: readonly string[] }
  | { readonly kind: 'game'; readonly gameId: string };
export type MessageContext = {
  readonly language: Language;
  readonly key: string;
  readonly message: string;
  readonly namespace: Namespace;
};

const KEY_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*){1,4}$/; // docs/03 grammar
const ARG_NAME = /^[a-z][A-Za-z0-9]*$/;
const TEXT_ARG = /(Name|Text)$/;
const PLURAL_OPTION = /^(one|other|=\d+)$/;
const ANY_DIGIT = /[0-9\u0660-\u0669\u06F0-\u06F9]/;
const BANNED_CONTROLS = /[\u061C\u202A-\u202E\u2066-\u2069]/;
const ARABIC_ONLY_LETTERS = /[\u064A\u0643]/; // Arabic yeh and kaf: use ی (U+06CC) and ک (U+06A9)
const LATIN_PUNCTUATION = /[,;?]/; // fa/ckb use ، ؛ ؟
const JOINER_EDGE = /^[\s,;:+&/\u2013-]|[\s,;:+&/\u2013-]$/;

function namespaceProblem(key: string, namespace: Namespace): string | null {
  if (namespace.kind === 'game') {
    return key.startsWith(`${namespace.gameId}.`)
      ? null
      : `game keys start with "${namespace.gameId}."`;
  }
  const owner = namespace.gameIds.find((id) => key.startsWith(`${id}.`));
  return owner === undefined ? null : `"${owner}." is reserved for that game's catalog`;
}

export function checkKey({ key, namespace }: MessageContext): string[] {
  const problems: string[] = [];
  if (!KEY_FORMAT.test(key)) problems.push('key must be 2-5 dot-separated kebab-case segments');
  const problem = namespaceProblem(key, namespace);
  if (problem !== null) problems.push(problem);
  return problems;
}

export function parseMessage(message: string): MessageFormatElement[] | string {
  try {
    return parse(message, { requiresOtherClause: true, shouldParseSkeletons: true });
  } catch (error) {
    return `ICU syntax error: ${String(error)}`;
  }
}

function checkBannedElement(el: MessageFormatElement): string[] {
  if (isDateElement(el) || isTimeElement(el)) return ['no {x, date}/{x, time}: use formatDayMonth'];
  if (isTagElement(el)) return ['no rich-text tags in messages'];
  return [];
}

function checkPlaceholderName(el: MessageFormatElement): string[] {
  if (isLiteralElement(el) || !('value' in el) || typeof el.value !== 'string') return [];
  const name = el.value;
  if (!ARG_NAME.test(name)) return [`placeholder "${name}" must be camelCase`];
  const isPlainText = isArgumentElement(el);
  if (isPlainText && !TEXT_ARG.test(name)) {
    return [`{${name}} is plain text: name it *Name/*Text, or use {${name}, number} / plural`];
  }
  if (!isPlainText && TEXT_ARG.test(name)) {
    return [`"${name}" ends in Name/Text, which is reserved for plain-text placeholders`];
  }
  return [];
}

function checkPlural(el: MessageFormatElement): string[] {
  if (!isPluralElement(el)) return [];
  if (el.pluralType === 'ordinal') return ['selectordinal is not used in this project'];
  if (el.offset !== 0) return ['plural offset is not allowed'];
  const options = Object.keys(el.options);
  const bad = options.filter((option) => !PLURAL_OPTION.test(option));
  const problems = bad.map(
    (option) => `plural category "${option}" does not exist in en/de/fa/ckb`,
  );
  if (!options.includes('one'))
    problems.push('every plural needs "one" and "other" in all four languages');
  return problems;
}

function checkCountNeedsPlural(
  el: MessageFormatElement,
  next: MessageFormatElement | undefined,
): string[] {
  if (!isNumberElement(el) || next === undefined || !isLiteralElement(next)) return [];
  return /^\s+\p{L}/u.test(next.value)
    ? [`{${el.value}, number} is followed by a word: use {${el.value}, plural, one {…} other {…}}`]
    : [];
}

function checkLiteral(el: MessageFormatElement, language: Language): string[] {
  if (!isLiteralElement(el)) return [];
  const problems: string[] = [];
  if (ANY_DIGIT.test(el.value)) problems.push('literal digits: numbers must be placeholders');
  if (BANNED_CONTROLS.test(el.value))
    problems.push('bidi controls/ALM in catalog: t() isolates values');
  const isArabicScript = language === 'fa' || language === 'ckb';
  if (isArabicScript && ARABIC_ONLY_LETTERS.test(el.value))
    problems.push('Arabic ي/ك: use Persian ی/ک');
  if (isArabicScript && LATIN_PUNCTUATION.test(el.value))
    problems.push('Latin , ; ? in fa/ckb: use ، ؛ ؟');
  return problems;
}

export function checkSentence({ language, message }: MessageContext): string[] {
  const problems: string[] = [];
  if (message.trim() === '') problems.push('empty message');
  if (JOINER_EDGE.test(message))
    problems.push('starts/ends with space or joiner: fragment of a glued sentence?');
  if (/ {2}/.test(message)) problems.push('double space');
  if (language === 'en' && /^\p{Ll}/u.test(message))
    problems.push('English message starts lowercase: fragment?');
  return problems;
}

export function checkElements(
  elements: readonly MessageFormatElement[],
  ctx: MessageContext,
): string[] {
  const problems: string[] = [];
  walk(elements, (el, next) => {
    problems.push(...checkBannedElement(el), ...checkPlaceholderName(el), ...checkPlural(el));
    problems.push(...checkLiteral(el, ctx.language));
    if (ctx.language === 'en') problems.push(...checkCountNeedsPlural(el, next));
  });
  if (
    elements.length === 1 &&
    elements[0] !== undefined &&
    !isLiteralElement(elements[0]) &&
    !isPluralElement(elements[0]) &&
    !isSelectElement(elements[0])
  ) {
    problems.push('message is a bare placeholder: put the whole sentence in the catalog');
  }
  return problems;
}

export function lintMessage(ctx: MessageContext): string[] {
  const parsed = parseMessage(ctx.message);
  const base = [...checkKey(ctx), ...checkSentence(ctx)];
  return typeof parsed === 'string' ? [...base, parsed] : [...base, ...checkElements(parsed, ctx)];
}
```

```ts
// packages/tooling/src/i18n/catalog-lint.ts
// Lints the four catalogs of one directory. The CLI is verify-catalogs.ts (`npm run i18n:verify`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { lintMessage } from './catalog-lint-rules.ts';

import type { Language, Namespace } from './catalog-lint-rules.ts';

const LANGUAGES: readonly Language[] = ['en', 'de', 'fa', 'ckb'];

function readCatalog(dir: string, language: Language): Record<string, string> {
  const parsed: unknown = JSON.parse(readFileSync(join(dir, `${language}.json`), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null)
    throw new Error(`${dir}/${language}.json: not an object`);
  return parsed as Record<string, string>;
}

// docs/03: catalog files keep their keys sorted alphabetically (stable diffs).
function sortProblem(dir: string, language: Language, keys: readonly string[]): string[] {
  const sorted = [...keys].sort();
  const isSorted = keys.every((key, index) => key === sorted[index]);
  return isSorted ? [] : [`${dir}/${language}.json: keys are not sorted alphabetically`];
}

export function lintDirectory(dir: string, namespace: Namespace): string[] {
  const report: string[] = [];
  for (const language of LANGUAGES) {
    const catalog = readCatalog(dir, language);
    report.push(...sortProblem(dir, language, Object.keys(catalog)));
    for (const [key, message] of Object.entries(catalog)) {
      for (const problem of lintMessage({ language, key, message, namespace })) {
        report.push(`${dir}/${language}.json  ${key}: ${problem}`);
      }
    }
  }
  return report;
}
```

`catalog-lint.ts` and `catalog-lint-rules.ts` have no top-level side effects and no `import.meta`, so Jest (Babel) can test them directly (docs/04 section 2.3). `verify-catalogs.ts` is the only CLI. `packages/tooling/package.json` sets `"type": "module"` (otherwise Node prints `MODULE_TYPELESS_PACKAGE_JSON` for every script) and lists `@formatjs/icu-messageformat-parser` 3.5.20 as a dev dependency.

### 3.15 Testing

#### Jest

docs/07 owns `jest.config.js` (section 3.4). The two i18n parts are already in it; do not add copies:
- The shared project settings list `<rootDir>/packages/shell/src/i18n/intl-polyfills.ts` in `setupFiles`, so both the `unit` and the `golden` project (board labels in pixel goldens) format numbers exactly like the app.
- `TRANSPILE_PACKAGES` contains `react-intl`, `@formatjs` and `intl-messageformat`, because the FormatJS packages ship ESM only (`"type": "module"`).

`jest-expo/ios` with docs/07's config, root mocks and `jest.setup.ts` ran every test below on 2026-09-26.

What to test with Jest (all of these exist and pass in the verification workspace):

| Unit | Test | Asserts |
|---|---|---|
| `resolveLanguage` | `resolve-language.test.ts` | saved wins; ckb, `ku-Arab`, prs, `ku-Latn`→next, `kmr`→en, empty→en |
| digits | `digits.test.ts` | polyfills active; the table in 3.5; `۱٬۲۳۴٫۵` and `۴۲٪` for ckb |
| `t()` | `create-t.test.ts` | the plural table in 3.7; FSI/PDI around `packName`; a number passed to `packName` is reported |
| weekday, dates | `format-date.test.ts` | `isoWeekday`: 2026-09-26 → 6, 2024-02-29 → 4, 2000-01-01 → 6; `formatDayMonth` in all four languages |
| direction plan | `direction-plan.test.ts` | keep / restart / give-up; `languageFromRawSave` tolerates garbage |
| `<T>` | `t.test.tsx` | renders through docs/07's `renderWithShell` with `{ language: 'fa', direction: 'rtl' }` with `writingDirection: 'rtl'`, `textAlign: TEXT_ALIGN.start`, `fontFamily: 'Vazirmatn-Bold'`, `lineHeight: 30` (`variant="heading"` = 20 pt bold) |

Component tests set direction explicitly: `@react-native/jest-preset` mocks `I18nManager.isRTL = false`, and Jest computes no layout, so mirroring itself is only visible in screenshots. Test files may compare RTL text in expected strings; they never use physical style literals (the lint rule also applies to tests, hence `TEXT_ALIGN.start`). `t.test.tsx` is the one component test that asserts styles (docs/07 rule 26 otherwise forbids it): alignment, direction and script font are the i18n contract, and outside this test only screenshots show them.

```tsx
// packages/shell/src/i18n/t.test.tsx
import { screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { T } from './t.tsx';
import { TEXT_ALIGN } from './use-localized-text-style.ts';

describe('T', () => {
  it('renders the translated sentence with RTL writing direction and start alignment', async () => {
    await renderWithShell(
      <T
        id="home.play-button.continue"
        values={{ level: 12 }}
        variant="heading"
        testID="home.play-label"
      />,
      { language: 'fa', direction: 'rtl' },
    );
    const label = screen.getByTestId('home.play-label');
    expect(label).toHaveTextContent('ادامه - مرحلهٔ ۱۲');
    expect(label).toHaveStyle({
      writingDirection: 'rtl',
      textAlign: TEXT_ALIGN.start,
      fontFamily: 'Vazirmatn-Bold',
      lineHeight: 30,
    });
  });
});
```

#### Simulator

| Purpose | Command (verified on Xcode 26.6, iOS 26.5) |
|---|---|
| "System" language path (device language) | `xcrun simctl launch <udid> <bundleId> -AppleLanguages "(fa)" -AppleLocale fa_IR` (for Sorani: `-AppleLanguages "(ckb)" -AppleLocale ckb_IQ`; `getLocales()[0].languageTag` was `ckb`) |
| Forced in-app language/digits (test variant) | the debug deep link (docs/07 section 3.12), or launch arguments read with React Native's `Settings.get('<key>')` (verified today: `-skmode buy` reached `Settings.get('skmode')` in a Release build), for example `-shellLanguage ckb -shellDigits latin`, read only by test-only code |
| Screenshot | `xcrun simctl status_bar <udid> override --time 9:41` then `xcrun simctl io <udid> screenshot out.png` |
| 200% text | `xcrun simctl ui <udid> content_size accessibility-extra-extra-extra-large` |
| Read app logs | `xcrun simctl spawn <udid> log show --last 2m --info --debug --style compact --predicate 'process == "<App>" AND eventMessage CONTAINS "[TAG]"'` (`--info --debug` are required for RN `console.log` in Release) |

On-device Intl probe (rerun after every RN/Hermes upgrade; test variant only, printed by the debug menu): `typeof Intl.PluralRules`, `typeof Intl.Locale`, `new Intl.NumberFormat('ckb-u-nu-arabext').format(1234.5)`, `areIntlPolyfillsActive()`. Expected today: native `undefined`, `undefined`, and after polyfills `۱٬۲۳۴٫۵`, `true`.

The screenshot matrix (4 languages × light/dark × phone/tablet, plus 200% text) is owned by docs/07 (section 3.13). It is the only check of mirroring, alignment, clipping and fonts.

### 3.16 Translation workflow and the language list

1. **Claude writes English first**, as full sentences with named placeholders, then German (informal "du", D7), Persian and Sorani (friendly, neutral tone). Reuse terms from `packages/shell/src/i18n/glossary.json` (term → en/de/fa/ckb: Level, Star, Pack, Daily challenge, Streak, Premium, Hint, Continue, Undo). Add a term there before using it in a second message.
2. Run `npm run i18n:verify`, then the screenshot matrix for fa and ckb.
3. **The owner's native review, never a gate** (spec 7.4, owner steps G7 and R3 in `docs/14-ios-build-and-release.md`; FINAL H.6 and H.20, L14). `packages/tooling/src/i18n/review-sheet.ts` writes `reports/i18n/review-<lang>.csv` (key, English, current text, and where it shows) for every fa/ckb text that differs from its reviewed hash, prints the count, and always exits 0 (2 only for bad input). Every report lists the waiting texts under "Owner steps (not blocking)". The owner reads them and sends corrections; Claude applies them.
4. **Recording the review.** `packages/shell/src/i18n/review-state.json` stores, per language and key, the SHA-256 of the reviewed text and the review date. After the owner's answers are applied, `review-sheet.ts --mark-reviewed <fa|ckb> --date YYYY-MM-DD [--key <key>]...` records the current texts as reviewed. `release:ios` runs the sheet, prints "Owner step R3 (not blocking)" with the CSV paths and goes on; there is no gate to pass and no waiver to record.
5. Machine-written Sorani is the highest risk; prefer short, plain sentences. CLDR data (months, weekdays) is copied, never translated by hand.

Language list (S2, S11a): the rows are, in this order, **System** (translated: `settings.language.system` = "System ({languageName})", where `languageName` is the autonym of the language the resolver would pick), then `English`, `Deutsch`, `فارسی`, `کوردیی ناوەندی` from `LANGUAGE_AUTONYMS`. Each autonym row renders with `AppText language={code}` so Persian and Sorani use Vazirmatn even in an English UI. Autonyms never go through `t()` and never appear in catalogs; a unit test pins their exact values.

The consent form (UMP), Apple's tracking prompt and the StoreKit purchase sheet follow the device or iOS per-app language, not the in-app choice (believed; not verified for fa/ckb). The tracking prompt shows our `NSUserTrackingUsageDescription` from the matching `InfoPlist.strings`. The per-app language list in iOS Settings shows our four languages because of `supportedLocales`.

---

## 4. Checklist

- [ ] `npm run i18n:verify` passes for the Shell and every game (formatjs verify + all twelve linter rules).
- [ ] No string literal in JSX or translatable props; `npm run lint` is clean with the i18n entries in section 3.11.
- [ ] `start-shell.ts` has the polyfill import first; the guardrail test passes; no Shell module has other module-level side effects.
- [ ] Jest `setupFiles` of both projects (docs/07) list `intl-polyfills.ts`; `areIntlPolyfillsActive()` is true in a test.
- [ ] Every number in a message is `{x, number}`, a percent skeleton, or a plural `#`; every counted noun is a plural with `one` and `other`.
- [ ] Dates come from `formatDayMonth`; nothing calls `Intl.DateTimeFormat` or `toLocale*String` in app code.
- [ ] `expo-localization` plugin has only `supportedLocales`.
- [ ] Only `direction.ts` reads `I18nManager.isRTL`; navigation and `DirectionContext` use `readLayoutDirection()`.
- [ ] S2 Continue and Settings "Restart" call `restartForDirection` after the save is written; the startup check handles drift; a failed reload is logged, not repeated.
- [ ] Boards are wrapped in `direction: 'ltr'` unless the game opts in; directional icons flip, clocks do not.
- [ ] Vazirmatn Regular/Bold are embedded with `OFL.txt`, listed in S11d, and the font test page is in the screenshot matrix.
- [ ] Screenshots in fa and ckb (light/dark, phone/tablet, 200% text) show no clipping, no left-aligned RTL text and no wrongly mirrored board.
- [ ] fa/ckb texts waiting for the owner's review are listed in the report as an owner step (not blocking), with the review CSVs written; nothing waits for them.

---

## 5. Sources

- Hermes Intl status: https://github.com/facebook/hermes/blob/static_h/doc/Features.md, https://github.com/facebook/hermes/blob/main/doc/IntlAPIs.md
- FormatJS on React Native/Hermes: https://formatjs.github.io/docs/guides/react-native-hermes
- `@formatjs/intl-pluralrules`: https://formatjs.github.io/docs/polyfills/intl-pluralrules
- `@formatjs/intl-numberformat`: https://formatjs.github.io/docs/polyfills/intl-numberformat
- FormatJS CLI (`verify`): https://formatjs.github.io/docs/tooling/cli
- eslint-plugin-formatjs: https://formatjs.github.io/docs/tooling/linter
- react-intl on npm: https://registry.npmjs.org/react-intl
- CLDR plural rules: https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html
- Expo localization guide: https://docs.expo.dev/guides/localization/
- expo-localization reference: https://docs.expo.dev/versions/latest/sdk/localization/
- `reloadAppAsync`: https://docs.expo.dev/versions/latest/sdk/expo/#reloadappasyncreason
- expo-sqlite kv-store: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
- React Native I18nManager: https://reactnative.dev/docs/i18nmanager
- React Native layout props (`direction`, logical properties): https://reactnative.dev/docs/layout-props
- Unicode bidi isolates (UAX #9): https://www.unicode.org/reports/tr9/
- Vazirmatn v33.003: https://github.com/rastikerdar/vazirmatn/releases/tag/v33.003
- Noto Sans Arabic: https://github.com/google/fonts/tree/main/ofl/notosansarabic
- Expo fonts: https://docs.expo.dev/develop/user-interface/fonts/

---

## Verified

On 2026-09-26, on macOS with Node 26.4.0 (ICU 78.3, CLDR 48), npm 11.17.0, Xcode 26.6 and the iOS 26.5 simulator:

- **Code in this doc** (re-checked by the reviewer in `scratchpad/rn/verify-services-i18n`). Every full `.ts`/`.tsx` file, extracted from this doc, passed `tsc --noEmit` for each of docs/04's tsconfig projects (TypeScript 6.0.3). It also passed docs/04's `eslint.config.mjs` verbatim plus docs/05's additions (ESLint 9.39.5, `--max-warnings 0`), Prettier 3.9.9, and Jest 29.7 (`jest-expo/ios` 57.0.5, RNTL 14.0.1). Jest used docs/07's `jest.config.js`, `jest.setup.ts` and root mocks. `t.test.tsx` renders docs/05's real `AppText` and theme. `start-shell.ts` compiled against stubs of docs/06's `createShellApp`, docs/02's `ShellGameModule`, and docs/06's `startup-splash.tsx` and `date-key.ts` (verbatim). The canonical config caught what the writer's adapted config missed: a floating `void` promise, an `import/order` blank line in `index.ts`, and an `AppText` API mismatch. All three are fixed above.
- **Libraries:** react-intl 12.1.3 (intl-messageformat 12.1.2, whose plain-argument `String(value)` was read in the source), `@formatjs/intl-getcanonicallocales` 3.2.12 (its `polyfill.js` is conditional), `intl-locale` 5.3.12, `intl-pluralrules` 6.3.15, `intl-numberformat` 9.4.3, `@formatjs/icu-messageformat-parser` 3.5.20, `@formatjs/cli` 6.16.32, eslint-plugin-formatjs 8.1.0 (`no-literal-string-in-jsx` option schema read in the source and the rule fired on `accessibilityLabel="Play"`), expo-localization 57.0.2 (Jest mock returns en-US), expo-sqlite 57.0.3 (`kv-store` sync API).
- **formatjs verify:** exit 1 on a variable type mismatch (`number vs argument`) and on an extra key; exit 0 when a fa plural had only `other`.
- **Catalog linter:** all twelve rules fired on a deliberately bad catalog; the Shell sample catalog passes; `node packages/tooling/src/i18n/verify-catalogs.ts` ran under Node type stripping and failed on a game catalog with an unsorted Shell-style key.
- **CLDR month/weekday names** printed from Node's ICU for `en`, `de`, `fa-u-ca-gregory`, `ckb` with the command in section 3.9 (German format-context abbreviations: `Jan.` … `Sept.` … `Dez.`). `isoWeekday` matched 1970-01-01 (Thu), 2000-01-01 (Sat), 2024-02-29 (Thu) and 2026-09-26 (Sat).
- **Device facts** come from the services spike run on the same day (Expo SDK 57.0.25, RN 0.86.3, Hermes 250829098.0.17, Release build, iOS 26.5): native Hermes has no `PluralRules`/`Locale`, ignores `-u-nu-`, formats `fa` dates in the Solar Hijri calendar; the forced polyfills produce the digits above and load in 11 ms; `forceRTL` + `reloadAppAsync` works when called from a mounted component (during bundle evaluation it crashed, docs/06); `textAlign` behaviour as described; Vazirmatn renders all Sorani letters and invisible FSI/PDI. `-AppleLanguages "(ckb)"` produced `getLocales()[0].languageTag === 'ckb'`. `Settings.get()` reading a launch argument was verified in a Release build of the StoreKit harness app.
- **Not verified:** Android behaviour of everything above; real-device cold-start cost of the polyfills; how iOS reports Sorani from the real Settings language list (`ckb` vs `ku-Arab`, both handled); the UMP and StoreKit sheet language for in-app fa/ckb.

**Integration pass (2026-09-26).** `start-shell.ts` gained docs/15's `markJsEntry()` at module scope (after the imports, before `startShell()` runs); the file passed `tsc`, docs/04's ESLint and Prettier in `scratchpad/integ/ws`. The plugin-entry snippets for `expo-localization` and `expo-font` now point to docs/02's `shellPlugins`, which owns the one plugin list.

**`t.test.tsx` through `renderWithShell` (2026-09-26, `scratchpad/fix-final/repo`).** The test above renders `<T>` through docs/07's helper with `{ language: 'fa', direction: 'rtl' }` (real Persian catalog entry `home.play-button.continue`) and passes under jest-expo 57.0.5 and RNTL 14.0.1, with `tsc`, docs/04's merged ESLint and Prettier. The i18n folder also lints clean under the merged config, which now bans `useMemo` there (`UI_PATHS`).

**Re-verify** (versions age): `npm view react-intl version`, `npm view @formatjs/intl-pluralrules version`, `npm view @formatjs/intl-numberformat version`, `npm view @formatjs/cli version`, `npx expo install --check` in each app; then `npx jest packages/shell/src/i18n`, `npm run i18n:verify`, and the on-device Intl probe in section 3.15. If Hermes ever ships `PluralRules`, keep forcing the polyfills (Jest parity) unless a measured cold-start problem says otherwise.

---

## Open issues

1. **Resolved (integration pass, 2026-09-26):** docs/06 now imports this doc's `createSqliteKvDirectionGuardAdapter` and points to section 3.10 for `start-shell.ts` instead of copying it; docs/02's `index.ts` has the blank line `import/order` needs; docs/02 rule 16 allows pure in-memory marks such as docs/15's `markJsEntry()` at import time; `ErrorSource` has `'boot'` and `'i18n'` (docs/04).
2. **Language of the system sheets (UMP consent form, Apple's tracking prompt, StoreKit purchase sheet).** Google's consent form and Apple's purchase sheet follow the device language (the tracking prompt's own sentence comes from our `InfoPlist.strings` in that language), so a Persian player on an English phone sees them in English. Nothing in our control fixes this in v1; it is noted for the owner.
3. **Numbers row for en/de.** Spec S11 lists the Numbers row unconditionally; for en/de all three options produce Latin digits. The row stays (spec), with live previews so the effect is visible. If the owner prefers, it can be hidden for en/de without code changes elsewhere.
4. **CLDR spelling of Sorani December** (`کانونی یەکەم` vs `کانوونی یەکەم`) is inconsistent in CLDR 48; the catalog uses the second form pending the native-speaker review.
