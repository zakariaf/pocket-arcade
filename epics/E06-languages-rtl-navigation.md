# E06 · Languages, right-to-left and navigation basics

| | |
|---|---|
| Branch | `epic/e06-languages-rtl-navigation` |
| Depends on | E05 |
| Spec | N6, N11, N12; 7.1 (the four languages), 7.2 (choosing the language), 7.3 (numbers), 7.4 (writing and texts), 7.5 (the direction plumbing only; mirroring is judged on screens from E11 on), 7.6 (the font list only); 5 (route param types); D7 (German "du"); L13 (debug texts stay English); O6 and L14 (d) (the fa/ckb review never blocks); groundwork for 15.1 and 15.2 |
| Build order | Shell step 6 |
| Tasks | 9 |

## Current state

E05 has finished Shell steps 1 to 5:

- The monorepo exists in the repo root with `packages/game-kit`, `packages/shell`, `packages/tooling` and `apps/line-siege`, the root configs, the lefthook hooks, `npm run -s check:fast`, `npm run verify` and the guardrail. `shell-slice.json` says `"screens": []` (no Shell app yet).
- `packages/shell/src/i18n/` holds only the bootstrap's `intl-polyfills.ts` and `intl-status.ts` with `intl-status.test.ts` (the forced Intl polyfills, also listed in Jest `setupFiles`). The bootstrap's `eslint.config.mjs` already allows `I18nManager` only in `packages/shell/src/i18n/direction.ts`, `react-intl` only inside `packages/shell/src/i18n/`, and `require()` only in `packages/shell/src/app/test-only.ts`. The root `package.json` already has the canonical `"i18n:verify": "node packages/tooling/src/i18n/verify-catalogs.ts"` script, but its target file does not exist.
- game-kit with `dates/date-key.ts` (`isoWeekday`) (E02); Line Siege's rules, levels and its own four catalogs in `apps/line-siege/src/i18n/` (E03); the save layer with schema v1 (`services/save/schema/save-doc.ts`, which exports `RunRef`), `expo-sqlite` and the node:sqlite tests in `test/integration/save/` (E04); the services behind their ports with fakes, the progress, settings and stats stores and the GameSession store (E05).
- Green now: `npx tsc --noEmit -p packages/shell`, `npm run -s check:fast`, `npm run test:coverage`; `check-layout.mjs .`, `check-boundaries.mjs .` and `check-stores.mjs .` print RESULT: PASS with no SKIP line.

Not there yet:

- No Shell catalogs (`packages/shell/src/i18n/catalogs/`), no language resolution, no `t()`, no digit or date formatting, no bidi isolation, no direction logic, no font list, no route param types, no test-only gate.
- No `packages/tooling/src/i18n/`, so `npm run i18n:verify` fails and `npm run verify` stops at that step. `check-gate-wiring.mjs .` prints seven script-target SKIP lines, one of them for `verify-catalogs.ts` (step 6).
- `check-premium.mjs .` prints `SKIP packages/shell/src/i18n/catalogs/en.json [catalog-keys] due at Shell step 6: packages/shell/src/i18n/catalogs/en.json not yet created`.
- `react-intl`, `@formatjs/cli` and `@formatjs/icu-messageformat-parser` are not installed.

## What we will do

Build Shell step 6: the language, text and direction pieces whose tests run on their own. Nothing in this epic imports the Toybox theme, a component, `renderWithShell` or `start-shell.ts`. Every file is copied from its skill's template exactly as the step 6 manifest in `pocket-arcade-index` lists it, and arrives with its test, written first.

- **Languages (7.1, 7.2):** the four languages with their direction and their own names (autonyms), and the rule that picks the language: the saved choice, then the phone's first supported language (any Sorani tag is ckb, any Persian tag including Dari is fa), then English.
- **Numbers and text (7.3, 7.4, N12):** the locale tag for the chosen digits, number and percent formatters (ckb uses ۰۱۲ like fa; ٫ ٬ ٪ marks), FSI/PDI isolation of free text, `t()` with ICU plurals, dates without `Intl.DateTimeFormat`, and `gameMessageText`, the one door for game texts.
- **Catalogs:** the project linter behind `npm run i18n:verify`, the owner's fa/ckb review sheet, and the four Shell catalogs generated from the Toybox copy deck (debug texts English in all four, L13; German "du", D7).
- **Direction (7.5, N11):** `direction.ts` as the only `I18nManager` reader, the pure restart plan (keep, restart, give-up), the guard port and its `expo-sqlite/kv-store` adapter, and the script font list (7.6).
- **Navigation basics (5):** `route-params.ts` (types only), and the test-only gate with its pair holding only `TEST_BUILD_SENTINEL`.
- Prove step 6 with its own done-when checks, then simplify, review and merge.

Not in this epic:

- `t.tsx`, `i18n-provider.tsx`, `t-bridge.tsx`, `t-context.ts`, `language-context.tsx`, `use-localized-text-style.ts`, `direction-context.tsx`, `board-direction-view.tsx`, `route-guards.ts`, the navigator, `start-shell.ts` and `test/integration/i18n/start-shell-imports.test.ts`: E09 (Shell step 7), because their tests render through `renderWithShell` or read `start-shell.ts`. Copying them now would drop `npm run test:coverage` under its function threshold.
- `expo-localization`: E09, with its first importer (`app/device-adapters.ts`).
- The font files (Vazirmatn, Lilita One, Rubik) and the `expo-font` plugin list: E07 and E10. The font test page that renders ڕ ڵ ۆ ێ ە ڤ: E15 (S15).
- The language screens and the restart flows (S2, S11a, the S14 "Restart to apply" dialog): E11 and E14. The RTL Maestro flow `03-language-switch.yaml`: E16.
- Any screen. No task here builds or changes a screen, so no task has a Design match line.
- The owner's fa/ckb text review (owner step G7): listed in the report, never waited for.

