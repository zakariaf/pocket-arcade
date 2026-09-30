---
name: i18n-strings-and-catalogs
description: Writes and checks every Pocket Arcade UI text - react-intl catalogs, semantic keys, ICU plurals, t() and T, Intl polyfills, copy-deck strings, de/fa/ckb translations. Use when adding or changing visible text, a message key, a translation or copy. Not for RTL layout or digits (rtl-and-direction).
---

# UI text, catalogs and translations

Every word a player sees comes from a catalog key in English, German, Persian and Sorani, the Shell's texts are exactly the Toybox copy deck's (so screens match their design screenshots), and scripts prove the catalogs and the code follow the rules.

## Rules that must hold

1. **Render every visible string through `t()` or `<T>` from a catalog key.** No literals in JSX, in text or accessibility props, or in `Alert`. Why: the product ships in four languages from day one; a literal is English on every phone.
2. **Take Shell and game texts from the copy deck with `copy-deck.mjs`, never by retyping; the five Shell texts the deck lacks come from `assets/shell-extras.json` the same way (`--extras`).** A wording change goes into the deck (or that table) first, then into the catalogs. Why: the design mockup renders the deck; a catalog that drifts from it no longer matches its design screenshot, and retyping loses ’, –, ZWNJ and Sorani letters.
3. **Keep four flat catalogs per folder, English as the source, keys sorted.** Shell: `packages/shell/src/i18n/catalogs/{en,de,fa,ckb}.json`; game: `apps/<game-id>/src/i18n/`, every key starting with the game id. Why: stable diffs, and no Shell/game key collision.
4. **Name keys `<area>.<element>[.<variant>]` (2-5 kebab segments) and write them as literals or in typed tables.** Game texts reach the Shell as the module's plain `MessageId`s and become text only through `gameMessageText(t, message)`. Why: only visible keys can be type-checked and linted; semantic keys survive rewording.
5. **Type every number in a message:** `{x, number}`, `{x, number, ::percent}` or a plural `#`. A plain `{x}` is only for free text named `*Name`/`*Text`. Why: a plain argument prints Latin digits in every language.
6. **Write counted nouns as `{n, plural, one {…} other {…}}` in all four languages, and any `=0` branch in all four.** Why: Persian puts 0 in `one`; code that branches on "is it 1?" is wrong in fa.
7. **Force the Intl polyfills (Locale, PluralRules, NumberFormat; en/de/fa/ckb data only) as the first import of `start-shell.ts` and in Jest `setupFiles`.** Why: Hermes has no `PluralRules` or `Locale` and ignores digit selection; forcing makes Jest identical to the phone.
8. **Format dates with `format-date.ts` (`formatDayMonth`, `formatWeekdayDayMonth`, `formatMonthShort`, `formatWeekdayName`, `formatWeekdayLetter`) and catalog month and weekday names; never `Intl.DateTimeFormat`, `toLocale*String` or `{x, date}`.** Why: Hermes formats fa dates in the Solar Hijri calendar and ignores the digit setting.
9. **Import `react-intl` only inside `packages/shell/src/i18n/`; configure `expo-localization` with `supportedLocales` only.** Why: one text API for the app; `supportsRTL`/`forcesRTL` would undo an in-app language choice.
10. **Keep `check-catalogs.mjs` (and `npm run i18n:verify`) green before every commit that touches a catalog.** Why: a missing or broken text must fail the build, not a player.
11. **Claude writes all four languages; a native speaker reviews fa and ckb before each release.** Only the owner may waive that review. Why: machine-written Sorani especially can sound unnatural.

## Workflow

1. **First time (the Shell has no i18n layer yet).** Read [references/runtime-and-provider.md](references/runtime-and-provider.md). Install the exact packages from its table. Copy `templates/shell-i18n/` to `packages/shell/src/i18n/`, `templates/tooling-i18n/` to `packages/tooling/src/i18n/` and `templates/root-test/start-shell-imports.test.ts` to `test/integration/i18n/`. Add `"i18n:verify": "node packages/tooling/src/i18n/verify-catalogs.ts"` to the root `package.json`, and `<rootDir>/packages/shell/src/i18n/intl-polyfills.ts` to Jest `setupFiles`. Then create every Shell catalog from the deck:
   `node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs apply . --all --extras` (`--extras` adds the Shell texts the deck lacks: the score-rated win line `result.win.score-line`, the Undo and Hint labels and the tap-then-tap announcements; `result.win.moves-count` is retired)
