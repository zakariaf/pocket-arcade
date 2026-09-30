# Runtime: polyfills, provider, t() and T

How text gets from a catalog to the screen at runtime, and why each piece is shaped the way it is. The code is in `templates/shell-i18n/` (copy to `packages/shell/src/i18n/`).

## Contents

- Packages and versions
- Why the Intl polyfills are forced
- The i18n folder
- Language resolution and expo-localization
- The locale tag (digits)
- t(), T and the provider
- Game keys
- Missing keys and errors
- Jest setup and the tests to keep
- On-device probe and re-verification

## Packages and versions

Verified on 2026-09-26 (Expo SDK 57, React Native 0.86.3, Hermes).

| Package | Version | Where | How |
|---|---|---|---|
| `react-intl` | 12.1.3 exact | Shell runtime | `npm install -E` (not in the Expo map) |
| `@formatjs/intl-getcanonicallocales` | 3.2.12 exact | Shell runtime | npm, exact |
| `@formatjs/intl-locale` | 5.3.12 exact | Shell runtime | npm, exact |
| `@formatjs/intl-pluralrules` | 6.3.15 exact | Shell runtime | npm, exact |
| `@formatjs/intl-numberformat` | 9.4.3 exact | Shell runtime | npm, exact |
| `expo-localization` | ~57.0.2 | app | `npx expo install expo-localization` |
| `@formatjs/cli` | 6.16.32 exact | root dev | npm, exact (for `formatjs verify`) |
| `@formatjs/icu-messageformat-parser` | 3.5.20 exact | `@e07/tooling` dev | npm, exact (the project linter imports it) |
| `eslint-plugin-formatjs` | 8.1.0 exact | root dev | npm, exact |

Re-verify before relying on a number: `npm view react-intl version`, `npm view @formatjs/intl-pluralrules version` (and the other polyfills), `npx expo install --check` in each app.

## Why the Intl polyfills are forced

Facts found on an iOS 26.5 Release build (Hermes 250829098.0.17):

- Hermes has **no `Intl.PluralRules` and no `Intl.Locale`**, and it **ignores `-u-nu-`** (digit selection). Every plural and every Persian digit would be wrong on the phone while Jest (Node, full ICU) passes.
- `fa` dates come out in the Solar Hijri calendar.
- One polyfill module, forced, fixes both, and forcing makes Jest identical to the phone.

`intl-polyfills.ts` imports, in this exact order: `@formatjs/intl-getcanonicallocales/polyfill.js` (conditional: Hermes has it, so it is normally a no-op), then **forced** `intl-locale`, `intl-pluralrules` + en/de/fa/ckb data, `intl-numberformat` + en/de/fa/ckb data. Locale data is imported statically because Metro cannot resolve template-string imports. No other locale data: each extra locale is bundle weight.

- It is the **first import of `packages/shell/src/app/start-shell.ts`**, so it runs before any other Shell or game module (a root test guards this: `templates/root-test/start-shell-imports.test.ts`).
- It is in Jest `setupFiles` of every project (unit and golden), so tests format exactly like the phone.
- Cost: the eight locale-data files are about 578 KB raw (70 KB gzip); the polyfills add 0.85 MB of minified JS and loaded in 11 ms on the simulator.
- `areIntlPolyfillsActive()` (`intl-status.ts`) is true only when the forced polyfills are the active implementations; the debug menu and `intl-status.test.ts` use it.

## The i18n folder

```
packages/shell/src/i18n/
  catalogs/en.json de.json fa.json ckb.json   # Shell texts (from the copy deck)
  intl-polyfills.ts  intl-status.ts
  languages.ts  resolve-language.ts  digits.ts
  bidi.ts  messages.ts  create-t.ts  t-context.ts  t-bridge.tsx  i18n-provider.tsx  t.tsx
  language-context.tsx  format-date.ts  game-message-text.ts
  direction*.ts  fonts.ts  use-localized-text-style.ts   # layout direction and fonts (RTL work)
apps/<game-id>/src/i18n/en.json de.json fa.json ckb.json   # game texts, keys "<game-id>.*" (keys.ts only if used)
packages/tooling/src/i18n/verify-catalogs.ts catalog-lint.ts catalog-lint-rules.ts icu-walk.ts
```

