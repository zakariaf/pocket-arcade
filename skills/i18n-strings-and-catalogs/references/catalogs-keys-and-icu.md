# Catalogs, keys and ICU messages

Everything about the text itself: where catalogs live, how keys are named, how placeholders and plurals are written, and every rule the catalog checker enforces.

## Contents

- Catalog files
- Key grammar
- Placeholders
- Numbers and plurals (CLDR categories, verified outputs)
- Free text and bidi isolation (and nested isolates)
- System dialog texts
- Dates and month names
- Writing rules for translators
- The catalog rules (L1-L12, P1-P4, F1, G1)
- What FormatJS verify does and does not catch

## Catalog files

| Catalog | Location | First key segment |
|---|---|---|
| Shell | `packages/shell/src/i18n/catalogs/{en,de,fa,ckb}.json` | a screen area (`home`, `pause`, `result`, `levels`, `daily`, `stats`, `settings`, `language`, `about`, `privacy`, `licences`, `premium`, `how-to-play`, `tutorial`, `consent`, `language-choice`, `splash`, `game-screen`, `debug`), or `common`, `dialog`, `date` |
| Game | `apps/<game-id>/src/i18n/{en,de,fa,ckb}.json` | the game id (`line-siege.…`) |

- A catalog is a **flat JSON object**: key -> ICU MessageFormat string. No nesting, no arrays, no comments.
- **English is the source.** A key exists in en.json first; de, fa and ckb have exactly the same keys.
- **Keys are sorted alphabetically** (JavaScript default sort) in every file, so diffs stay small. `copy-deck.mjs apply` writes sorted files; Prettier keeps the JSON shape (2-space indent).
- The game-id prefix makes a Shell/game key collision impossible: Shell keys never start with a game id, game keys always start with their own.
- The Shell's catalogs are the copy deck's `strings` (289 keys: every Shell screen S1-S15 and the system dialog text `consent.tracking.usage-description`) plus the ten Shell texts the deck lacks (`assets/shell-extras.json`). Create them with `copy-deck.mjs apply --all --extras`; a game's catalogs with `copy-deck.mjs apply --game <game-id>`.

## Key grammar

```
key      = segment "." segment [ "." segment ]{0,3}      2 to 5 segments
segment  = [a-z0-9]+ ( "-" [a-z0-9]+ )*                   lowercase ASCII kebab-case
regex    = ^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*){1,4}$
```

| Rule | Example | Rejected |
|---|---|---|
| `<area>.<element>[.<variant>]`, 2-5 kebab segments | `settings.language.restart.title` | `Home.Play`, `homePlay` |
| The key names the place, never the words | `result.lose.reason` | `result.the-monsters-broke-through` |
| The last segment names the role when an element has several texts | `.title`, `.body`, `.label`, `.description`, `.a11y-label`, `.a11y-hint`, `-button` | `.text1`, `.text2` |
| One key per whole sentence or label | `result.win.moves` | `result.win.moves.prefix` + `...suffix` |
| Plurals live inside the message | `{movesCount, plural, …}` | `…moves-one` / `…moves-other` keys |
| A text used on several screens with the same meaning has one `common.*` key | `common.levels`, `common.try-again` | `home.levels` + `pause.levels` |
| Keys are literals at the call site, or come from a typed table of literals | `t('home.play-button.continue')`, `MONTH_SHORT_KEYS[month - 1]` | `` t(`date.month-short.${month}`) `` |
| Game keys are handed over, never built | the game's `{ id: 'line-siege.board.summary', values }`, shown by the Shell with `gameMessageText(t, message)` | the Shell writing `` `${gameId}.win-title` `` |
| No key is a prefix of another key | `levels.pack.locked` | `levels.pack` and `levels.pack.locked` together |

Why literals: the TypeScript type `ShellMessageKey = keyof typeof en` and both checkers can only check keys they can see.

## Placeholders

| Kind | Syntax | Name | Value passed to `t()` |
|---|---|---|---|
| Number | `{level, number}`, `{rate, number, ::percent}`, `{year, number, ::group-off}` | camelCase, not ending in Name/Text | `number` |
| Counted noun | `{movesCount, plural, one {# move} other {# moves}}` | camelCase | `number` |
| Choice | `{mode, select, daily {…} other {…}}` | camelCase, not ending in Name/Text | `string` key |
| Free text | `{packName}`, `{dateText}`, `{priceText}` | ends in `Name` or `Text` | `string` (bidi-isolated by `t()`) |