2. **Building or changing a screen.** See what the design shows: `node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs keys --screen S4 --lang all` (add `--game <game-id>` when the screen shows game texts). Make sure those keys are in the catalogs (`apply --screen S4`), and use them as literals: `<T id="home.play-button.continue" values={{ level }} />`, or `t('…')` in the screen's model hook for props and accessibility labels. Components receive translated strings; they never build them.
3. **A new game.** `node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs apply . --game <game-id>` writes its four catalogs (a game the deck does not know yet gets its texts through step 4). The deck's lose reason lands as `<game-id>.lose.<slug>` (line-siege `broke-through`, flock-tilt `wolf-got-sheep`, scrap-shove `caught`); every other way of losing and every text the deck lacks (Line Siege: `.lose.board-full`, `.progress.endless`, `.continue.push-back`, `.board.summary`) is added by hand in all four languages with the table in [references/translation-workflow.md](references/translation-workflow.md), fa and ckb on the review list. The game hands its texts to the Shell as literal `MessageId`s in its module (HUD goal, lose reason, packs, steps, stat labels); its contract test proves each one exists in all four catalogs, and the Shell shows every one of them, tables included, with `gameMessageText(t, message)` from `packages/shell/src/i18n/game-message-text.ts` (runtime reference, "Game keys"). `templates/game-i18n/keys.ts` (tables of plain literal ids) is optional: replace `__GAME_ID__` and `__LOSE_SLUG__`, keep only the tables the game uses. No file but `game-message-text.ts` calls `asGameKey`.
4. **Text the deck does not have.** Read [references/catalogs-keys-and-icu.md](references/catalogs-keys-and-icu.md) (keys, placeholders, plurals, the rules) and [references/translation-workflow.md](references/translation-workflow.md) (tone, glossary), and follow [examples/add-a-counted-message.md](examples/add-a-counted-message.md). Write English first, then de, fa, ckb; add the key to all four files, sorted; note the fa/ckb texts for review and ask the owner to add the text to the deck.
5. **Tests.** Keep the template tests (`create-t`, `format-date`, `game-message-text`, `resolve-language`, `intl-status`, `t`, `catalog-lint-rules`, `start-shell-imports`) green. A new message with a count or a placeholder gets a `t()` assertion in each language whose grammar differs.
6. **Run the checks** from the repo root, fix every `FAIL` line (each names the file, the rule and the fix), and rerun until all print `RESULT: PASS`:
   - `node ${CLAUDE_SKILL_DIR}/scripts/check-i18n-code.mjs .` (literals, keys, react-intl, dates, polyfill wiring)
   - `node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs check .` (add `--screen`/`--game` for what you built)
   - `node ${CLAUDE_SKILL_DIR}/scripts/check-catalogs.mjs .` (rules L1-L12, parity P1-P4)
   Then `npx jest packages/shell/src/i18n packages/tooling/src/i18n --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/i18n/**/*.ts' --coverageThreshold='{}'` (paths first; only `npm run test:coverage` judges the thresholds) and `npm run i18n:verify` where the project has it.
7. **Before a release (human step).** Prepare the fa/ckb review list (translation-workflow reference), tell the owner it is ready, and apply the answers to the deck and the catalogs together. Stop and ask before shipping unreviewed fa/ckb text.

## Definition of done

