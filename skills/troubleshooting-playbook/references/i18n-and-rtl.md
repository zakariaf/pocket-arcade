# Languages, RTL and fonts

Failures with Intl on Hermes, message catalogs, right-to-left layout, digits and fonts. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Intl
- Catalogs
- RTL layout
- Direction
- Bundling
- Fonts
- Locale
- Settings

## Intl

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `i18n-hermes-intl` | Plural forms wrong, Intl.PluralRules or Intl.Locale undefined, -u-nu- digits ignored, fa dates in the Solar Hijri calendar | Native Hermes implements only Collator, DateTimeFormat and NumberFormat, drops the numbering system, and uses a Persian calendar for fa | Always force the FormatJS polyfills (getcanonicallocales, locale, pluralrules, numberformat with en/de/fa/ckb data) first in the entry and in Jest; never call Intl.DateTimeFormat or toLocale* in app code | verified | `i18n-strings-and-catalogs` |

## Catalogs

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `i18n-formatjs-lint-blind` | eslint-plugin-formatjs never reports ICU problems in our catalogs | Its content rules skip calls without defaultMessage; messages live only in JSON behind t() | Register t/T through settings.formatjs, and run the project catalog linter (verify-catalogs.ts) plus formatjs verify --structural-equality | verified | `i18n-strings-and-catalogs` |
| `i18n-enforce-id-pattern` | formatjs/enforce-id demands hash IDs | idInterpolationPattern requires defaultMessage and hashed ids, which conflicts with semantic keys | Use enforce-id without the pattern, or drop it | verified | `i18n-strings-and-catalogs` |
| `i18n-missing-key-throws` | A component test throws on a missing message | In tests the i18n onError throws, so a missing key fails the test run | Add the key to every catalog (en, de, fa, ckb) and rerun i18n:verify | verified | `i18n-strings-and-catalogs` |
| `i18n-sorani-december` | Two spellings of Sorani December | CLDR 48 is inconsistent | The catalog uses the second form pending native review (owner step G7) | open, owner | `i18n-strings-and-catalogs` |
| `i18n-unreviewed-texts` | release:ios refuses a store build: fa/ckb messages differ from their reviewed hash | Changed Persian or Sorani texts have not been reviewed by a native speaker | Owner step: review (review-sheet.ts) or record a waiver ("reviewer": "waived-by-owner") with a Gate-Change trailer | documented, owner | `i18n-strings-and-catalogs` |
| `i18n-game-message-cast` | tsc rejects t(message) for a game's plain MessageId, and check-i18n-code fails asGameKey(...) outside game-message-text.ts (game-key-cast) | t() only accepts branded Shell keys; the game contract passes plain string ids, and only packages/shell/src/i18n/game-message-text.ts may turn one into a key | Show the text with gameMessageText(t, message) from packages/shell/src/i18n/game-message-text.ts; keep a game's id tables (apps/<id>/src/i18n/keys.ts) as plain 'as const' literals, never asGameKey | verified | `i18n-strings-and-catalogs` |
| `i18n-unknown-game-key` | A game message id such as line-siege.lose.board-full has no translation | The id literal in apps/<id>/src is missing from that game's en.json | Add the key to the game's four catalogs (a string the copy deck lacks gets its English text from the owning skill, with fa and ckb marked for native review); check-i18n-code reports every unknown <game-id>.* literal. Lose reasons use one key each: <game-id>.lose.<reason> | verified | `i18n-strings-and-catalogs` |
| `i18n-keys-ts-unused` | knip reports a game's keys.ts or its exports as unused | keys.ts is an optional table of the game's plain literal ids; knip flags it as soon as no game file imports it | keys.ts is optional: keep only the tables the game imports, or delete it when nothing imports it | verified | `i18n-strings-and-catalogs` |