## Final state

- [ ] The four Shell catalogs `packages/shell/src/i18n/catalogs/{en,de,fa,ckb}.json` exist, sorted, equal to the copy deck plus the Shell extras: `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --all --extras` and `node skills/i18n-strings-and-catalogs/scripts/check-catalogs.mjs .` print RESULT: PASS.
- [ ] `npm run i18n:verify` exits 0 and prints `i18n:verify: 0 catalog dir(s) failing` (Shell and Line Siege catalogs).
- [ ] Every `debug.*` text equals its English text in de, fa and ckb (L13), `consent.tracking.usage-description` is plain text in all four, and `result.win.moves-count` is gone: the two commands above pass (rules P5 `debug-english`, `system-text-plain`, `retired-key`).
- [ ] The language rule of 7.2, the digit rules of 7.3, `t()`, dates and game texts are tested: `npx jest --ci packages/shell/src/i18n` passes.
- [ ] The direction plan restarts only on a direction flip and at most once per direction, and the guard survives a reload: `npx jest --ci packages/shell/src/i18n/direction-plan.test.ts packages/shell/src/i18n/direction.test.ts test/integration/save/sqlite-kv-direction-guard-adapter.test.ts` passes.
- [ ] Route params are typed and the test-only gate compiles: `npx tsc --noEmit -p packages/shell` passes, and `node skills/ios-simulator-build/scripts/check-sim-setup.mjs . | grep -E '\[(test-only-gate|test-only-import|sentinel|entry-public|entry-api-match)\]'` prints no line (the checker's other rules wait for E10; see E06-T07).
- [ ] `npm run -s check:fast` and `npm run test:coverage` are green.
- [ ] `check-stores.mjs .` (state-stores), `check-boundaries.mjs .` and `check-layout.mjs .` (architecture-and-boundaries) print RESULT: PASS with no SKIP line.
- [ ] `check-i18n-code.mjs .`, `check-rtl.mjs .`, `check-navigation.mjs .`, `check-save-layer.mjs .`, `check-test-setup.mjs .`, `check-gate-wiring.mjs .` and `check-premium.mjs .` print RESULT: PASS with exactly the SKIP lines listed in E06-T08.
- [ ] `npm run verify` now gets past `i18n:verify` (where it stopped before this epic); its only expected red step is `audit:network`, whose target arrives at Shell step 8 (E10).
- [ ] `node packages/tooling/src/i18n/review-sheet.ts` exits 0, writes `reports/i18n/review-fa.csv` and `review-ckb.csv` and prints the `OWNER STEP (not blocking)` line; the slice report lists the count under "Owner steps (not blocking)".
- [ ] The branch is merged into main with the slice report passing `node skills/git-commits-and-reporting/scripts/check-report.mjs <report> --kind slice`.

## Skills to load

Always: `pocket-arcade-index`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`.

For this epic:

- `pocket-arcade-product-spec`: prints N6, N11, N12, 7.1 to 7.6, 5 and D7 exactly (`spec-lookup.mjs`) for the commit bodies.
- `i18n-strings-and-catalogs`: the `templates/shell-i18n/` and `templates/tooling-i18n/` files, `copy-deck.mjs`, `check-catalogs.mjs`, `check-i18n-code.mjs` and the review sheet.
- `rtl-and-direction`: `direction.ts`, `direction-plan.ts`, `direction-guard.ts`, the digits and bidi tests, `create-number-formatter.ts`, `fonts.ts`, the guard adapter and its node:sqlite test; `check-rtl.mjs`.
- `navigation-and-routing`: `route-params.ts`; `check-navigation.mjs`.
- `architecture-and-boundaries`: the test-only gate and pair; `check-boundaries.mjs` (rule `test-only-gate`) and `check-layout.mjs`.
- `ios-simulator-build`: owns the test-only pair in the partial Shell core; `check-sim-setup.mjs`'s test-only rules prove the gate, the sentinel and the pair.
- `save-persistence-and-migrations`: the guard adapter lives in `services/save/` as one of the two allowed `expo-sqlite/kv-store` users; `check-save-layer.mjs`.
- `state-stores`: `check-stores.mjs` must stay PASS with no SKIP line.
- `premium-purchase`: `check-premium.mjs`'s `catalog-keys` rule becomes strict once `en.json` exists.
- `dependency-management`: `plan-dependency.mjs` for the three new packages and `check-deps-policy.mjs`.
- `unit-and-component-tests`: Jest projects, the ESM transform for react-intl and @formatjs, node:sqlite tests under `test/`, fast-check properties; `check-test-setup.mjs`.
- `typescript-and-lint-rules`: strict `tsc` per workspace and `check-source.mjs`.
- `naming-conventions`: path headers and kebab-case file names (`check-file-names.mjs`), the catalog key grammar (`check-code-names.mjs`).
- `troubleshooting-playbook`: `find-fix.mjs` for known failures (`testing-esm-transform`, `testing-coverage-untested-templates`, `testing-node-api-tests`, `i18n-hermes-intl`, `deps-knip-formatjs-cli`).

## How we work in this epic

1. Branch: `git switch main && git pull && git switch -c epic/e06-languages-rtl-navigation`. Push the branch after each task. Two limits apply: a push needs the owner's word in the session (git-commits-and-reporting rule 5), and the pre-push hook runs `npm run verify`, which stays red at `audit:network` until Shell step 8 (E10). If the hook refuses the push for that reason, keep the commits local; never bypass it (`--no-verify`, `LEFTHOOK=0`).
2. Test first, always. Write each task's "Tests first" items, run them and watch them fail for the right reason, write the minimum code to pass, then refactor. Never weaken or edit a test to make it pass. Here "the code" is usually a skill template: put a typed stub in place that returns a wrong value, run the test and keep the assertion diff (never "Cannot find module") for the report, then copy the template over the stub.
3. Commit each task in Conventional Commits form, with the trailers the skills ask for (Gate-Change:, Spec-Change:). `npm run -s check:fast` must be green before every commit. One behaviour per commit, so a task may make two or three commits. Check each message with `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged` and each staged slice with `node skills/tdd-workflow/scripts/check-test-edits.mjs . --staged --message reports/commit-message.txt`. No file this epic touches is a gated path, so no Gate-Change trailer is expected; one is needed only if a dated exclude has to go into `.npmrc`.
4. Screens: a task that builds or changes a screen is not done until the app's capture matches the Toybox design screenshot for every frame it names, in light-en, light-fa, dark-en and dark-fa at every scroll offset, and check-signoff passes for those frames. No task in this epic builds or changes a screen; the first screen work is E11.
5. Stop and ask the owner only at a step marked **Owner**. This epic has none: the fa/ckb review (G7) is listed in the report and never waited for.

## Tasks

### E06-T01 · Language list and language choice

- **Goal:** the Shell knows its four languages (code, direction, own name) and picks the language as spec 7.2 says: the player's saved choice; otherwise the phone's first language that is one of the four, with any Sorani tag counted as ckb and any Persian tag (Dari included) as fa; otherwise English. Kurmanji (`kmr`, or `ku` in Latin script) is never mapped to Sorani. S2 and Settings call this later (E11, E14).
- **Skills:** `i18n-strings-and-catalogs`, `pocket-arcade-product-spec`, `naming-conventions`, `tdd-workflow`.
- **Tests first:**
  - `packages/shell/src/i18n/resolve-language.test.ts` (unit, from i18n-strings-and-catalogs' `templates/shell-i18n/`): a saved `de` wins over a Persian phone; `ckb` and `ku` in Arabic script give ckb; `prs` (Dari) gives fa; `ku` in Latin script is skipped so the next locale (`de`) wins; `kmr` gives en; an empty locale list gives en; `LANGUAGE_AUTONYMS` is pinned to English, Deutsch, فارسی, کوردیی ناوەندی.
  - Add one fast-check property to the same file (tdd-workflow rule 7): for any device locale list the result is one of en, de, fa, ckb, and any saved language comes back unchanged.
  - Red: stubs `languages.ts` (the `Language` type and an empty `LANGUAGE_AUTONYMS`) and `resolve-language.ts` (`resolveLanguage` always returns `'en'`); `npx jest --ci packages/shell/src/i18n/resolve-language.test.ts` must show assertion diffs.
- **Build:** print the spec lines for the commit body with `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs N6 7.1 7.2`. Copy `languages.ts` and `resolve-language.ts` from i18n-strings-and-catalogs' `templates/shell-i18n/` into `packages/shell/src/i18n/` over the stubs (rtl-and-direction ships the same `languages.ts` byte for byte; copy it once). Commit as `feat(shell): resolve the player's language from save and phone`.
- **Done when:** `npx jest --ci packages/shell/src/i18n/resolve-language.test.ts` passes; `npx tsc --noEmit -p packages/shell` passes; `npm run -s check:fast` is green; `node skills/naming-conventions/scripts/check-file-names.mjs .` and `node skills/tdd-workflow/scripts/check-tests.mjs .` print RESULT: PASS.

### E06-T02 · Digits, number formatting, bidi isolation and script fonts

- **Goal:** numbers outside catalog sentences use the chosen digit style (spec 7.3: Automatic, Latin or Local; ckb uses the Persian-style ۰۱۲ by default, not CLDR's ١٢٣; ٫ ٬ ٪ marks), interpolated free text cannot reorder a right-to-left sentence (7.4), and each language and Toybox face gets its font family (7.6: Vazirmatn for fa and ckb).
- **Skills:** `rtl-and-direction`, `i18n-strings-and-catalogs`, `unit-and-component-tests`, `troubleshooting-playbook`, `tdd-workflow`.
- **Tests first:**
  - `packages/shell/src/i18n/digits.test.ts` (unit, from rtl-and-direction): 1234567.89 gives `1,234,568` in en, `1.234.568` in de and `۱٬۲۳۴٬۵۶۸` in fa and ckb (Automatic and Local); fa with Latin digits gives `123`; ckb Automatic gives `۱۲۳` while plain `Intl.NumberFormat('ckb')` gives `١٢٣`; with the ckb tag 1234.5 gives `۱٬۲۳۴٫۵` and 0.42 as a percent gives `۴۲٪`.
  - `packages/shell/src/i18n/create-number-formatter.test.ts` (unit, from rtl-and-direction): `createPercentFormatter` rounds to a whole percentage (the S10 win rate) and `createNumberFormatter` prints no percent sign.
  - `packages/shell/src/i18n/bidi.test.ts` (unit, from rtl-and-direction): `isolate` wraps text in U+2068 ... U+2069 and `stripIsolates` removes them. Add a fast-check property: `stripIsolates(isolate(s))` equals `s` for any `s` without isolates.
  - `packages/shell/src/i18n/fonts.test.ts` (unit, from rtl-and-direction): `scriptFontFor` gives LilitaOne, Rubik-Regular and Rubik-Bold in en and de, Vazirmatn-Regular and Vazirmatn-Bold in fa and ckb, and LilitaOne for the brand face in every language.
  - Red: stubs where `localeTagFor` returns the bare language code, `isolate` returns the text unchanged and `scriptFontFor` always returns Rubik-Regular; each test must fail on an assertion.
- **Build:** copy `digits.ts` and `bidi.ts` from i18n-strings-and-catalogs' `templates/shell-i18n/` (identical to rtl-and-direction's copies) and `create-number-formatter.ts` and `fonts.ts` from rtl-and-direction's `templates/shell-i18n/` into `packages/shell/src/i18n/`. The Persian digits in Jest come from the bootstrap's forced polyfills in `setupFiles`; if Latin digits appear, run `node skills/troubleshooting-playbook/scripts/find-fix.mjs --id i18n-hermes-intl`. Glyph coverage of ڕ ڵ ۆ ێ ە ڤ is a property of the font files (E07) and is shown on the font test page (E15), not here. Commit one behaviour each: `feat(shell): format numbers in the chosen digit style`, `feat(shell): isolate free text inside sentences`, `feat(shell): pick the font family per language and face`.
- **Done when:** `npx jest --ci packages/shell/src/i18n/digits.test.ts packages/shell/src/i18n/create-number-formatter.test.ts packages/shell/src/i18n/bidi.test.ts packages/shell/src/i18n/fonts.test.ts` passes; `npx tsc --noEmit -p packages/shell` passes; `npm run -s check:fast` is green; `node skills/tdd-workflow/scripts/check-tests.mjs .` prints RESULT: PASS.

### E06-T03 · Catalog linter, i18n:verify and the review sheet

- **Goal:** a broken or missing text fails the build, not a player: the project linter behind `npm run i18n:verify` (the same rules L1-L12 and P1-P5 as `check-catalogs.mjs`) and the owner's fa/ckb review sheet exist and are tested. The review sheet lists texts for the owner and always exits 0, because the review never blocks (O6, L14 d).
- **Skills:** `i18n-strings-and-catalogs`, `dependency-management`, `quality-gates`, `unit-and-component-tests`, `troubleshooting-playbook`, `tdd-workflow`.
- **Tests first:**
  - `packages/tooling/src/i18n/catalog-lint-rules.test.ts` (unit, from i18n-strings-and-catalogs' `templates/tooling-i18n/`): a whole sentence with a typed number and a counted plural is accepted; Latin punctuation and Arabic ي/ك are rejected in fa, except in the English debug menu; game ids stay out of Shell keys and bad key shapes fail; `debugEnglishProblems` accepts English `debug.*` texts in every language and rejects a translated one (L13); `missingGameKeys` requires a game's name, win title and tagline and asks nothing of the Shell catalog.
  - `packages/tooling/src/i18n/review-sheet.test.ts` (unit, temporary folders): `shownOnOf` names the screen, game or system dialog of a key; `pendingRows` lists every fa/ckb text not yet reviewed, sorted, and never a `debug.*` key; a reviewed text drops out until its text changes; `csvOf` writes a byte-order mark, a header and quoted fields; `markReviewed` records hash and date, refuses unknown keys and debug keys; `runReviewSheet` writes both CSV files, prints the owner step and exits 0, and exits 2 only for bad input.
  - Red: stubs of `catalog-lint-rules.ts` (every function returns no problems) and `review-sheet.ts` (returns no rows, exit code 1); the tests must fail on assertions.
- **Build:**
  - Install with the pinned plans, running every printed step (install, `npm approve-scripts --allow-scripts-pending` after reading any install script, knip, `check-deps-policy.mjs`): `node skills/dependency-management/scripts/plan-dependency.mjs @formatjs/icu-messageformat-parser --root .` (prints `npm install -D @formatjs/icu-messageformat-parser@3.5.20 -w packages/tooling`) and `node skills/dependency-management/scripts/plan-dependency.mjs @formatjs/cli --root .` (prints `npm install -D @formatjs/cli@6.16.32`). For the knip step use the form `npm run verify` runs while `shell-slice.json` exists: `npm run -s knip -- --exclude exports,nsExports,types,nsTypes,enumMembers,namespaceMembers,duplicates`. `@formatjs/cli` is run through `npx formatjs verify`, so knip sees no import; the baseline `knip.json` already lists it (`find-fix.mjs --id deps-knip-formatjs-cli`).
  - Copy all of i18n-strings-and-catalogs' `templates/tooling-i18n/` into `packages/tooling/src/i18n/`: `catalog-lint-rules.ts`, `catalog-lint.ts`, `icu-walk.ts`, `verify-catalogs.ts`, `review-sheet.ts` and the two tests.
  - Do not add an `i18n:verify` script: the bootstrap wrote it; confirm the root `package.json` line is exactly `"i18n:verify": "node packages/tooling/src/i18n/verify-catalogs.ts"`.
  - `npm run i18n:verify` is expected to fail at the end of this task (no Shell catalogs until T04).
  - Commit as `feat(tooling): lint catalogs and write the fa and ckb review sheets`.
- **Done when:** `npx jest --ci packages/tooling/src/i18n` passes; `npx tsc --noEmit -p packages/tooling` passes; `node skills/dependency-management/scripts/check-deps-policy.mjs .` prints RESULT: PASS; `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints RESULT: PASS with six script-target SKIP lines (`audit-network.ts`, `audit-privacy.ts` and `build-ios-sim.ts` due at step 8; `run-e2e-ios.ts` and `capture-screenshots-ios.ts` due at step 10; `release-ios.ts` due at step 11) and none for `verify-catalogs.ts`; `npm run -s check:fast` is green.

### E06-T04 · The four Shell catalogs from the copy deck

- **Goal:** every Shell text exists in en, de, fa and ckb exactly as the Toybox copy deck writes it, so later screens can match their design screenshots (N6, N12, 7.4): the deck's Shell keys, the system dialog text `consent.tracking.usage-description` as plain text (owner decision O1), and the ten Shell texts the deck lacks from `assets/shell-extras.json` (the score line `result.win.score-line` of L3, the Undo and Hint labels, the tap-then-tap announcements and the debug Performance texts `debug.perf.*`). Debug texts are English in all four (L13); German uses "du" (D7).
- **Skills:** `i18n-strings-and-catalogs`, `naming-conventions`, `premium-purchase`, `git-commits-and-reporting`, `tdd-workflow`.
- **Tests first:** For data, the checkers are the tests; keep these red runs for the report:
  - `node skills/i18n-strings-and-catalogs/scripts/check-catalogs.mjs .` prints `[F1 catalog-file]` FAIL lines for the missing `en.json`, `de.json`, `fa.json` and `ckb.json`.
  - `npm run i18n:verify` exits 1 for the Shell catalog folder.
  - `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --all --extras` fails with `deck-key-missing` and `extra-key-missing` lines.
- **Build:**
  - Generate the catalogs: `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs apply . --all --extras`. It writes `packages/shell/src/i18n/catalogs/{en,de,fa,ckb}.json`, keys sorted (about 299 keys per language). Never type or "improve" a text by hand: a wording change goes into the deck (or `assets/shell-extras.json`) with the owner first, then into the catalogs.
  - Read the diff for four facts: `consent.tracking.usage-description` has no brace or argument in any language; `result.win.score-line` is present and `result.win.moves-count` is absent; every `debug.*` text is the English text in de, fa and ckb; the German texts say "du" (they equal the deck, which is written that way).
  - Run the owner's review sheet: `node packages/tooling/src/i18n/review-sheet.ts`. It writes `reports/i18n/review-fa.csv` and `reports/i18n/review-ckb.csv` (debug keys left out) and prints `OWNER STEP (not blocking): ...` with the count. Keep that line for the slice report under "Owner steps (not blocking)" (owner step G7) and carry on.
  - Commit as `feat(shell): add the four shell catalogs from the copy deck`, with `Spec N6, N12, 7.4, D7` and `L13` in the body.
- **Done when:** `node skills/i18n-strings-and-catalogs/scripts/check-catalogs.mjs .` and `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --all --extras` print RESULT: PASS; `npm run i18n:verify` exits 0 and prints `i18n:verify: 0 catalog dir(s) failing`; `node skills/naming-conventions/scripts/check-code-names.mjs .` prints RESULT: PASS; `node skills/premium-purchase/scripts/check-premium.mjs .` prints RESULT: PASS with only its `[plugin-entry]` SKIP line due at step 8 (the `[catalog-keys]` SKIP is gone and the rule passes); `node packages/tooling/src/i18n/review-sheet.ts` exits 0; `npm run -s check:fast` is green.

### E06-T05 · Messages, t() and dates

- **Goal:** every sentence is one translated message with typed numbers and plurals from the catalogs (N12, 7.4): `t()` over react-intl isolates free text and reports a number passed to a text placeholder; day and month labels come from catalog names, never `Intl.DateTimeFormat` (Hermes would show fa dates in the Solar Hijri calendar); `gameMessageText` is the only way a game's message id becomes text.
- **Skills:** `i18n-strings-and-catalogs`, `dependency-management`, `unit-and-component-tests`, `troubleshooting-playbook`, `tdd-workflow`.
- **Tests first:**
  - `packages/shell/src/i18n/create-t.test.ts` (unit, from i18n-strings-and-catalogs): `result.win.moves` gives `1 move – par 7`, `0 moves – par 7`, `1 Zug – Par 7`, `2 Züge – Par 7`, `۰ حرکت – هدف ۷` and `۳ جووڵە – ئامانج ۷`; the `=0` branch of `daily.streak.count` wins over Persian `one` (which holds 0); ckb with Latin digits keeps `12`; `stats.win-rate` in fa gives `درصد برد ۴۲٪`; `levels.pack.locked` wraps `packName` in FSI ... PDI; a number given to `packName` is reported through `onError`.
  - `packages/shell/src/i18n/format-date.test.ts` (unit): `formatDayMonth` in all four languages from the catalog month names; a date put into another message nests isolates unless `stripIsolates` runs first; 2026-09-26 is named a Saturday from the catalogs; the week strip has one head per ISO weekday, Monday first.
  - `packages/shell/src/i18n/game-message-text.test.ts` (unit): a game `Message` with a plural and digits in en, de and fa; a bare id without values.
  - Red: stubs where `createT` returns the key, `formatDayMonth` returns an empty string and `gameMessageText` returns the id; every test must fail on an assertion.
- **Build:**
  - Install react-intl: `node skills/dependency-management/scripts/plan-dependency.mjs react-intl --root .` (prints `npm install react-intl@12.1.3 -w packages/shell`) and every printed step, with the slice form of knip from T03.
  - Copy `messages.ts`, `create-t.ts`, `format-date.ts` and `game-message-text.ts` with their three tests from i18n-strings-and-catalogs' `templates/shell-i18n/` into `packages/shell/src/i18n/`. Do not copy `t.tsx`, `i18n-provider.tsx`, `t-bridge.tsx`, `t-context.ts` or `language-context.tsx` (E09).
  - If Jest stops with `SyntaxError: Cannot use import statement outside a module` in react-intl or @formatjs, run `node skills/troubleshooting-playbook/scripts/find-fix.mjs --id testing-esm-transform`; `jest.config.js` is a gated path, so a missing allowlist entry is a question for the owner, not a quiet edit.
  - Commit one behaviour each: `feat(shell): format catalog messages with t()`, `feat(shell): format dates from catalog month and weekday names`, `feat(shell): show game texts through gameMessageText`.
- **Done when:** `npx jest --ci packages/shell/src/i18n/create-t.test.ts packages/shell/src/i18n/format-date.test.ts packages/shell/src/i18n/game-message-text.test.ts` passes; `npx tsc --noEmit -p packages/shell` passes; `node skills/i18n-strings-and-catalogs/scripts/check-i18n-code.mjs .` prints RESULT: PASS with exactly two SKIP lines (`SKIP packages/shell/src/app/start-shell.ts [polyfill-first]` and `SKIP packages/shell/src/i18n [i18n-runtime]`, both `due at Shell step 7: packages/shell/src/app/start-shell.ts not yet created`); `node skills/dependency-management/scripts/check-deps-policy.mjs .` and `node skills/tdd-workflow/scripts/check-tests.mjs .` print RESULT: PASS; `npm run -s check:fast` is green.

### E06-T06 · Direction: the one reader, the restart plan and the guard

- **Goal:** one source of layout direction, so no layout code ever says left or right (N11): only `direction.ts` reads `I18nManager`; a pure plan restarts the app only when the language's direction differs from the layout, and never twice for the same direction (it answers `give-up` instead of looping; `start-shell.ts` logs that at E09); a guard remembers the pending restart across one reload in its own small key-value database, never in the save document. E09's boot and E11/E14's language screens use these.
- **Skills:** `rtl-and-direction`, `save-persistence-and-migrations`, `architecture-and-boundaries`, `unit-and-component-tests`, `troubleshooting-playbook`, `tdd-workflow`.
- **Tests first:**
  - `packages/shell/src/i18n/direction-plan.test.ts` (unit, from rtl-and-direction): the six-row table (fa on rtl keeps; en on ltr with rtl pending keeps; fa on ltr restarts; de on rtl with rtl pending restarts; ckb on ltr with rtl pending gives up; en on rtl with ltr pending gives up); `languageFromRawSave` reads `settings.language` from an unvalidated save and returns null for `null`, `42`, `'fa'`, `{}`, `{ settings: null }` and an unknown language code.
  - Add a fast-check property to the same file: for any language, layout and pending direction, the plan is `keep` whenever the layout already matches, and never `restart` when the pending direction already equals the wanted one (at most one restart per direction).
  - `packages/shell/src/i18n/direction.test.ts` (unit, `expo`'s `reloadAppAsync` mocked): `readLayoutDirection()` is `ltr` in Jest; `restartForDirection('rtl', guard)` writes `rtl` to the guard first, then reloads exactly once with `layout direction -> rtl`.
  - `test/integration/save/sqlite-kv-direction-guard-adapter.test.ts` (integration, the real kv-store SQL on node:sqlite): nothing pending on a fresh install; a write lands in the kv-store table, not the save document; the marker survives a simulated JS reload; `null` clears it; anything but `ltr` or `rtl` reads as no pending restart.
  - Red: stubs where `planDirection` always returns `keep`, `restartForDirection` does nothing, and the adapter's `readPending` returns null and `writePending` does nothing.
- **Build:** copy from rtl-and-direction: `templates/shell-i18n/direction.ts`, `direction-plan.ts` and `direction-guard.ts` with `direction.test.ts` and `direction-plan.test.ts` into `packages/shell/src/i18n/`; `templates/shell-save/sqlite-kv-direction-guard-adapter.ts` into `packages/shell/src/services/save/`; `templates/root-test/sqlite-kv-direction-guard-adapter.test.ts` into `test/integration/save/`. Do not copy `direction-context.tsx`, `use-localized-text-style.ts`, `board-direction-view.tsx` or `start-shell.ts` (E09). If `tsc` fails on node:sqlite types inside `packages/shell`, run `node skills/troubleshooting-playbook/scripts/find-fix.mjs --id testing-node-api-tests` (Node-API tests live under the root `test/`). Commit one behaviour each: `feat(shell): plan a layout direction restart at most once`, `feat(shell): restart for a new layout direction through one module`, `feat(shell): remember a pending direction restart across reloads`.
- **Done when:** `npx jest --ci packages/shell/src/i18n/direction-plan.test.ts packages/shell/src/i18n/direction.test.ts test/integration/save/sqlite-kv-direction-guard-adapter.test.ts` passes; `npm run -s typecheck` passes (the root program covers `test/`); `node skills/rtl-and-direction/scripts/check-rtl.mjs .` prints RESULT: PASS with exactly `SKIP packages/shell/src/game-host/board-direction-view.tsx [direction-files] due at Shell step 7: packages/shell/src/app/start-shell.ts not yet created`; `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .` prints RESULT: PASS with exactly the boot-file SKIP lines listed in T08; `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` prints RESULT: PASS with no SKIP line; `node skills/tdd-workflow/scripts/check-tests.mjs .` prints RESULT: PASS; `npm run -s check:fast` is green.

### E06-T07 · Route params and the test-only gate

- **Goal:** the one route with params (Game: resume the saved run, or start a new one with a `RunRef`) is typed now, so every later `navigate()` call type-checks (spec 5; navigation-and-routing rule 4; every other route takes no params). The only door to test-only code exists, with the literal `process.env.EXPO_PUBLIC_APP_VARIANT === 'store'` comparison that lets Metro drop test code from store bundles; the pair holds only `TEST_BUILD_SENTINEL` until its members' files exist.
- **Skills:** `navigation-and-routing`, `architecture-and-boundaries`, `ios-simulator-build`, `typescript-and-lint-rules`, `tdd-workflow`.
- **Tests first:** no Jest file, by design: `route-params.ts` is a types-only module and the three gate files carry `// device-only: covered by ...` (Jest cannot see Metro's bundle stripping; `check-test-edits.mjs` exempts both kinds). The red-first proof is the checkers:
  - Before the copy, `node skills/ios-simulator-build/scripts/check-sim-setup.mjs . | grep -E '\[(test-only-gate|test-only-import|sentinel|entry-public|entry-api-match)\]'` prints FAIL lines (`test-only.ts is missing` and `test-only-entry.ts is missing`). Only these five rules count here: the checker's other rules (the build script, the Xcode pin, `build-prereqs`) wait for E10, so its overall RESULT stays FAIL in this epic. Run it once without `grep` to confirm it ends with a RESULT line (exit 2 or an ERROR line would make an empty `grep` meaningless).
  - `node skills/architecture-and-boundaries/scripts/selftest.mjs` prints RESULT: PASS, which proves `check-boundaries.mjs`'s `test-only-gate` rule catches a gate written with an imported `IS_TEST_BUILD` constant (its `bad-test-only` fixture).
- **Build:**
  - Copy navigation-and-routing's `templates/route-params.ts` to `packages/shell/src/navigation/route-params.ts` (types only, no test; it imports `RunRef` from `services/save/schema/save-doc.ts`, E04). Commit as `feat(shell): type the game route params`.
  - Copy architecture-and-boundaries' `templates/test-only.ts` to `packages/shell/src/app/test-only.ts` unchanged.
  - Copy `templates/test-only-api.ts` and `templates/test-only-entry.ts` to `packages/shell/src/app/` and trim both to the sentinel: `TestOnlyApi` keeps only `readonly TEST_BUILD_SENTINEL: string;`, the entry keeps only `export const TEST_BUILD_SENTINEL = 'SHELL_TEST_BUILD_ONLY';` with its `/** ... @public */` tag. Delete every other import, member and export (none of those files exist yet, and `@react-navigation/native` arrives at E09). Keep the header comments and never remove the sentinel. ios-simulator-build and one other skill ship the same pair; there is one shared copy.
  - Commit as `feat(shell): gate test-only code behind the store variant`.
- **Done when:** `npx tsc --noEmit -p packages/shell` passes; `node skills/ios-simulator-build/scripts/check-sim-setup.mjs .` ends with a RESULT line and the same command with the `grep` above prints no line; `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` and `node skills/architecture-and-boundaries/scripts/check-layout.mjs .` print RESULT: PASS with no SKIP line; `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints RESULT: PASS with exactly the two SKIP lines listed in T08; `node skills/typescript-and-lint-rules/scripts/check-source.mjs .` prints RESULT: PASS; `node skills/tdd-workflow/scripts/check-test-edits.mjs . --staged --message reports/commit-message.txt` passed for both commits; `npm run -s check:fast` is green.

### E06-T08 · Prove Shell step 6

- **Goal:** show with the build order's own done-when that Shell step 6 is complete and that nothing from steps 1 to 5 broke, so E07 starts from a known state.
- **Skills:** `pocket-arcade-index`, `quality-gates`, `i18n-strings-and-catalogs`, `rtl-and-direction`, `navigation-and-routing`, `state-stores`, `architecture-and-boundaries`, `save-persistence-and-migrations`, `unit-and-component-tests`, `premium-purchase`, `typescript-and-lint-rules`, `naming-conventions`, `troubleshooting-playbook`.
- **Tests first:** no new test file. Before running anything, write the expected SKIP lines below into the report notes; any other SKIP line or any FAIL is a defect, fixed test-first in the task that owns the file (a failing test or a red checker line first, then the fix).
- **Build:** nothing new. Run the list below and fix what fails. Then run knip the way `npm run verify` runs it on a slice: `npm run -s knip -- --exclude exports,nsExports,types,nsTypes,enumMembers,namespaceMembers,duplicates`. Nothing imports `route-params.ts` or `test-only.ts` until E09 (`root-stack.tsx`, `hydrate-save.ts`). If knip lists them as unused files, do not add an ignore entry (`check-gate-wiring.mjs`'s `knip-ignores` rule) and do not pull step-7 files forward; look the output up with `find-fix.mjs --text`, and if there is no known fix, record it with the knip output in the slice report under "Not tested or not verified" (E09 brings their importers). shell-slice.json stays `"screens": []`.
- **Done when:**
  - `npx tsc --noEmit -p packages/shell` passes, `npm run -s check:fast` is green, `npm run test:coverage` is green (thresholds untouched) and `npm run i18n:verify` passes.
  - RESULT: PASS with no SKIP line: `node skills/state-stores/scripts/check-stores.mjs .`, `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .`, `node skills/architecture-and-boundaries/scripts/check-layout.mjs .`.
  - RESULT: PASS with exactly these not-yet-due SKIP lines (each `due at Shell step 7: packages/shell/src/app/start-shell.ts not yet created` unless stated):
    - `node skills/i18n-strings-and-catalogs/scripts/check-i18n-code.mjs .`: `SKIP packages/shell/src/app/start-shell.ts [polyfill-first]` and `SKIP packages/shell/src/i18n [i18n-runtime]`.
    - `node skills/rtl-and-direction/scripts/check-rtl.mjs .`: `SKIP packages/shell/src/game-host/board-direction-view.tsx [direction-files]`.
    - `node skills/navigation-and-routing/scripts/check-navigation.mjs .`: `SKIP packages/shell/src/navigation/route-guards.ts [route-guards-files]` and the slice line `SKIP packages/shell/src/navigation [route-table] no Shell app (shell-slice.json has "screens": [])`.
    - `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .`: `[missing-file]` for `packages/shell/src/app/hydrate-save.ts`, `hydrate-save.test.ts`, `use-checkpoint-on-background.ts` and `use-checkpoint-on-background.test.ts`, and `[no-background-checkpoint]` for `use-checkpoint-on-background.ts`.
    - `node skills/unit-and-component-tests/scripts/check-test-setup.mjs .`: `SKIP packages/shell/src/testing/render-with-shell.tsx [render-with-shell-missing]`.
    - `node skills/quality-gates/scripts/check-gate-wiring.mjs .`: the six script-target lines for `audit-network.ts`, `audit-privacy.ts`, `build-ios-sim.ts` (step 8), `run-e2e-ios.ts`, `capture-screenshots-ios.ts` (step 10) and `release-ios.ts` (step 11).
    - `node skills/premium-purchase/scripts/check-premium.mjs .`: only `[plugin-entry]` (due at Shell step 8: `packages/shell/src/config/shell-plugins.ts`).
  - RESULT: PASS: `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --all --extras`, `node skills/i18n-strings-and-catalogs/scripts/check-catalogs.mjs .`, `node skills/naming-conventions/scripts/check-file-names.mjs .`, `node skills/naming-conventions/scripts/check-code-names.mjs .`, `node skills/typescript-and-lint-rules/scripts/check-source.mjs .`, `node skills/dependency-management/scripts/check-deps-policy.mjs .`, `node skills/tdd-workflow/scripts/check-tests.mjs .`.
  - `node skills/ios-simulator-build/scripts/check-sim-setup.mjs .` ends with a RESULT line, and `node skills/ios-simulator-build/scripts/check-sim-setup.mjs . | grep -E '\[(test-only-gate|test-only-import|sentinel|entry-public|entry-api-match)\]'` prints no line (its other rules wait for E10).
  - `node packages/tooling/src/deps/check-deps.ts` exits 0, and `npm run verify` gets past `i18n:verify`; its only expected red step is `audit:network` (target arrives at Shell step 8, E10).

### E06-T09 · Simplify, code review, re-run the gates and merge

- **Goal:** the branch is as simple as it can be, has no confirmed defect, and reaches main with an honest evidence report that lists the fa/ckb texts waiting for the owner.
- **Skills:** `tdd-workflow`, `git-commits-and-reporting`, `quality-gates`, `i18n-strings-and-catalogs`.
- **Tests first:** every confirmed finding first gets a failing test (or a red checker line) that shows the problem, seen red on an assertion, then the fix. A finding about a text's wording goes into the copy deck with the owner first, never into a catalog by hand.
- **Build:**
  - Run `/simplify` over `git diff main...HEAD`. Most files are copies of skill templates that other skills and later steps copy byte for byte (`languages.ts`, `digits.ts` and `bidi.ts` are shared by two skills; `fonts.ts` and the test-only pair are synced copies). Keep them identical to their templates; apply simplifications to what this epic wrote itself (the added fast-check properties), and note suggestions for template files in the report instead.
  - Run `/code-review` on the branch and fix every confirmed finding test-first.
  - Re-run every item of T08's "Done when", then `node skills/tdd-workflow/scripts/check-tests.mjs .`, `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD` and `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD`.
  - Write the slice report: copy git-commits-and-reporting's `templates/evidence-slice.md` to `reports/evidence-<YYYY-MM-DD>-e06-languages.md`. Outcome first in plain words (for example: "Every Shell text now exists in English, German, Persian and Sorani, and the rules that pick the language, its digits and its reading direction are in place; nothing is on screen yet."); test counts from the Jest summary; the red runs under "Details"; the "texts changed in all four languages" block from `templates/report-changes.md` (the Shell catalogs are new); under "Owner steps (not blocking)" the fa/ckb review with the count and CSV paths from `review-sheet.ts` (G7; R3 at release); under "Not tested or not verified": nothing ran on a device yet (Hermes digits, the direction restart and fonts are seen from E10 and E11 on), plus any knip note from T08.
- **Done when:** `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e06-languages.md --kind slice`, `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD` and `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD` print RESULT: PASS; every T08 check is green again; the branch is merged as "Close the epic" step 5 says.

## Close the epic

1. Re-run every task's "Done when" and `npm run verify`; all green, except the one expected red step: `npm run verify` stops at `audit:network`, whose target arrives at Shell step 8 (E10) (pocket-arcade-index, "When npm run verify is green"). Any other red step is a real failure.
2. Run `/simplify` over the branch's changes (`git diff main...HEAD`). Apply its fixes; where behaviour changes, test first. Then run `npm run verify` again.
3. Run `/code-review` on the branch. Fix every confirmed finding test-first (a failing test that shows the problem, then the fix). Then run `npm run verify` again.
4. Write the epic's evidence report (git-commits-and-reporting, slice form) and check it with `node skills/git-commits-and-reporting/scripts/check-report.mjs <report> --kind slice`.
5. Merge: `git switch main && git merge --no-ff epic/e06-languages-rtl-navigation && git push origin main`, then delete the branch (`git branch -d epic/e06-languages-rtl-navigation`). The push follows the two limits in "How we work" step 1: the owner's word, and a pre-push hook that cannot pass before E10; until then main stays local.
