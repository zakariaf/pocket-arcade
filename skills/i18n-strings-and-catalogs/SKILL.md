---
name: i18n-strings-and-catalogs
description: Writes and checks every Pocket Arcade UI text - react-intl catalogs, semantic keys, ICU plurals, t() and T, Intl polyfills, copy-deck strings, de/fa/ckb translations. Use when adding or changing visible text, a message key, a translation or copy. Not for RTL layout or digits (rtl-and-direction).
---

# UI text, catalogs and translations

Every word a player sees comes from a catalog key in English, German, Persian and Sorani, the Shell's texts are exactly the Toybox copy deck's (so screens match their design screenshots), and scripts prove the catalogs and the code follow the rules.

## Rules that must hold

1. **Render every visible string through `t()` or `<T>` from a catalog key.** No literals in JSX, in text or accessibility props, or in `Alert`. Why: the product ships in four languages from day one; a literal is English on every phone.
2. **Take Shell and game texts from the copy deck with `copy-deck.mjs`, never by retyping; the ten Shell texts the deck lacks come from `assets/shell-extras.json` the same way (`--extras`).** A wording change goes into the deck (or that table) first, then into the catalogs. Why: the design mockup renders the deck; a catalog that drifts from it no longer matches its design screenshot, and retyping loses ’, –, ZWNJ and Sorani letters.
3. **Keep four flat catalogs per folder, English as the source, keys sorted.** Shell: `packages/shell/src/i18n/catalogs/{en,de,fa,ckb}.json`; game: `apps/<game-id>/src/i18n/`, every key starting with the game id. Why: stable diffs, and no Shell/game key collision.
4. **Name keys `<area>.<element>[.<variant>]` (2-5 kebab segments) and write them as literals or in typed tables.** Game texts reach the Shell as the module's plain `MessageId`s and become text only through `gameMessageText(t, message)`. Why: only visible keys can be type-checked and linted; semantic keys survive rewording.
5. **Type every number in a message:** `{x, number}`, `{x, number, ::percent}` or a plural `#`. A plain `{x}` is only for free text named `*Name`/`*Text`. Why: a plain argument prints Latin digits in every language.
6. **Write counted nouns as `{n, plural, one {…} other {…}}` in all four languages, and any `=0` branch in all four.** Why: Persian puts 0 in `one`; code that branches on "is it 1?" is wrong in fa.
7. **Force the Intl polyfills (Locale, PluralRules, NumberFormat; en/de/fa/ckb data only) as the first import of `start-shell.ts` and in Jest `setupFiles`.** Why: Hermes has no `PluralRules` or `Locale` and ignores digit selection; forcing makes Jest identical to the phone.
8. **Format dates with `format-date.ts` (`formatDayMonth`, `formatWeekdayDayMonth`, `formatMonthShort`, `formatWeekdayName`, `formatWeekdayLetter`) and catalog month and weekday names; never `Intl.DateTimeFormat`, `toLocale*String` or `{x, date}`.** Why: Hermes formats fa dates in the Solar Hijri calendar and ignores the digit setting.
9. **Import `react-intl` only inside `packages/shell/src/i18n/`; configure `expo-localization` with `supportedLocales` only.** Why: one text API for the app; `supportsRTL`/`forcesRTL` would undo an in-app language choice.
10. **Keep `check-catalogs.mjs` (and `npm run i18n:verify`) green before every commit that touches a catalog.** Why: a missing or broken text must fail the build, not a player.
11. **Claude writes all four languages; the owner reviews fa and ckb personally, and nothing waits for it** (owner decision O6, 2026-09-30). Every slice and release report lists the fa/ckb texts still waiting under "Owner steps (not blocking)" (`review-sheet.ts` prints the count and writes the sheets); no gate, release or waiver depends on the review. Why: machine-written Sorani especially can sound unnatural, so the owner reads it, but the work never stops for it.
12. **A system dialog text is plain text** (a key ending in `.usage-description`, such as `consent.tracking.usage-description`, Apple's tracking prompt text from owner decision O1): no `{argument}`, plural or brace in any language, because `withShell` copies it from the Shell catalogs into each language's `Info.plist` strings, where nothing formats ICU. Why: iOS would show the braces to the player (`copy-deck.mjs check` rule `system-text-plain`).
13. **Debug-menu texts stay English in every language** (lead decision L13). Every `debug.*` key, in the copy deck and in `assets/shell-extras.json` (the Performance section `debug.perf.*` included), has its en text in de, fa and ckb; numbers and dates inside the debug values still follow the language, because the screen's model formats them with the language's formatters, never `String(n)`. `copy-deck.mjs check` and `check-catalogs.mjs` fail a translated debug text (rule `debug-english`, P5), and `review-sheet.ts` leaves debug keys out of the fa and ckb review. Why: S15 is a test-only screen, compiled out of store builds, that no player sees; its design draws English in all four languages, and it keeps design parity like every screen (L12).

## Workflow

1. **First time (the Shell has no i18n layer yet).** Read [references/runtime-and-provider.md](references/runtime-and-provider.md). The layer lands in two Shell build steps (that reference's tables), because a template and its test land together and a test that needs a later file waits for it:
   - **Shell step 6, the i18n step.** Install `react-intl` (Shell), `@formatjs/cli` (root dev) and `@formatjs/icu-messageformat-parser` (tooling dev) from the table; the polyfill packages, `intl-polyfills.ts`, `intl-status.ts` and the Jest `setupFiles` line came with the bootstrap. Copy from `templates/shell-i18n/` to `packages/shell/src/i18n/` only `languages.ts`, `resolve-language.ts`, `digits.ts`, `bidi.ts`, `messages.ts`, `create-t.ts`, `format-date.ts` and `game-message-text.ts` with their tests, and all of `templates/tooling-i18n/` to `packages/tooling/src/i18n/` (the linter and the owner's review sheet `review-sheet.ts`, with their tests). Add `"i18n:verify": "node packages/tooling/src/i18n/verify-catalogs.ts"` to the root `package.json`. Then create every Shell catalog from the deck:
     `node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs apply . --all --extras` (`--all` includes the system dialog text `consent.tracking.usage-description`; `--extras` adds the Shell texts the deck lacks: the score-rated win line `result.win.score-line`, the Undo and Hint labels, the tap-then-tap announcements and the debug menu's Performance section `debug.perf.*`, English in every language (rule 13); `result.win.moves-count` is retired). `check-i18n-code.mjs .` then prints two not-yet-due SKIP lines (`polyfill-first` and `i18n-runtime`, `due at Shell step 7: packages/shell/src/app/start-shell.ts not yet created`).
   - **Shell step 7, with the boot and `renderWithShell`.** Copy `t.tsx` with `t.test.tsx`, `i18n-provider.tsx`, `t-bridge.tsx`, `t-context.ts` and `language-context.tsx`, and `templates/root-test/start-shell-imports.test.ts` to `test/integration/i18n/`, in the same step as `start-shell.ts`; install `expo-localization` in the app (`npx expo install expo-localization`) with its first importer, the composition root's `device-adapters.ts`. From then on `check-i18n-code.mjs` prints no SKIP line and fails `i18n-runtime` on any of these files that is missing.
2. **Building or changing a screen.** See what the design shows: `node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs keys --screen S4 --lang all` (add `--game <game-id>` when the screen shows game texts). Make sure those keys are in the catalogs (`apply --screen S4`), and use them as literals: `<T id="home.play-button.continue" values={{ level }} />`, or `t('…')` in the screen's model hook for props and accessibility labels. Components receive translated strings; they never build them.
3. **A new game.** `node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs apply . --game <game-id>` writes its four catalogs (a game the deck does not know yet gets its texts through step 4). The deck's lose reason lands as `<game-id>.lose.<slug>` (line-siege `broke-through`, flock-tilt `wolf-got-sheep`, scrap-shove `caught`); every other way of losing and every text the deck lacks (Line Siege: `.lose.board-full`, `.progress.endless`, `.continue.push-back`, `.board.summary`) is added by hand in all four languages with the table in [references/translation-workflow.md](references/translation-workflow.md), fa and ckb on the review list. The game hands its texts to the Shell as literal `MessageId`s in its module (HUD goal, lose reason, packs, steps, stat labels); its contract test proves each one exists in all four catalogs, and the Shell shows every one of them, tables included, with `gameMessageText(t, message)` from `packages/shell/src/i18n/game-message-text.ts` (runtime reference, "Game keys"). `templates/game-i18n/keys.ts` (tables of plain literal ids) is optional: replace `__GAME_ID__` and `__LOSE_SLUG__`, keep only the tables the game uses. No file but `game-message-text.ts` calls `asGameKey`.
4. **Text the deck does not have.** Read [references/catalogs-keys-and-icu.md](references/catalogs-keys-and-icu.md) (keys, placeholders, plurals, the rules) and [references/translation-workflow.md](references/translation-workflow.md) (tone, glossary), and follow [examples/add-a-counted-message.md](examples/add-a-counted-message.md). Write English first, then de, fa, ckb; add the key to all four files, sorted; note the fa/ckb texts for review and ask the owner to add the text to the deck.
5. **Tests.** Keep the template tests (`create-t`, `format-date`, `game-message-text`, `resolve-language`, `intl-status`, `catalog-lint-rules`, `review-sheet` from step 6; `t` and `start-shell-imports` from step 7) green. A new message with a count or a placeholder gets a `t()` assertion in each language whose grammar differs.
6. **Run the checks** from the repo root, fix every `FAIL` line (each names the file, the rule and the fix), and rerun until all print `RESULT: PASS`:
   - `node ${CLAUDE_SKILL_DIR}/scripts/check-i18n-code.mjs .` (literals, keys, react-intl, dates, polyfill wiring)
   - `node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs check .` (add `--screen`/`--game` for what you built)
   - `node ${CLAUDE_SKILL_DIR}/scripts/check-catalogs.mjs .` (rules L1-L12, parity P1-P5, P5 being `debug-english`)
   Then `npx jest packages/shell/src/i18n packages/tooling/src/i18n --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/i18n/**/*.ts' --coverageThreshold='{}'` (paths first; only `npm run test:coverage` judges the thresholds) and `npm run i18n:verify` where the project has it.
7. **The owner's review (owner step, never blocking).** Run `node packages/tooling/src/i18n/review-sheet.ts` (the release preflight runs it with `--release`; it always exits 0): it writes `reports/i18n/review-fa.csv` and `review-ckb.csv` with every text that changed since the owner last read it (debug keys excluded, rule 13) and prints an `OWNER STEP (not blocking)` line with the count. Copy that line into the report under "Owner steps (not blocking)" with the new texts' reviewer questions (translation-workflow reference) and carry on. When the owner's answers come, apply them to the deck (or `assets/shell-extras.json`) and the catalogs together, rerun the checks, then record them: `node packages/tooling/src/i18n/review-sheet.ts --mark-reviewed fa --date YYYY-MM-DD` (and `ckb`).

## Definition of done

- [ ] No visible string, text prop, accessibility label or alert text is a literal; everything comes from `t()`/`<T>` with a literal or typed-table key.
- [ ] Every key used exists in en, de, fa and ckb; catalogs are flat, sorted, and game keys start with the game id.
- [ ] Every text the design shows equals the copy deck, and every Shell text the deck lacks equals `assets/shell-extras.json` with no retired key left: `node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs check . --screen <S…> [--game <id>]` prints `RESULT: PASS` for each screen built.
- [ ] Every `debug.*` text equals its en text in de, fa and ckb (rule `debug-english`); the fa/ckb review sheets list no debug key.
- [ ] Numbers are typed, counted nouns are plurals with `one` and `other` (and the same `=N` branches) in all four languages.
- [ ] The polyfills are the first import of `start-shell.ts` and in Jest `setupFiles`; dates use `formatDayMonth()`.
- [ ] The i18n Jest tests pass (with `review-sheet.test.ts`); new fa/ckb texts are listed in the report under "Owner steps (not blocking)" for the owner's own review, and nothing waits for it.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-i18n-code.mjs .` prints `RESULT: PASS`.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-catalogs.mjs .` prints `RESULT: PASS`.

## Anti-patterns

- **Hard-coding English "for now".** It ships. Add the key in four languages now; a missing translation fails the checks on purpose.
- **Retyping a deck text or "improving" it in the catalog.** The design screenshot then disagrees; change the deck first (with the owner) and re-apply.
- **Gluing sentences:** `t('a') + ' ' + count + ' ' + t('b')`. Word order differs per language and digits stay Latin. Write one message with placeholders.
- **`{count}` for a number, or `count === 1 ? 'move' : 'moves'` in code.** Use `{count, plural, one {# move} other {# moves}}`.
- **Building keys:** `` t(`date.month-short.${m}`) ``. Use a typed table of literal keys.
- **`t(asGameKey(message.id))` in a screen or the game host, or a game table built with `asGameKey('…')`.** Game ids become text only through `gameMessageText(t, message)` (`packages/shell/src/i18n/game-message-text.ts`); the game writes each id as a plain literal, and its contract test proves it exists (`check-i18n-code.mjs` rule `game-key-cast`).
- **`toLocaleDateString()` or `Intl.DateTimeFormat` for a date label.** Persian users get the Solar Hijri calendar; use `formatDayMonth()`.
- **Adding locale data "just in case" or a second i18n library.** Every locale file is startup weight; en, de, fa and ckb are the product.
- **Translating language names or game names.** Autonyms are code; game names stay Latin in every language.
- **Holding work back until the owner has read the fa/ckb texts, or silently skipping the list.** The review never blocks (O6), but it is never forgotten either: every report names the texts still waiting.
- **Translating a debug-menu text "for completeness".** S15 stays English in every language (L13); a translated `debug.*` text fails `debug-english` and would put a test-only screen on the owner's review list.
- **Copying `t.tsx`, the provider or the contexts at step 6.** Their tests need `renderWithShell` and the boot; landing early leaves untested functions under the coverage threshold. They come at step 7 with `start-shell.ts`.
- **An ICU argument in a system dialog text** (`"{gameName} uses this…"` in `consent.tracking.usage-description`). iOS shows the braces; iOS already names the app in the dialog title.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/catalogs-keys-and-icu.md](references/catalogs-keys-and-icu.md) | Catalog files, key grammar, placeholders, plurals and CLDR categories, bidi isolation, dates, every catalog rule with its message | Workflow step 4, and when a catalog check fails |
| [references/runtime-and-provider.md](references/runtime-and-provider.md) | Packages and versions, why the polyfills are forced, the i18n folder, language resolution, locale tags, `t()`/`T`/provider, game keys, Jest setup and tests | Workflow step 1, and when changing runtime i18n code |
| [references/translation-workflow.md](references/translation-workflow.md) | The copy deck and its game-key mapping, writing a new message, glossary, tone per language, the owner's fa/ckb review (never blocking), reviewer questions | Workflow steps 2-4 and 7 |
| [examples/add-a-counted-message.md](examples/add-a-counted-message.md) | A new plural message in four languages, from key to test to checks | Workflow step 4 |
| `templates/shell-i18n/` | The Shell i18n modules and their tests (polyfills and `intl-status` are synced from the library, do not edit them here; languages, `resolveLanguage`, digits tag, bidi, messages, `t()`, `T`, provider, `formatDayMonth`, `gameMessageText`) | Workflow step 1 (step 6, then `t.tsx`, the provider and the contexts at step 7); copy to `packages/shell/src/i18n/` |
| `templates/tooling-i18n/` | The project linter behind `npm run i18n:verify` (same rules and messages as the skill's checker) and its test, and the review sheet (next rows) | Workflow step 1; copy to `packages/tooling/src/i18n/` |
| `templates/tooling-i18n/review-sheet.ts` | The owner's fa/ckb review sheet: writes `reports/i18n/review-<lang>.csv` for every text (debug keys excluded) that differs from its reviewed hash in `packages/shell/src/i18n/review-state.json`, prints the count and the `OWNER STEP (not blocking)` line, always exits 0 (2 only for bad input); `--mark-reviewed <lang> --date` records the owner's review | Workflow steps 1 and 7; copy to `packages/tooling/src/i18n/` |
| `templates/tooling-i18n/review-sheet.test.ts` | Its test: pending rows, hashes, the CSV, marking, exit codes | Workflow step 1 |
| `templates/game-i18n/keys.ts` | Optional typed tables of a game's plain literal message ids (`__GAME_ID__`), shown by the Shell through `gameMessageText` | Workflow step 3, only when used |
| `templates/root-test/start-shell-imports.test.ts` | Guardrail test: the polyfills are the first import of `start-shell.ts` | Workflow step 1, at Shell step 7 with `start-shell.ts`; copy to `test/integration/i18n/` |
| `scripts/check-catalogs.mjs` | Checks every catalog: rules L1-L12, parity with en (P1-P5; P5 `debug-english`: a `debug.*` text in de, fa or ckb that differs from en), files (F1) | Workflow step 6, after every catalog change |
| `scripts/check-i18n-code.mjs` | Checks source for literal text, built or unknown keys, game ids cast outside `game-message-text.ts`, react-intl imports, date APIs, isolated text passed into `t()` again (`nested-isolates`), polyfill order and data, Jest setup, and the step-7 i18n files once `start-shell.ts` exists (`i18n-runtime`; a not-yet-due SKIP before step 7) | Workflow steps 1 and 6 |
| `scripts/copy-deck.mjs` | Looks up (`keys`), writes (`apply`) and verifies (`check`) deck texts and the Shell texts the deck lacks (`--extras`) in the catalogs; fails retired Shell keys, system dialog texts that are not plain or missing (`system-text-plain`, `system-text-missing`) and translated debug texts in the deck, the extras or the catalogs (`debug-english`) | Workflow steps 1-3 and 6 |
| `scripts/lib/icu-parse.mjs` | Dependency-free ICU MessageFormat parser (same shapes as FormatJS) | Read only when changing a checker |
| `scripts/lib/catalog-rules.mjs` | The rule implementations shared by the checkers | Read only when changing a rule |
| `scripts/lib/source-scan.mjs` | JSX, call and import scanning helpers for the code checker | Read only when changing a checker |
| `scripts/selftest.mjs` | Proves every checker passes its good fixture and catches each planted bug | After changing a script or fixture |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/copy-deck.json` | The copy deck: every Shell and game text in en, de, fa, ckb, per screen (synced; do not edit here) | Through `copy-deck.mjs`; read `meta` for samples and render notes |
| `assets/shell-extras.json` | The ten Shell texts the deck lacks (score line, Undo and Hint labels, tap-then-tap announcements, the debug menu's five Performance texts, English in all four) in four languages, and the retired Shell keys; read by `copy-deck.mjs --extras` | Workflow steps 1 and 4; change only with the owner |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad inputs for the self-test, one folder per checker | When adding a rule |

## Related skills

- `rtl-and-direction` - layout direction, mirroring, digits outside messages, bidi in layout, Vazirmatn.
- `accessibility` - roles, labels and hints (their text comes from here), text scaling.
- `toybox-screens` - which keys each screen uses and where they sit.
- `toybox-visual-parity` - proves the built screen matches its design screenshot.
- `naming-conventions` - naming beyond message keys.