`react-intl` is imported only inside `packages/shell/src/i18n/` (an ESLint `no-restricted-imports` entry enforces it). Everything else uses `useT()` / `<T>`.

## Language resolution and expo-localization

- `resolveLanguage(saved, getLocales())`: the saved choice first (`settings.language`, `null` = "System"); then the first device locale that is ckb (or `ku` in Arabic script), fa or prs (Dari), de, en; otherwise en. `ku`/`kmr` in Latin script never map to ckb.
- The same resolver runs for S2's pre-selection and for the "System" row in Settings.
- The `expo-localization` config plugin entry is `['expo-localization', { supportedLocales: { ios: LOCALES, android: LOCALES } }]` with `LOCALES = ['en', 'de', 'fa', 'ckb']`, and **nothing else**. `supportsRTL`/`forcesRTL` would re-derive the layout direction from the device language at every launch and undo an in-app Persian choice on an English phone. `supportedLocales` writes `CFBundleLocalizations`, so iOS Settings lists our four languages per app.
- `LANGUAGE_AUTONYMS` (English, Deutsch, فارسی, کوردیی ناوەندی) are code, not catalog text; translators never change them, and a unit test pins them.

## The locale tag (digits)

`localeTagFor(language, digits)` (in `digits.ts`) gives the BCP 47 tag passed to `IntlProvider` and to every `Intl.NumberFormat`:

| Language | Automatic | Latin | Local |
|---|---|---|---|
| en | `en` | `en` | `en` |
| de | `de` | `de` | `de` |
| fa | `fa-u-nu-arabext` | `fa-u-nu-latn` | `fa-u-nu-arabext` |
| ckb | `ckb-u-nu-arabext` | `ckb-u-nu-latn` | `ckb-u-nu-arabext` |

ckb's CLDR default is Arabic-Indic `٠١٢`; the product wants Persian-style `۰۱۲` for Sorani too, hence `arabext`. Numbers that are not inside a catalog sentence (board labels, Settings previews) are formatted with a formatter built from the same tag; that and the Numbers setting are layout-direction work.

## t(), T and the provider

```tsx
<I18nProvider language={language} digits={settings.digits} gameCatalogs={game.catalogs} onError={logI18nError}>
  …app…
</I18nProvider>
```

- `I18nProvider` = react-intl's `IntlProvider` (locale tag, merged Shell + game messages, `defaultLocale="en"`) + `LanguageContext` + `TBridge`, which puts `t()` into `TContext`.
- `t(key, values)` wraps `formatMessage`. It adds two things: FSI/PDI isolation of `*Name`/`*Text` values, and a report through `onError` when a number is passed to a text placeholder.
- In JSX use `<T id="…" values={…} variant="…" />`; `T` renders `AppText`, so direction, alignment, script font and the 200 % text cap come with it.
- Where a string is needed (accessibility labels, `AppText` with extra layout, Skia paragraphs, props of UI components), call `const t = useT()` in the screen or its model hook and pass `t('…')`. Components receive translated strings; they never build them.
- Changing the language re-renders `I18nProvider` with new messages, so text switches at once. Layout direction does not (it needs a restart).

## Game keys