- A plain `{x}` prints `String(value)` (read in `intl-messageformat` 12.1.2), which is Latin digits in every language. So every number in a sentence is `{x, number}`, a `::percent` skeleton, or a plural `#`, and a plain `{x}` is only for free text whose name ends in `Name` or `Text`.
- The store price is `{priceText}` (already formatted by the store), never `{price}`.
- The same key has the same placeholders with the same types in all four languages.
- Apostrophes: ASCII `'` is ICU's escape character. English uses the typographic ’ (U+2019); a literal brace is written `'{'`.

## Numbers and plurals

CLDR cardinal categories for our four languages (the only ones that exist):

| Language | `one` | `other` | Note |
|---|---|---|---|
| en | 1 | everything else | 0 -> other |
| de | 1 | everything else | 0 -> other |
| fa | **0** and 1 | everything else | an `=0` branch must exist in fa too if en has one |
| ckb | 1 | everything else | nouns after a number stay singular |

- Use `{count, plural, one {…} other {…}}` with **both** `one` and `other` in all four languages whenever a number is followed by a counted noun. Never branch on "is it 1?" in code.
- Exact matches (`=0`) are allowed and must then appear in **every** language. Persian puts 0 in `one`, so an English-only `=0` would print the Persian `one` form for zero.
- No `few`, `many`, `two`, `zero`, no `offset:`, no `selectordinal`.
- Durations are whole messages with plurals (`stats.duration`), never `"2" + " h"`.

Verified outputs of the same key in four languages (each line is an assertion in `create-t.test.ts`):

| Language | Message (copy deck) | Values | Output |
|---|---|---|---|
| en | `{movesCount, plural, one {# move} other {# moves}} – par {par, number}` | 1, 7 | `1 move – par 7` |
| en | same | 0, 7 | `0 moves – par 7` |
| de | `{movesCount, plural, one {# Zug} other {# Züge}} – Par {par, number}` | 2, 7 | `2 Züge – Par 7` |
| fa | `{movesCount, plural, one {# حرکت} other {# حرکت}} – هدف {par, number}` | 0, 7 | `۰ حرکت – هدف ۷` |
| ckb | `{movesCount, plural, one {# جووڵە} other {# جووڵە}} – ئامانج {par, number}` | 3, 7 | `۳ جووڵە – ئامانج ۷` |
| fa | `daily.streak.count` with `=0 {…}` | 0 | the `=0` text (`=0` wins over fa `one`) |
| ckb, Latin digits | `بەردەوامبوون – ئاستی {level, number}` | 12 | `بەردەوامبوون – ئاستی 12` |
| fa | `درصد برد {rate, number, ::percent}` | 0.42 | `درصد برد ۴۲٪` |

Persian and Sorani format with `٬` (U+066C) for grouping, `٫` (U+066B) for decimals and `٪` (U+066A) for percent. Which digits appear is decided by the locale tag (`fa-u-nu-arabext`, `fa-u-nu-latn`, …), never by the catalog.

## Free text and bidi isolation

- `t()` wraps every `*Name` / `*Text` value in U+2068 FIRST STRONG ISOLATE … U+2069 POP DIRECTIONAL ISOLATE, so a Latin pack name inside a Persian sentence cannot reorder it: `t('levels.pack.locked', { starsCount: 2, packName: 'Beginnings' })` in fa gives `برای باز کردن (FSI)Beginnings(PDI)، ۲ ستارهٔ دیگر جمع کنید.`.
- Numbers and select keys are never isolated (a select would stop matching).
- Catalogs never contain bidi controls themselves (U+202A-U+202E, U+2066-U+2069) or the Arabic Letter Mark U+061C, which the Vazirmatn font lacks.
- Tests compare with `FSI`/`PDI` in the expected string, or strip them with `stripIsolates()`.
- **Never isolate twice.** A text that already went through `t()` with a `*Name`/`*Text` value carries isolates inside it: every date from `formatDayMonth()` and `formatWeekdayDayMonth()` (the month name is a `monthName` value), and any `t()` result built with a name or text value. Passed straight into another message as a `*Text` value, `t()` wraps it again, and the nested FSI…PDI leave the outer isolate with no strong letter of its own, so iOS (CoreText) resolves it left to right: in fa, "روزانه – ۲۶ سپتامبر" shows the month before the day (the Chrome mockup draws it right, so only the device is wrong). Strip the inner isolates first, a date being one run of its language: `t('game-screen.mode.daily', { dateText: stripIsolates(formatDayMonth(date, t)) })` (`stripIsolates` in `packages/shell/src/i18n/bidi.ts`). The same holds for any formatted number text passed as a `*Text` value. `check-i18n-code.mjs` rule `nested-isolates` fails a formatter result or a `t()` call with a name or text value that goes straight into `t()` unstripped; `format-date.test.ts` shows both strings.

## System dialog texts

Some Shell texts are shown by iOS itself, not by the app: the purpose strings of `Info.plist` that a system permission dialog prints under its title. Today there is one, Apple's tracking prompt (App Tracking Transparency, owner decision O1): `consent.tracking.usage-description`, "Google uses this to show you ads that fit your interests. You see ads either way, and the game itself collects no data.", in all four languages from the copy deck.

- **Key:** `<area>.<topic>.usage-description`, under the screen area that leads to the dialog (`consent`, S3). The last segment marks it as a system dialog text for the checkers.
- **Plain text only:** no `{argument}`, plural, select or brace in any language (`copy-deck.mjs check` rule `system-text-plain`). Nothing formats it as ICU on the way to the dialog, so a placeholder would show as braces; iOS already names the app in the dialog title. One or two whole sentences, the same rules as any other text (L7-L11: no literal digits, Persian punctuation in fa/ckb, typographic apostrophes).
- **How it reaches the dialog:** `copy-deck.mjs apply --all` writes it into the four Shell catalogs like every deck text. The Shell's config composer `withShell` (`packages/shell/src/config/with-shell.ts`) writes the four texts as `locales.<lang>.ios.NSUserTrackingUsageDescription` next to `CFBundleDisplayName` (one `InfoPlist.strings` per language, Expo's documented way to localise `Info.plist` strings), and `shell-plugins.ts` passes the English text to the `expo-tracking-transparency` plugin as `userTrackingPermission`, the base value. The texts that reach `Info.plist` are exactly the catalogs' texts: if the config reads them from a TypeScript table (for example `packages/shell/src/config/tracking-usage.ts`, because `app.config.ts` runs under Node's type stripping without JSON imports), a unit test keeps that table equal to the four catalogs. iOS shows the text in the language of the phone (or of the app's language in iOS Settings), not the in-app choice. Once `shell-plugins.ts` exists (Shell step 8), `copy-deck.mjs check` requires every deck system text in all four catalogs (`system-text-missing`; a SKIP line before that step).
- **Review:** its fa and ckb drafts are on the owner's review list like every new text (owner decision O6; not blocking).

## Dates and month names

- The Shell never formats `Date` objects and never calls `Intl.DateTimeFormat`, `Date#toLocale*String` or ICU `{x, date}` / `{x, time}`. On iOS, Hermes formats `fa` dates in the Solar Hijri calendar and ignores the digit choice (verified).
- `format-date.ts` holds every date text, each from literal key tables: `formatDayMonth(dateKey, t)` (`date.day-month`), `formatWeekdayDayMonth` (`date.weekday-day-month`: Home's daily card, the S9 date line), `formatMonthShort` (`date.month-short.1..12`: the S9 calendar tile), `formatWeekdayName` (`date.weekday.1..7`: VoiceOver names of the week strip and the bars) and `formatWeekdayLetter` (`date.weekday-strip.1..7`: the strip's column heads). The weekday number is game-kit's `isoWeekday` in `dates/date-key.ts` (1 = Monday). All Gregorian, in all four languages; screens never build `date.*` keys themselves.
- 2026-09-26 -> `26 Sep` / `26. Sept.` / `۲۶ سپتامبر` / `۲۶ی ئەیلوول`.
- Month and weekday names are copied from CLDR, never invented. To print them (a one-off tooling command, so `Intl.DateTimeFormat` is fine here), run for `en`, `de`, `fa-u-ca-gregory`, `ckb`:

```sh
node -e "const f=new Intl.DateTimeFormat(process.argv[1],{day:'numeric',month:'short',timeZone:'UTC'}); for (let m=1;m<=12;m++) console.log(f.formatToParts(new Date(Date.UTC(2026,m-1,15))).find((p)=>p.type==='month').value)" de
```

- German uses the format-context abbreviations (`Jan.` … `Sept.` … `Dez.`); a bare `{month:'short'}` gives the stand-alone `Sep` instead.
- The English pattern follows the product ("Daily – 26 Sep"), not en-US CLDR ("Sep 26").
- CLDR 48 spells Sorani December `کانونی یەکەم` but January `کانوونی دووەم`; the catalogs use `کانوونی یەکەم` for consistency, pending the owner's review.

## Writing rules for translators

- Keep `one` and `other` in fa and ckb even when both forms are the same word (`۳ جووڵە`, `۵ ستاره`): nouns after a number stay singular in Persian and Sorani; German and English change the noun.
- No literal digits anywhere (`Level 12` is `Level {level, number}`).
- Persian and Sorani use Persian punctuation `،` `؛` `؟`, Persian ی (U+06CC) and ک (U+06A9), never Arabic ي (U+064A) or ك (U+0643).
- One whole sentence per key: no leading or trailing spaces or joiners (`, ; : + & / – -`), no double spaces, English starts with a capital. Never glue two keys together.
- The S15 debug menu is English in all four languages on purpose (test builds only), so the Persian letter and punctuation rules skip `debug.*` keys.

## The catalog rules

`scripts/check-catalogs.mjs` and the project linter (`npm run i18n:verify`, templates in `templates/tooling-i18n/`) print the same messages.

| Id | Rule | Applies to | Message |
|---|---|---|---|
| L1 | Key shape: 2-5 lowercase kebab segments | all | `key must be 2-5 dot-separated kebab-case segments` |
| L1b | Game keys start with `<game-id>.`; Shell keys never start with a game id | all | `game keys start with "line-siege."` |
| L2 | Parses as ICU with an `other` clause required | all | `ICU syntax error: …` |
| L3 | No `{x, date}`, `{x, time}` or rich-text tags | all | `no {x, date}/{x, time}: use formatDayMonth` |
| L4 | camelCase placeholders; plain `{x}` only for `*Name`/`*Text`; those names never used for numbers, plurals or selects | all | `{level} is plain text: name it *Name/*Text, or use {level, number} / plural` |
| L5 | Plural: only `one`, `other`, `=N`; `one` present; no `offset`, no `selectordinal` | all | `plural category "few" does not exist in en/de/fa/ckb` |
| L6 | A `{x, number}` directly followed by a word must be a plural | en | `{moves, number} is followed by a word: use {moves, plural, …}` |
| L7 | No literal digits in any script | all | `literal digits: numbers must be placeholders` |
| L8 | No bidi controls or ALM | all | `bidi controls/ALM in catalog: t() isolates values` |
| L9 | No Arabic ي/ك | fa, ckb (not `debug.*`) | `Arabic ي/ك: use Persian ی/ک` |
| L10 | No Latin `,` `;` `?` | fa, ckb (not `debug.*`) | `Latin , ; ? in fa/ckb: use ، ؛ ؟` |
| L11 | Whole sentence: not empty, no edge space/joiner, no double space, English not lowercase, not a bare placeholder | all | `starts/ends with space or joiner: fragment of a glued sentence?` |
| L12 | Keys sorted alphabetically | all | `keys are not sorted alphabetically` |
| P1 | Every en key exists in de, fa, ckb | de, fa, ckb | `<key>: missing in fa (present in en)` |
| P2 | No key that en lacks | de, fa, ckb | `<key>: not in en.json` |
| P3 | Same placeholders with the same types as en | de, fa, ckb | `placeholders differ from en: …` |
| P4 | Same `=N` branches as en | de, fa, ckb | `plural {n} has exact branches […] but en has […]` |
| F1 | Four files, each a flat object of strings | all | `ckb.json is missing` |
| G1 | A game catalog holds `<game-id>.name`, `<game-id>.win-title` and `<game-id>.tagline`, the three keys the Shell reads through `GameIdentity.nameId`, `winTitleId` and `taglineId` (S1, S4, S7, S10, S11b) | game catalogs | `missing required game key "line-siege.win-title" (the Shell reads it through the identity)` |

## What FormatJS verify does and does not catch

`formatjs verify --source-locale en --missing-keys --extra-keys --structural-equality` (`@formatjs/cli` 6.16.32, verified) fails on a missing or extra key, a different set of variables, and a variable whose type differs (`Variable level has conflicting types: number vs argument`). It does **not** require the same plural categories in every language (a fa message with only `other` passed), which is why L5 and P4 exist. The FormatJS ESLint content rules (`enforce-placeholders`, `enforce-plural-rules`, …) are not used: they skip id-only calls, so with JSON-first catalogs they check nothing.