- [ ] No visible string, text prop, accessibility label or alert text is a literal; everything comes from `t()`/`<T>` with a literal or typed-table key.
- [ ] Every key used exists in en, de, fa and ckb; catalogs are flat, sorted, and game keys start with the game id.
- [ ] Every text the design shows equals the copy deck, and every Shell text the deck lacks equals `assets/shell-extras.json` with no retired key left: `node ${CLAUDE_SKILL_DIR}/scripts/copy-deck.mjs check . --screen <S…> [--game <id>]` prints `RESULT: PASS` for each screen built.
- [ ] Numbers are typed, counted nouns are plurals with `one` and `other` (and the same `=N` branches) in all four languages.
- [ ] The polyfills are the first import of `start-shell.ts` and in Jest `setupFiles`; dates use `formatDayMonth()`.
- [ ] The i18n Jest tests pass; new fa/ckb texts are listed for the native-speaker review.
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
- **Waiving the native review because the deadline is close.** Only the owner decides that, and the decision is recorded.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/catalogs-keys-and-icu.md](references/catalogs-keys-and-icu.md) | Catalog files, key grammar, placeholders, plurals and CLDR categories, bidi isolation, dates, every catalog rule with its message | Workflow step 4, and when a catalog check fails |
| [references/runtime-and-provider.md](references/runtime-and-provider.md) | Packages and versions, why the polyfills are forced, the i18n folder, language resolution, locale tags, `t()`/`T`/provider, game keys, Jest setup and tests | Workflow step 1, and when changing runtime i18n code |
| [references/translation-workflow.md](references/translation-workflow.md) | The copy deck and its game-key mapping, writing a new message, glossary, tone per language, native review, reviewer questions | Workflow steps 2-4 and 7 |
| [examples/add-a-counted-message.md](examples/add-a-counted-message.md) | A new plural message in four languages, from key to test to checks | Workflow step 4 |
| `templates/shell-i18n/` | The Shell i18n modules and their tests (polyfills and `intl-status` are synced from the library, do not edit them here; languages, `resolveLanguage`, digits tag, bidi, messages, `t()`, `T`, provider, `formatDayMonth`, `gameMessageText`) | Workflow step 1; copy to `packages/shell/src/i18n/` |
| `templates/tooling-i18n/` | The project linter behind `npm run i18n:verify` (same rules and messages as the skill's checker) and its test | Workflow step 1; copy to `packages/tooling/src/i18n/` |
| `templates/game-i18n/keys.ts` | Optional typed tables of a game's plain literal message ids (`__GAME_ID__`), shown by the Shell through `gameMessageText` | Workflow step 3, only when used |
| `templates/root-test/start-shell-imports.test.ts` | Guardrail test: the polyfills are the first import of `start-shell.ts` | Workflow step 1; copy to `test/integration/i18n/` |
| `scripts/check-catalogs.mjs` | Checks every catalog: rules L1-L12, parity with en (P1-P4), files (F1) | Workflow step 6, after every catalog change |
| `scripts/check-i18n-code.mjs` | Checks source for literal text, built or unknown keys, game ids cast outside `game-message-text.ts`, react-intl imports, date APIs, polyfill order and data, Jest setup | Workflow step 6 |
| `scripts/copy-deck.mjs` | Looks up (`keys`), writes (`apply`) and verifies (`check`) deck texts and the Shell texts the deck lacks (`--extras`) in the catalogs; fails retired Shell keys | Workflow steps 1-3 and 6 |
| `scripts/lib/icu-parse.mjs` | Dependency-free ICU MessageFormat parser (same shapes as FormatJS) | Read only when changing a checker |
| `scripts/lib/catalog-rules.mjs` | The rule implementations shared by the checkers | Read only when changing a rule |
| `scripts/lib/source-scan.mjs` | JSX, call and import scanning helpers for the code checker | Read only when changing a checker |
| `scripts/selftest.mjs` | Proves every checker passes its good fixture and catches each planted bug | After changing a script or fixture |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/copy-deck.json` | The copy deck: every Shell and game text in en, de, fa, ckb, per screen (synced; do not edit here) | Through `copy-deck.mjs`; read `meta` for samples and render notes |
| `assets/shell-extras.json` | The five Shell texts the deck lacks (score line, Undo and Hint labels, tap-then-tap announcements) in four languages, and the retired Shell keys; read by `copy-deck.mjs --extras` | Workflow steps 1 and 4; change only with the owner |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad inputs for the self-test, one folder per checker | When adding a rule |

## Related skills

- `rtl-and-direction` - layout direction, mirroring, digits outside messages, bidi in layout, Vazirmatn.
- `accessibility` - roles, labels and hints (their text comes from here), text scaling.
- `toybox-screens` - which keys each screen uses and where they sit.
- `toybox-visual-parity` - proves the built screen matches its design screenshot.
- `naming-conventions` - naming beyond message keys.