## RTL layout

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `i18n-textalign-rtl` | Latin or Persian text stays left-aligned in RTL | textAlign 'auto' stays physical left on iOS unless the app language itself is RTL; 'left' is swapped to start | AppText sets writingDirection and textAlign 'left' (start); 'right' means end | verified | `rtl-and-direction` |

## Direction

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `i18n-force-rtl-reload` | forceRTL(true) has no visible effect | I18nManager changes apply on the next JS load | allowRTL(desired) + forceRTL(desired), save first (the reload discards in-memory state), then reloadAppAsync() from the 'expo' package (never expo-updates, which is banned) | verified | `rtl-and-direction` |
| `i18n-double-write-before-reload` | The save is written twice on a direction switch | Module-level code runs once before the reload | Run the direction check first in the entry, before the database writes | verified | `rtl-and-direction` |
| `i18n-isrtl-desired` | Direction flips back or disagrees with the saved language | I18nManager.isRTL is a constant captured at JS load and persists natively (drifts after a device restore) | Compute desired direction from the saved language; correct drift at startup; derive navigator direction from I18nManager | verified | `rtl-and-direction` |
| `i18n-localization-rtl-flags` | expo-localization forces RTL from the device language | Its supportsRTL / forcesRTL plugin options set RCTI18nUtil at every module creation | Configure only supportedLocales (en, de, fa, ckb); leave supportsRTL and forcesRTL unset | verified | `rtl-and-direction` |
| `i18n-system-sheet-language` | The consent form or purchase sheet shows English in a Persian game | Google UMP and StoreKit sheets follow the device or per-app iOS language, not the in-app choice | Nothing to fix in v1; tell the owner | open | `i18n-strings-and-catalogs` |
| `i18n-rtl-defaults-sdk58` | RTL behaviour changes after the SDK 58 upgrade | Expo's localization guide says RTL defaults change in SDK 58 | Re-run the RTL probe screen and screenshots after the upgrade | open | `expo-sdk-upgrade` |
| `i18n-direction-export` | TS2305: direction-context.tsx has no exported member 'DirectionProvider' (or 'DirectionContext') | An older direction-context.tsx; the documented API is DirectionProvider | Copy rtl-and-direction's current direction-context.tsx and import DirectionProvider | verified | `rtl-and-direction` |

## Bundling

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `i18n-dynamic-locale-import` | Metro fails on import(`./locale-data/${lang}`) | Metro cannot bundle template-string dynamic imports | Import the four locale files statically | verified | `i18n-strings-and-catalogs` |

## Fonts

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `i18n-bidi-marks` | Tofu boxes around interpolated names | A font lacks FSI U+2068 / PDI U+2069 | Vazirmatn renders them invisibly (verified); check each new font | verified | `rtl-and-direction` |
| `i18n-arabic-line-height` | Marks of Persian or Sorani text are clipped | Arabic-script text needs more line height | About 1.5x line height for fa/ckb; check in screenshots | verified | `toybox-design-system` |
| `i18n-vazirmatn-coverage` | A character renders as tofu in fa/ckb | Vazirmatn lacks U+061C ALM and U+1E9E; Lilita One lacks capital sharp s and tnum | Avoid those characters or pick the fallback font; Noto Sans Arabic is the verified backup | verified | `toybox-design-system` |
| `i18n-font-plugin-partial` | Every screen renders in the system font; Lilita One and Rubik never appear | The expo-font plugin entry embeds only the two Vazirmatn files | One expo-font entry that embeds every Toybox font file; check-design-system reports font-plugin | verified | `toybox-design-system` |

## Locale

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `i18n-sorani-locale-code` | Sorani not detected on a real device | iOS may report ckb or ku-Arab | resolveLanguage handles both (ku with Arab script -> ckb) | open | `i18n-strings-and-catalogs` |

## Settings

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `i18n-numbers-row-en-de` | The Numbers setting has no visible effect in English or German | All three options produce Latin digits for en/de | Kept as the spec asks, with live previews; the owner may hide it for en/de | open, owner | `settings-and-preferences` |
