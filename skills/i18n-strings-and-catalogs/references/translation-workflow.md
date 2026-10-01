# Translation workflow and the copy deck

How new text is written in four languages, where the approved texts come from (the copy deck), and how the owner's review of the Persian and Sorani texts works (it never blocks).

## Contents

- The copy deck is the source of screen text
- Strings the design deck lacks
- Using copy-deck.mjs
- Writing a new message
- Glossary
- Tone per language
- The owner's review of fa and ckb (never blocking)
- Questions for the reviewer (draft 1)

## The copy deck is the source of screen text

`assets/copy-deck.json` holds every visible text of the Shell screens S1-S4 and S6-S15 and of the first three games, in en, de, fa and ckb. The Toybox design mockup renders exactly these texts, so a screen matches its design screenshot only if its catalog texts equal the deck's. It is draft 1 (2026-09-27): **fa and ckb wait for the owner's own review** (owner decision O6: listed in every report under "Owner steps (not blocking)", never waited for).

One deck change since then: on 2026-09-30 the lead reworded Line Siege's how-to-play step 4 and tutorial step 4 (decision L4), because the tuned game marches every few placements, not after every block. They now read "The monsters march closer every few blocks." and "Careful: the monsters march closer every few blocks." (de "Alle paar Blöcke rücken die Monster näher." and "Achtung: Alle paar Blöcke rücken die Monster näher."; the fa and ckb drafts are on the review list below). `copy-deck.mjs apply . --game line-siege --overwrite` brings an older game catalog up to date.

A second deck change on 2026-09-30 (owner decision O1, the tracking prompt): the new Shell key `consent.tracking.usage-description`, the explanation under Apple's "Allow … to track your activity?" dialog. It is a system dialog text (plain, no placeholders; catalogs reference, "System dialog texts"). `copy-deck.mjs apply . --all` (or `--key consent.tracking.usage-description`) adds it to the four Shell catalogs:

| Language | Text |
|---|---|
| en | Google uses this to show you ads that fit your interests. You see ads either way, and the game itself collects no data. |
| de | Google nutzt das, um dir Werbung zu zeigen, die zu deinen Interessen passt. Werbung siehst du so oder so, und das Spiel selbst sammelt keine Daten. |
| fa (owner's review) | گوگل از این برای نمایش تبلیغ‌هایی متناسب با علاقه‌های شما استفاده می‌کند. در هر صورت تبلیغ می‌بینید و خود بازی هیچ داده‌ای جمع نمی‌کند. |
| ckb (owner's review) | گووگڵ ئەمە بەکاردەهێنێت بۆ پیشاندانی ڕیکلامی گونجاو لەگەڵ حەزەکانت. بە هەر حاڵ ڕیکلام دەبینیت، و یارییەکە خۆی هیچ زانیارییەک کۆ ناکاتەوە. |

| Section | Contents |
|---|---|
| `meta` | languages, direction, autonyms (`languageNames`), `numberLocales` (digit tags), the ICU subset, a `glossary`, `samples` and `sampleOverrides` (a value for every placeholder, used by the mockup and useful in tests), `renderNotes`, and `screens` (which keys each screen uses) |
| `games` | `lineSiege`, `flockTilt`, `scrapShove`: name (always Latin), tagline, goal, progress line, win title, lose reason, 3 stats labels, 4 how-to-play steps, 4 tutorial one-liners, 3 pack names |
| `licenceEntries` | example rows for S11d (component and licence names are not translated) |
| `strings` | 289 flat keys, sorted, each with `en`, `de`, `fa` and `ckb`; all pass the catalog rules |

Rules that follow from it:

- **Never retype a deck text.** Copy it with `copy-deck.mjs apply`; retyping loses typographic apostrophes (’), en dashes (–), ZWNJ in Persian and the Sorani letters.
- **A wording change goes into the deck first** (the design mockup reads the same file), then into the catalogs with `apply --overwrite`. A catalog that differs from the deck is `deck-drift`, and the screen no longer matches its design screenshot.
- Where the deck has no text (a new game, a new dialog), write it with the workflow below and ask the owner to add it to the deck at the next design pass.
- `meta.renderNotes` says how the mockup renders: numbers with `numberLocales`, free text isolated, autonyms from `meta.languageNames` in Vazirmatn, pack names and game texts from `games.<id>`, the week strip and bar chart right-to-left in fa/ckb, game names Latin in every language, the debug menu English in all four languages.

Game texts map to game catalog keys (`copy-deck.mjs --help` prints the same table):

| Deck field | Catalog key (`line-siege`) |
|---|---|
| `name`, `tagline`, `goal`, `progress` | `line-siege.name`, `.tagline`, `.goal`, `.progress` |
| `winTitle`, `loseReason` | `line-siege.win-title`, `line-siege.lose.<slug>` (below) |
| `stats.monstersDefeated` | `line-siege.stats.monsters-defeated` |
| `howToPlay[0]` … `[3]` | `line-siege.how-to-play.step-1` … `step-4` |
| `tutorial[0]` … `[3]` | `line-siege.tutorial.step-1` … `step-4` |
| `packs[0]` … `[2]` | `line-siege.pack-name.1` … `.3` |

The deck has one `loseReason` per game, but every way of losing gets its own key, `<game-id>.lose.<reason>`, where the reason is kebab words for what happened. The deck text maps to the game's first reason by this slug table (built into `copy-deck.mjs`):

| Game | Deck `loseReason` becomes | en |
|---|---|---|
| `line-siege` | `line-siege.lose.broke-through` | The monsters broke through |
| `flock-tilt` | `flock-tilt.lose.wolf-got-sheep` | The wolf got a sheep |
| `scrap-shove` | `scrap-shove.lose.caught` | A robot caught you |

`<id>.lose-reason` and `<id>.result.*` are retired key shapes: never write them. A game that is not in the deck starts with `<id>.lose.out-of-moves` (the scaffold's default `--lose-reason` slug) and renames it for its own reason. The Shell's own fallback for a missing reason stays `result.lose.reason.no-moves`.

## Strings the design deck lacks

A text a game needs that the deck does not have (a second way of losing, an endless HUD line, a continue offer, a board summary for VoiceOver) is written into the game's four catalogs by hand, with the workflow in "Writing a new message" below: the canonical English lives in the skill that owns the game's rules, de follows it, and fa and ckb go on the owner's review list. The copy deck itself is a byte copy of the design deck and is never edited here; ask the owner to add the text at the next design pass. Line Siege's extras (in its example catalogs, all four languages):

| Key | en | de | fa | ckb |
|---|---|---|---|---|
| `line-siege.lose.board-full` | No room left for the blocks | Kein Platz mehr für die Blöcke | دیگر جایی برای بلوک‌ها نمانده | ئیتر شوێن بۆ بلۆکەکان نەماوە |
| `line-siege.progress.endless` | Monsters {defeated, number} | Monster {defeated, number} | هیولا {defeated, number} | دێو {defeated, number} |
| `line-siege.continue.push-back` | One more go: the monsters fall back and the board clears a little | Noch ein Versuch: Die Monster weichen zurück und das Feld wird etwas freier | یک فرصت دیگر: هیولاها عقب می‌روند و صفحه کمی خالی‌تر می‌شود | هەلێکی تر: دێوەکان دەگەڕێنەوە دواوە و تەختەکە کەمێک چۆڵتر دەبێت |
| `line-siege.board.summary` | {monstersCount, plural, one {# monster} other {# monsters}} in the lanes, {heartsCount, plural, one {# heart} other {# hearts}} left | {monstersCount, plural, one {# Monster} other {# Monster}} auf den Bahnen, {heartsCount, plural, one {# Herz} other {# Herzen}} übrig | {monstersCount, plural, one {# هیولا} other {# هیولا}} در مسیرها، {heartsCount, plural, one {# قلب} other {# قلب}} باقی مانده | {monstersCount, plural, one {# دێو} other {# دێو}} لە ڕێڕەوەکاندا، {heartsCount, plural, one {# دڵ} other {# دڵ}} ماوە |

The fa and ckb texts of these four keys are drafts for the owner's own review (the review sheet lists them).

The Shell has ten texts the deck lacks as well. Their canonical table is `assets/shell-extras.json`, shown below; their fa and ckb drafts are on the owner's review list, except the debug menu's, which are English in all four languages on purpose, like every S15 text in the deck (test builds only). `node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs apply . --extras` writes them into the four Shell catalogs (`packages/shell/src/i18n/catalogs/<lang>.json`, keys sorted) so nobody retypes them, `keys --extras --lang all` prints them, and `check` compares every one a catalog has with the table (`extra-drift`; with `--extras` all ten are required, `extra-key-missing`). The screens skill's tables show the same texts letter for letter. The design copy deck is not edited for them:

| Key | Owner | en | de | fa (review) | ckb (review) |
|---|---|---|---|---|---|
| `debug.perf.benchmark` | toybox-screens (S15 debug menu, test builds: Performance, the row `debug.perf-benchmark-row` that runs the save benchmark) | Run save benchmark | Run save benchmark | Run save benchmark | Run save benchmark |
| `debug.perf.heading` | toybox-screens (S15: the Performance section heading) | Performance | Performance | Performance | Performance |
| `debug.perf.record` | toybox-screens (S15: Performance, the switch `debug.perf-record-switch` that records frame times) | Record frame times | Record frame times | Record frame times | Record frame times |
| `debug.perf.share` | toybox-screens (S15: Performance, the row `debug.perf-share-row` that opens the share sheet with the perf log) | Share performance report | Share performance report | Share performance report | Share performance report |
| `debug.perf.summary` | toybox-screens (S15: Performance, the summary row's label: how many entries the perf log holds, `entriesCount` is `PerfLog.entries().length`; the row's value is the debug kit's untranslated number line `perfSummaryText`, "cold 2 · 1049 ms · save p95 0.41 ms") | Performance log: {entriesCount, plural, =0 {empty} one {# entry} other {# entries}} (the `=0` branch in all four, because Persian puts 0 in `one`) | same as en | same as en | same as en |
| `game-screen.board.selected.a11y-announcement` | game-host-integration (tap-then-tap: a piece was picked) | Picked. Now tap where it goes. | Ausgewählt. Tippe jetzt, wohin es soll. | انتخاب شد. حالا روی جای آن ضربه بزنید. | هەڵبژێردرا. ئێستا دەست لە شوێنەکەی بدە. |
| `game-screen.board.unselected.a11y-announcement` | game-host-integration (the pick was cleared) | Selection cleared. | Auswahl aufgehoben. | انتخاب لغو شد. | هەڵبژاردن هەڵوەشایەوە. |
| `game-screen.hint-button.a11y-label` | toybox-screens (S5 top bar: the Hint key's VoiceOver label) | Hint | Tipp | راهنمایی | ئاماژە |
| `game-screen.undo-button.a11y-label` | toybox-screens (S5 top bar: the Undo key's VoiceOver label) | Undo | Rückgängig | واگرد | گەڕانەوە |
| `result.win.score-line` | toybox-screens (S7 win line of a score-rated level: the score and the level's best after this run) | Score {score, number} – best {bestScore, number} | Punkte {score, number} – Rekord {bestScore, number} | امتیاز {score, number} – رکورد {bestScore, number} | خاڵ {score, number} – باشترین {bestScore, number} |

`result.win.moves-count` is retired (the lead's decision L3, 2026-09-30): a score-rated win (a level rated by score, such as Line Siege's, where `resultModelOf` passes `par: null`) prints `result.win.score-line` with the run's score and the level's best score after this run, and a moves-rated win keeps the deck's `result.win.moves` ("7 moves – par 7"). `copy-deck.mjs check` fails `retired-key` while any Shell catalog still has `result.win.moves-count`: delete it from all four catalogs and from the code that shows it.

## Using copy-deck.mjs

```sh
node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs keys --screen S4 --lang all      # what S4 shows, 4 languages
node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs keys --prefix settings.numbers.   # look up by key prefix
node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs apply . --all                   # every Shell text
node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs apply . --game line-siege         # one game's texts
node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs apply . --extras                  # the Shell texts the deck lacks
node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs check . --screen S4 --game line-siege
```

- `keys` accepts `--screen` (S1 … S15, S11a … S11d, `shared`), `--prefix`, `--key`, `--all`, `--extras` (the Shell texts the deck lacks), `--game`; it notes the parts of a screen that are not catalog text (autonyms, licence rows) and tells you to add `--game` when a screen shows game texts.
- `apply` never silently replaces a different catalog text: it reports `deck-conflict` and keeps the catalog text unless you pass `--overwrite`.
- `check` fails on `deck-drift` (a catalog text differs from the deck), `deck-key-missing` (a selected screen or game key is absent), `extra-drift` and `extra-key-missing` (the same for the Shell texts the deck lacks), `retired-key` (a retired Shell key such as `result.win.moves-count` is still in a catalog), `system-text-plain` (a system dialog text, `*.usage-description`, holds an ICU argument or brace) and `system-text-missing` (from Shell step 8, a deck system text is not in all four catalogs).

## Writing a new message

1. **Look for an existing key first** (`copy-deck.mjs keys --prefix <area>.`, then the catalogs). Reuse `common.*` texts.
2. **Name the key** by place and role (`<area>.<element>[.<variant>]`), 2-5 kebab segments; game keys start with the game id.
3. **Write English first** as one whole sentence with named placeholders: numbers typed, counted nouns plural with `one` and `other`, free text ending in `Name`/`Text`.
4. **Write German** (informal "du"), **Persian** and **Sorani** with the same placeholders. Keep `one` and `other` in fa/ckb with the same singular noun. Copy any `=0` branch into all four.
5. **Add the key to all four files**, keep them sorted, and use it in code as a literal (`t('area.element')`, `<T id="area.element" />`) or through a typed table.
6. **Run** `check-catalogs.mjs` and `check-i18n-code.mjs` until both print `RESULT: PASS`, then the Jest tests.
7. **Note it for the owner's review**: every new fa/ckb text goes on the review sheet and into the report's "Owner steps (not blocking)" list; nothing waits for it.

## Glossary

Reuse these terms (from the deck's `meta.glossary`); add a term before using it in a second message.

| Term | en | de | fa | ckb |
|---|---|---|---|---|
| level | Level | Level | مرحله | ئاست |
| star | Star | Stern | ستاره | ئەستێرە |
| pack | Pack | Paket | بسته | بەش |
| daily challenge | Daily challenge | Tages-Challenge | چالش روزانه | ئاڵنگاریی ڕۆژانە |
| streak | Streak | Serie | زنجیره | زنجیرە |
| premium | Premium | Premium | پریمیوم | پریمیەم |
| hint | Hint | Tipp | راهنمایی | ئاماژە |
| continue | Continue | Weiter | ادامه | بەردەوامبوون |
| move | Move | Zug | حرکت | جووڵە |
| par | Par | Par | هدف | ئامانج |
| score | Score | Punkte | امتیاز | خاڵ |
| ad | Ad | Anzeige | تبلیغ | ڕیکلام |

## Tone per language

- **English:** short, friendly, sentence case, British spelling ("colour", "licences"). The separator is a spaced en dash ("Continue – Level 12"). Apostrophes are typographic (’) because an ASCII `'` is ICU's escape character.
- **German:** informal "du". Common gaming anglicisms stay: "Level", "Levels", "Premium", "Tages-Challenge". "Anzeige" labels the banner.
- **Persian:** friendly but neutral, polite plural imperative ("انتخاب کنید", "بازی کنید"). ZWNJ is used throughout (می‌شود، ستاره‌ها). Ezafe is written ـهٔ (مرحلهٔ). Persian punctuation (، ؟). Gregorian month names (سپتامبر).
- **Sorani:** plain everyday words, singular informal imperative ("هەڵبژێرە", "یاری بکە"). Uses the Sorani letters ێ ۆ ە ڕ ڵ, ە for the vowel e and ه (U+0647) for h; no ZWNJ; Persian-style punctuation. No Persian function words (است، را، از، که، این).
- **Debug menu (S15):** English in all four languages on purpose.

Machine-written Sorani is the highest risk: prefer short, plain sentences. CLDR data (months, weekdays) is copied, never translated by hand.

## The owner's review of fa and ckb (never blocking)

Owner decision O6 (2026-09-30): the owner reads the Persian and Sorani texts personally. Claude writes all four languages, prepares the sheets and applies the answers; no build, gate or release waits for the review, and there is no waiver to record.

1. `node packages/tooling/src/i18n/review-sheet.ts` (template `templates/tooling-i18n/review-sheet.ts` with its test) writes `reports/i18n/review-fa.csv` and `reports/i18n/review-ckb.csv`: one row per text that differs from its reviewed hash, with the key, the English text, the current text and where it shows (the screen, the game's texts, or "iOS system dialog" for `*.usage-description`). The debug menu's English texts are left out. It prints `review-sheet: <lang>: <n> of <total> texts wait for the owner's review` per language and, when anything waits, one `OWNER STEP (not blocking): …` line. It always exits 0 (2 only for a bad argument or missing catalogs); the release preflight runs it with `--release`, which behaves the same.
2. Every slice and release report copies that line under "Owner steps (not blocking)", with the reviewer questions below for the new texts. Then the work carries on.
3. When the owner sends corrections, apply them **to the copy deck (or `assets/shell-extras.json`) and the catalogs together**, rerun every check, then record the review: `node packages/tooling/src/i18n/review-sheet.ts --mark-reviewed fa --date YYYY-MM-DD` (and `ckb`; add `--key <key>` for only the texts the owner read).
4. `packages/shell/src/i18n/review-state.json` holds, per language and key, the SHA-256 of the text the owner read and the date (`{ "fa": { "<key>": { "sha256": "…", "reviewedOn": "2026-10-02" } }, "ckb": { … } }`). A later change of that text puts it back on the sheet.

## Questions for the reviewer (draft 1)

Ordered by visibility. Keep this list with the review sheet.

**Persian (fa)**

| Key(s) | Current text | Question |
|---|---|---|
| `common.premium`, all Premium strings | پریمیوم | Keep the loanword, or "نسخهٔ ویژه"? |
| `result.win.moves`, `game-screen.progress.moves-par` | ۷ حرکت – هدف ۷ | "Par" is "هدف" ("پار" reads as "last year"). Clear? |
| `daily.streak.*`, `stats.best.win-streak` | زنجیرهٔ فعلی، ۵ روز پیاپی | Is "زنجیره" natural for a streak? |
| Tone, all fa | …کنید | Polite plural right for a casual game, or the singular? |
| `settings.numbers.local` | محلی | Would "فارسی" be clearer for ۰-۹? |
| `date.weekday-strip.*` | د س چ پ ج ش ی | Are single letters clear in the 7-day strip? |
| `pause.title`, `result.endless.title`, `result.lose.title`, `premium.error` | as in the deck | Natural? |
| `line-siege.how-to-play.step-4`, `line-siege.tutorial.step-4` (reworded 2026-09-30) | هیولاها هر چند بلوک یک‌بار نزدیک‌تر می‌آیند. | Natural for "the monsters march closer every few blocks"? |
| `result.win.score-line` (new) | امتیاز ۱٬۸۴۰ – رکورد ۲٬۰۱۰ | Natural win line for a score and the best score? |
| `game-screen.undo-button.a11y-label`, `game-screen.hint-button.a11y-label` (new) | واگرد، راهنمایی | Right VoiceOver labels for Undo and Hint? |
| `consent.tracking.usage-description` (new, 2026-09-30; shown by iOS under "Allow … to track your activity?") | گوگل از این برای نمایش تبلیغ‌هایی متناسب با علاقه‌های شما استفاده می‌کند. در هر صورت تبلیغ می‌بینید و خود بازی هیچ داده‌ای جمع نمی‌کند. | Clear and natural as the reason under Apple's tracking question? Is "داده" the right word for data? |

**Sorani (ckb)**

| Key(s) | Current text | Question |
|---|---|---|
| `common.premium`, all Premium strings | پریمیەم | Spelling of the loanword. |
| privacy texts (`settings.privacy-policy.label`, `consent.intro.*`, …) | تایبەتێتی | The usual word for privacy, or "تایبەتمەندی"? |
| Line Siege, Flock Tilt, Scrap Shove texts | دێو، گەوڕ، ئاسنی کۆن … | Monster, pen, scrap, tilt, swipe and crash wording. |
| `settings.hints.label`, `premium.benefit.free-perks` | ئاماژە | Right word for a game hint? |
| `premium.small-print` | بێ ئابوونە | "ئابوونە" for subscription, or "بەشداریکردن"? |
| Tone, all ckb | singular (تۆ) | OK, or the plural (ئێوە)? |
| `tutorial.tap-to-continue`, tap lines | دەست لێ بدە | Or "کرتە بکە"? |
| Letter h; `date.weekday.5`, `date.weekday-strip.5` | ه (U+0647); CLDR uses ھ (U+06BE) | Which should the app use? |
| `date.month-short.12` | کانوونی یەکەم | CLDR writes کانونی یەکەم. |
| `line-siege.how-to-play.step-4`, `line-siege.tutorial.step-4` (reworded 2026-09-30) | دێوەکان هەر چەند بلۆکێک جارێک نزیکتر دەبنەوە. | Natural for "the monsters march closer every few blocks"? |
| `result.win.score-line` (new) | خاڵ ۱٬۸۴۰ – باشترین ۲٬۰۱۰ | Natural win line for a score and the best score? |
| `game-screen.undo-button.a11y-label`, `game-screen.hint-button.a11y-label` (new) | گەڕانەوە، ئاماژە | Right VoiceOver labels for Undo and Hint? |
| `consent.tracking.usage-description` (new, 2026-09-30; shown by iOS under "Allow … to track your activity?") | گووگڵ ئەمە بەکاردەهێنێت بۆ پیشاندانی ڕیکلامی گونجاو لەگەڵ حەزەکانت. بە هەر حاڵ ڕیکلام دەبینیت، و یارییەکە خۆی هیچ زانیارییەک کۆ ناکاتەوە. | Natural as the reason under Apple's tracking question? Is "زانیاری" right for data here, and is the comma before و needed? |