- `ShellMessageKey = keyof typeof en` (from the JSON import), so a typo in a Shell key is a type error.
- The Shell cannot know game keys, and `t()` does not accept a plain string. A game hands its texts to the Shell through its `GameModule` as plain `MessageId` strings (game-kit is pure and cannot import the Shell's branded type): the name, the HUD goal (`rules.hud(state).goal`, a `Message` `{ id, values }`), lose reasons, pack names, tutorial and how-to-play steps, statistics labels (`labelId`), the board's spoken summary. The game's contract test proves every one of those ids exists in all four catalogs.
- **The Shell turns them into text in one place:** `gameMessageText(t, message)` in `packages/shell/src/i18n/game-message-text.ts` (template `templates/shell-i18n/game-message-text.ts`), for every game text: the HUD goal, lose reasons, pack names, tutorial and how-to-play steps, stat labels, the board summary and any id from the game's tables. The game host wires it once (`RunText.gameText = (message) => gameMessageText(t, message)`); no other file, Shell or game, calls `asGameKey` (`check-i18n-code.mjs` fails `game-key-cast`).
- Game keys are written as literals in the game's own code (`{ id: 'line-siege.progress', values: { defeated, total } }`), never built from parts.
- `templates/game-i18n/keys.ts` is optional: typed tables of the game's plain literal ids (`GAME_TEXT_IDS`, `PACK_NAME_IDS`, `HOW_TO_PLAY_IDS`, `TUTORIAL_IDS`, all `as const`), with no import, so any game file may use them. `check-i18n-code.mjs` looks every literal up in the game catalog. They reach the Shell through the `GameModule` like every other game text, and the Shell shows each with `gameMessageText(t, { id })`. No table wraps its ids in `asGameKey`: only `game-message-text.ts` calls it (rule `game-key-cast`). Copy only the tables the game uses: knip fails on an unused file or export.

## Missing keys and errors

react-intl calls `onError` and shows the key. In the app `onError` goes to the error log (`errorLog.record('i18n', error)`); in tests it throws, so a missing key fails the test run. `check-catalogs.mjs` and `npm run i18n:verify` catch it earlier.

## Jest setup and the tests to keep

- The shared Jest project settings list `<rootDir>/packages/shell/src/i18n/intl-polyfills.ts` in `setupFiles`.
- `transformIgnorePatterns` must let Babel transpile `react-intl`, `@formatjs` and `intl-messageformat` (they ship ESM only).
- Component tests render through the project's `renderWithShell(ui, { language, direction })`, which wraps `I18nProvider` with the real English catalog by default; a missing message throws.

| Unit | Test (template) | Asserts |
|---|---|---|
| polyfills | `intl-status.test.ts` | polyfills active; `۱٬۲۳۴٫۵` for ckb; fa `one` holds 0 |
| `resolveLanguage` | `resolve-language.test.ts` | saved wins; ckb, `ku-Arab`, prs, `ku-Latn`->next, `kmr`->en, empty->en; autonyms pinned |
| `t()` | `create-t.test.ts` | the plural table; `=0` over fa `one`; Latin digits; percent; FSI/PDI; number to a text placeholder reported |
| dates | `format-date.test.ts` | `formatDayMonth` in all four languages; the month, weekday name, weekday letter and weekday-day-month helpers (the weekday number is game-kit's `isoWeekday` from `dates/date-key.ts`, tested there) |
| game texts | `game-message-text.test.ts` | a game `Message` in en/de/fa with its plural and digits; a bare id |
| `<T>` | `t.test.tsx` | English text; fa text with `writingDirection: 'rtl'`, start alignment, `Vazirmatn-Bold` |
| linter | `catalog-lint-rules.test.ts` | the rules fire; the debug menu exemption |
| start order | `start-shell-imports.test.ts` (root `test/integration/i18n/`) | the polyfills are the first import |

## On-device probe and re-verification

After every React Native or Hermes upgrade, print in the debug menu (test build): `typeof Intl.PluralRules`, `typeof Intl.Locale`, `new Intl.NumberFormat('ckb-u-nu-arabext').format(1234.5)`, `areIntlPolyfillsActive()`. Expected: `undefined`, `undefined` natively, then `۱٬۲۳۴٫۵` and `true` with the polyfills. If Hermes ever ships `PluralRules`, keep forcing the polyfills (Jest parity) unless a measured cold-start problem says otherwise.

The system sheets (Google's UMP consent form, Apple's StoreKit purchase sheet) follow the device language, not the in-app choice; a Persian player on an English phone sees them in English. Nothing in our control changes that in v1.
