# E14 · Settings and its pages: S11, S11a, S11b, S11c, S11d

| | |
|---|---|
| Branch | `epic/e14-settings-pages` |
| Depends on | E13 |
| Spec | S11 Settings, S11a Language, S11b About and credits, S11c Privacy policy, S11d Licences; 4.2 point 4 (the privacy text shown offline inside Settings); 7.2 (choosing the language), 7.3 (numbers), 7.6 (font licences listed in S11d); 8.7 (sound, music and vibration settings), 8.11 (colour-blind colours, reduce motion, screen readers), 8.12 (theme; every screen matches its Toybox design); N6 (four languages, both directions), N9 (art and sounds made in code; CC0 credits on S11d); 15.1 (the S11 family's part: every screen matches its design in light and dark, en and fa); lead decisions L1 (Settings without the Music rows for a game without music) and L5 (the footer's "Version 1.0.0 (8)" as one text run) |
| Build order | Shell step 9 (S11, S11a, S11b, S11c, S11d) |
| Tasks | 8 |

## Current state

E13 merged Shell step 9 up to S10. Concretely:

- S1 to S10 are built, routed in `packages/shell/src/navigation/root-stack.tsx` and signed off against their Toybox frames (E11 to E13). `shell-slice.json` lists `"screens": ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10"]`.
- The settings data and its effects are in, but there is no Settings screen:
  - the settings store, reducer and selectors, with the eleven saved fields and their first-launch values (E04, E05);
  - the effects the composition root applies at boot (E07, E09): `app/localized-root.tsx` (language and digits), `theme/theme-provider.tsx` (theme and colour-blind colours), `app/use-reduce-motion.ts` and `app/use-reduce-motion-setting.ts`, `app/connect-audio-settings.ts` (sound and music), `app/create-shell-haptics.ts` (vibration) and `config/external-links.ts` (the store review page, the support mail, the privacy page and the licence texts: the one file allowed to hold URLs). Each has its test, except `theme-provider.tsx`, which has none;
  - the three files S11 lends to earlier screens: `screens/settings/settings-preference-actions.ts` with its test (with S5, E12), and `screens/settings/settings-resets.ts` with its test and `use-settings-resets.ts` (with S10, E13).
- The Shell core the S11 family uses is in (E09): the S14 dialog host with the `restart-to-apply` dialog and the hold-to-confirm `reset-progress` dialog, `app/dialog-context.tsx`, `app/read-version-text.ts`, `app/use-game-extra.ts`, `app/premium-screen-deps-context.tsx` and `testing/create-host-wrapper.tsx`; `art/credit-rows.ts` (E07); and from S2 (E11) `app/use-direction-restart.ts` and `app/use-parity-opener.ts`.
- `parity/` holds the pre-listed waivers (the S11b version-chip gap among them), the sign-off ledger with the S1 to S10 entries, and `game-facts.json` (Line Siege: `hasMusic: false`, `winLine: "score"`, `hasHints: false`). The parity routine of E11 is in place: the pinned parity tooling in `.parity/tooling`, a Release test build installed on this session's own parity simulator, `run-parity.mjs`, the sheets and `check-signoff.mjs`.
- `apps/line-siege/src/art/game-art.ts` has `const CREDITS: readonly CreditEntry[] = [];`: Line Siege's six sounds are synthesised in code, so it has no credits of its own.

Not there yet:

- The S11 model files: `screens/settings/settings-rows.ts`, `use-settings-model.ts`, `use-settings-context.ts`, `use-display-settings.ts`, and `game-host/use-hints-during-play.ts`.
- The S11 screen (view, rows, footer, extras hooks and route file) and the four sub-page folders `screens/settings/language/`, `about/`, `privacy/` and `licences/`.
- `packages/shell/src/app/shell-app.test.tsx`, the one composition-root test deferred from Shell step 7 because it renders Settings.
- Real screens on the routes `Settings`, `SettingsLanguage`, `About`, `PrivacyPolicy` and `Licences`: they still show `NotBuiltScreen`, so Home's gear key opens the stand-in.

Checks at the start:

- `npm run verify` is green and ends `verify: 11 steps passed, 1 with SKIP lines` (knip's `[knip-exports]` line while `shell-slice.json` exists).
- `node skills/game-host-integration/scripts/check-game-host.mjs . --game line-siege` passes with `SKIP packages/shell/src/app/shell-app.test.tsx [root-file-missing] S11 not in shell-slice.json`.
- `node skills/navigation-and-routing/scripts/check-navigation.mjs .` passes with `[route-not-built]` SKIP lines for the routes of S11 to S15. `node skills/toybox-visual-parity/scripts/check-harness.mjs .` passes with `[harness-opener]` SKIP lines that include S11's `reset-progress-dialog-held` and S11a's `restart-dialog`.
- `node skills/settings-and-preferences/scripts/check-settings.mjs .` prints `RESULT: PASS` with SKIP lines that name only S11 (the S11 rows, their toggle feedback and the `resetAllProgress` write); E13 made the `resetStatistics` rule strict. `node skills/toybox-screens/scripts/check-screens.mjs . --all` prints `RESULT: PASS` for S1 to S10, with SKIP lines for S11 to S15.

## What we will do

This is the Settings part of Shell step 9. Each screen is built from its Toybox screen spec, routed in place of its stand-in, added to `shell-slice.json` in the same commit, and matched to its design frame before its task is done.

- **The settings model first (T01).** Which rows show, one action per row, the toggle sound and pulse after each switch, and the hook the game host uses to read "Hints during play". Each setting already has its effect outside Settings; this task proves each one changes what the player sees, at once.
- **S11 Settings (T02).** Seven groups (Language, Sound and feel, Display, Premium, Privacy, Data, About) and the footer. Line Siege has no music, so the Music rows are hidden and the screen is matched to the design's `s11-settings--no-music` variant (L1). The footer's "Version 1.0.0 (8)" is one text run (L5). The composition root's own test, `shell-app.test.tsx`, lands here, because it renders Settings through the real providers.
- **S11a Language (T03).** System and the four languages, each name in its own script. The text switches at once; a choice that flips the direction saves first, then opens "Restart to apply".
- **S11b About and credits, S11c Privacy policy, S11d Licences (T04 to T06).** All work offline: the privacy text is bundled, Contact hands the address to the phone's mail app, and "Show licence text" hands the licence page to the browser (the phone does that, not our code).
- **Gates and close (T07, T08).** Every settings, screen, parity and wiring check passes; then `/simplify`, `/code-review`, the evidence report and the merge.

Not in this epic:

- S12 Premium (until then the Remove ads row opens its stand-in), S13 How to play, S15 Debug, and the S14 dialog frames `s14-reset-all-progress` and `s14-restart-to-apply`. Their dialogs and parity openers work from this epic on, but they are signed off with S14: E15.
- The language-switch E2E flow (a real restart into right to left) and the airplane-mode run through Settings (15.2): E16.
- The privacy-policy web page that carries the same text (spec 4.2 point 4) and `app-ads.txt`: the later store-pages step.
- The de and ckb parity captures: added before the release (E17).
- Owner step G3 (the real support address): until then S11b, S11c and Contact show `support@example.com`. Owner step G2 (the App Store record): until then "Rate this game" does nothing, by design (`storeReviewUrl` is null without an App Store id). Neither blocks a task.

## Final state

- [ ] The settings model and every effect are proven: `npx jest packages/shell/src/stores packages/shell/src/screens/settings packages/shell/src/app packages/shell/src/theme packages/shell/src/game-host/use-hints-during-play.test.tsx --ci --selectProjects unit` passes, and `node skills/settings-and-preferences/scripts/check-settings.mjs .` prints `RESULT: PASS` with no SKIP line (the eleven fields and their defaults, one action per row, an effect for every field, resets that keep settings and Premium, the toggle feedback, one writer).
- [ ] The five screens are built and routed: `shell-slice.json` lists S1 to S11 and S11a to S11d; `node skills/toybox-screens/scripts/check-screens.mjs . --screen S11 --screen S11a --screen S11b --screen S11c --screen S11d` prints `RESULT: PASS`, and `node skills/toybox-screens/scripts/check-screens.mjs . --all` prints `RESULT: PASS` with SKIP lines only for S12 to S15; `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS` and its SKIP lines name only S12 to S15.
- [ ] Every frame matches its design: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11 --screen S11a --screen S11b --screen S11c --screen S11d` prints `RESULT: PASS` for light and dark × en and fa at every planned scroll offset. It names `s11-settings--no-music` as S11's reference, the pre-listed `about.version-chip` waivers of S11b, and the intended reference changes L1, L5, O5 and R3S-G17e. `parity/signoff.json` holds one entry per run.
- [ ] The composition root's test runs through the real providers: `npx jest packages/shell/src/app/shell-app.test.tsx --ci --selectProjects unit` passes, and `node skills/game-host-integration/scripts/check-game-host.mjs . --game line-siege` prints `RESULT: PASS` with no `[root-file-missing]` line.
- [ ] The parity openers of S11 and S11a are wired: `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS` with no line for `reset-progress-dialog-held` or `restart-dialog`.
- [ ] Settings stays offline and within the ads and Premium rules: `node skills/admob-ads/scripts/check-ads.mjs .` and `node skills/premium-purchase/scripts/check-premium.mjs .` print `RESULT: PASS` (no banner on S11 to S11d, no typed price); `grep -rnE --exclude='*.test.ts' --exclude='*.test.tsx' "https?://|WebView" packages/shell/src/screens/settings` prints nothing.
- [ ] Every text exists in all four languages: `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S11 --screen S11a --screen S11b --screen S11c --screen S11d` and `node skills/i18n-strings-and-catalogs/scripts/check-catalogs.mjs .` print `RESULT: PASS`, and `npm run i18n:verify` passes.
- [ ] `npx tsc --noEmit -p packages/shell`, `npm run -s check:fast` and `npm run test:coverage` are green, and `npm run verify` ends `verify: 11 steps passed, 1 with SKIP lines` (only knip's `[knip-exports]` line while `shell-slice.json` exists).
- [ ] The slice report passes: `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e14-settings-pages.md --kind slice` prints `RESULT: PASS`.

## Skills to load

Always: `pocket-arcade-index`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`.

For this epic:

- `pocket-arcade-product-spec`: prints the exact spec lines (S11 to S11d, 4.2, 7.2, 7.3, 7.6, 8.7, 8.11, 8.12, N6, N9) for the first test titles, commit bodies and the report, and `check-spec-refs`.
- `settings-and-preferences`: the rows, their visibility, the model and context hooks, the hints hook, `language-change.ts`, the effects table and `check-settings`.
- `toybox-screens`: the S11 to S11d specs, templates, testIDs and copy keys, `list-screen` and `check-screens`.
- `toybox-visual-parity`: the parity loop (build install, `run-parity`, sheets, ledger), the no-music reference variant, the pre-listed S11b waivers, `check-harness` and `check-signoff`.
- `toybox-components`: the `sound-group` example and its test, and the ListGroup, ListRow, SegmentedControl, SubRow, Slider, NotePanel, Chip and QuietButton calls the screens make; `check-components`.
- `toybox-design-system`: the theme provider's effect test, the type roles the pages use (`optionNameList`, `gameNameAbout`, `prose`), tokens; `check-design-system`.
- `state-stores`: `use-display-settings.ts` (a `useShallow` selector) and its new test; `check-stores` and `check-reducers`.
- `save-persistence-and-migrations`: every setting is written through the one save writer before it shows; resets keep settings and Premium; `check-save-layer`.
- `i18n-strings-and-catalogs`: the copy keys of the five screens in four languages, `t()` isolates in test expectations, `i18n:verify`, `check-catalogs` and `check-i18n-code`.
- `rtl-and-direction`: the direction restart on S11a, autonyms in their own script, the privacy date without nested isolates, the Licences name and version kept left to right; `check-rtl`.
- `accessibility`: switch, radio and adjustable roles, 44 pt rows, the `findInaccessiblePressables` audit in every view test, contrast of the danger rows; `check-a11y-code` and `check-contrast`.
- `react-components-and-hooks`: model hooks with synchronous handlers, no `useMemo`, selectors; `check-react-rules`.
- `navigation-and-routing`: the five routes in `root-stack.tsx` in place of `NotBuiltScreen`; `check-navigation`.
- `game-host-integration`: `shell-app.test.tsx`, `useGameHost()` facts (`hasMusic`, `logo`, `nameId`, `credits`), `createHostWrapper`; `check-game-host`.
- `admob-ads`: the Ad privacy choices row (Google's privacy options, shown only where required) and no banner on S11 to S11d; `check-ads` and `check-ad-behaviour`.
- `premium-purchase`: the Remove ads row with the store's price, "Premium – active" for owners, Restore purchase; `check-premium` and `check-premium-behaviour`.
- `game-audio-and-haptics`: the toggle feedback (`ui.toggle` with the selection pulse), the audio and haptics effects; `check-audio-haptics`.
- `daily-and-statistics`: Reset statistics and Reset all progress reach the S10 statistics and the daily data; `check-daily-stats`.
- `code-drawn-art-and-icons`: the row icons (the hollow rating star), the S11b logo tile, `GAME_ART.credits` on S11d; `check-icons-and-logos`.
- `ios-simulator-build`: the Release test build that every parity capture installs.
- `unit-and-component-tests`: `renderWithShell`, `createShellWrapper`, fakes and mocks; `check-test-setup` and `check-test-code`.
- `typescript-and-lint-rules`: strict types and size limits of the copied files; `check-source` and `check-configs`.
- `naming-conventions`: file, export and testID names; `check-file-names` and `check-code-names`.
- `troubleshooting-playbook`: `find-fix` on a failing build or capture log, and `check-known-pitfalls`.

## How we work in this epic

1. Branch: `git switch main && git pull && git switch -c epic/e14-settings-pages`. Push the branch after each task (`git push -u origin epic/e14-settings-pages`), but only once the owner has given the word to push in this session (git-commits-and-reporting rule 5). Without it, the commits stay local and the report says so. Never bypass the pre-push hook.
2. Test first, always. Write each task's "Tests first" items, run them and watch them fail for the right reason, write the minimum code to pass, then refactor. Never weaken or edit a test to make it pass.
3. Commit each task in Conventional Commits form, with the trailers the skills ask for (Gate-Change:, Spec-Change:). `npm run -s check:fast` must be green before every commit.
4. Screens: a task that builds or changes a screen is not done until toybox-visual-parity's capture matches the Toybox design screenshot for every frame it names, in light-en, light-fa, dark-en and dark-fa at every scroll offset, and check-signoff passes for those frames.
5. Stop and ask the owner only at a step marked **Owner**.

## Tasks

### E14-T01 · Settings model, rows and effects

- **Goal:** One model feeds the S11 screen. It shows only the rows that apply: Music only for a game with music, Vibration only on a phone that vibrates, Ad privacy choices only where Google's privacy options are required, Remove ads only for players without Premium (settings-and-preferences rule 5). Each row has exactly one action. Each switch plays the toggle sound and pulse once, after its change is saved. The Reduce motion row shows the saved choice even while a parity capture holds all motion still. Every setting changes something outside Settings at once (spec S11: "Every change applies immediately"; settings-and-preferences rule 4). That includes "Hints during play", which the game host reads through `useHintsDuringPlay()`.
- **Skills:** `settings-and-preferences`, `state-stores`, `game-host-integration`, `game-audio-and-haptics`, `toybox-design-system`, `rtl-and-direction`, `i18n-strings-and-catalogs`, `save-persistence-and-migrations`, `react-components-and-hooks`, `unit-and-component-tests`, `pocket-arcade-product-spec`.
- **Tests first:** First run `node skills/settings-and-preferences/scripts/check-settings.mjs .` and keep its output as the baseline: `RESULT: PASS` with SKIP lines that name only S11. This epic removes every one of them. Then copy each test before its module. Give each module a typed stub (same exports, wrong values: `settingsGroupsFor` returns `[]`, `useHintsDuringPlay` returns `false`, and so on), so the red run is an assertion diff and never `Cannot find module`. Run `npx jest packages/shell/src/screens/settings packages/shell/src/game-host/use-hints-during-play.test.tsx packages/shell/src/theme --ci --selectProjects unit` and keep the red lines. The tests:
  - `packages/shell/src/screens/settings/settings-rows.test.ts` (settings-and-preferences template; unit). `settingsGroupsFor`:
    - lists the seven groups in S11 order;
    - shows every row when everything applies;
    - hides Music and its volume row for a game without music (L1);
    - hides Vibration on a phone without haptics;
    - shows Ad privacy choices only where privacy options are required;
    - swaps Remove ads for "Premium – active" and keeps Restore purchase for owners;
    - gives every row a kebab-case `settings.*` testID.
  - `packages/shell/src/screens/settings/use-settings-context.test.tsx` (template; hook): the Music rows follow the game host (`useGameHost().hasMusic`) and Vibration follows the phone's haptics.
  - `packages/shell/src/screens/settings/use-settings-model.test.tsx` (template; hook):
    - the Language row reads "System (English)" while the language follows the phone, and the autonym once one is chosen;
    - the Local digits preview is Persian in Persian (spec 7.3);
    - a dispatched change shows on the next render;
    - a switch plays `ui.toggle` and the `selection` pulse once, after its dispatch;
    - Reduce motion writes the opposite of what it shows;
    - the row shows the saved choice while a parity capture freezes motion.
  - `packages/shell/src/game-host/use-hints-during-play.test.tsx` (template; hook): follows the saved setting and each change of it.
  - `packages/shell/src/screens/settings/use-display-settings.test.tsx` (new, because state-stores ships the hook without a test; hook, through `createShellWrapper({ settings: { theme: 'dark', colorBlind: true } })` from `testing/render-with-shell.tsx`):
    - returns the seeded theme, colour-blind and reduce-motion values;
    - returns the new theme after a `set-theme` dispatch;
    - returns the same object when an unrelated setting (the sound volume) changes, which is what the `useShallow` selector is for.
  - `packages/shell/src/theme/theme-provider.test.tsx` (new, because the provider landed in E07 without a test; component, a probe that prints `useTheme().key`): the theme follows `set-theme` and `set-color-blind` at once (the key goes from `standard.light` to `colorBlind.dark` after both), and `system` follows the phone's colour scheme. The provider already exists, so first prove the test can fail: run it once with the provider's `useSettingsStore(selectThemePreference)` read temporarily replaced by `'light'` (never committed), keep that red line, restore the file and see the test pass.
  - Re-run the effect tests that landed with the composition root. They must stay green, and they are this task's evidence for settings-and-preferences rule 4:
    - `app/localized-root.test.tsx`: language and digits switch at once;
    - `app/connect-audio-settings.test.ts`: the saved percent becomes volume / 100, and switching Music off stops the music;
    - `app/create-shell-haptics.test.ts`: Vibration off stops the next pulse;
    - `app/use-reduce-motion.test.ts` and `app/use-reduce-motion-setting.test.ts`;
    - `stores/settings-selectors.test.ts`: the eleven first-launch values (music off, System everywhere);
    - `screens/settings/settings-preference-actions.test.ts`: each handler dispatches its one action.
- **Build:**
  1. Copy S11's manifest entry, settings-and-preferences part, over the stubs: `templates/settings-rows.ts`, `use-settings-model.ts` and `use-settings-context.ts` into `packages/shell/src/screens/settings/`, and `templates/use-hints-during-play.ts` into `packages/shell/src/game-host/`. Never copy `settings-preference-actions.ts`, `settings-resets.ts` or `use-settings-resets.ts` again: they are in since E12 and E13.
  2. Copy S11's manifest entry, state-stores part: `examples/use-display-settings.ts` to `packages/shell/src/screens/settings/use-display-settings.ts`. Nothing in the app imports it yet; it stays because the build-order manifest lists it.
  3. Change no default and no save field: the defaults are spec 8.7 and settings-and-preferences rule 2 (music off, so the game never plays over the player's own music).
  4. Line Siege has no hint key (`hasHints: false`) and no tips during play, so "Hints during play" changes nothing a Line Siege player can see; its reader is `useHintsDuringPlay()`. Do not invent a consumer. The report lists this under "Not tested or not verified".
  5. Commit `feat(shell): add the settings model, rows and their effects`, with spec lines S11, 8.7 and 8.11 in the body (`node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs S11 8.7 8.11`). Before committing, run `node skills/tdd-workflow/scripts/check-test-edits.mjs . --staged --message reports/commit-message.txt` and `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged`.
- **Done when:**
  - `npx jest packages/shell/src/stores packages/shell/src/screens/settings packages/shell/src/app packages/shell/src/theme packages/shell/src/game-host/use-hints-during-play.test.tsx --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/screens/settings/**/*.ts' --coverageThreshold='{}'` passes.
  - `node skills/settings-and-preferences/scripts/check-settings.mjs .` prints `RESULT: PASS`, and its only SKIP lines say `S11 not in shell-slice.json` (S11 joins the slice in T02).
  - These print `RESULT: PASS`: `node skills/state-stores/scripts/check-stores.mjs .`, `node skills/state-stores/scripts/check-reducers.mjs .`, `node skills/react-components-and-hooks/scripts/check-react-rules.mjs .` and `node skills/tdd-workflow/scripts/check-tests.mjs .`.
  - `npm run -s check:fast` is green, and `git push -u origin epic/e14-settings-pages` passes the pre-push hook.

### E14-T02 · S11 Settings screen

- **Goal:** Home's gear key opens Settings. The player sees the seven groups and the footer exactly as the Toybox design draws them for a game without music (L1, spec S11):
  - LANGUAGE: Language (opens S11a) and Numbers with live previews;
  - SOUND AND FEEL: Sound effects with its volume, and Vibration;
  - DISPLAY: Theme, Colour-blind friendly colours, Reduce motion and Hints during play;
  - PREMIUM: "Remove ads – €1.99" with the store's price ("Remove ads" before the store answers), or "Premium – active" for owners; Restore purchase;
  - PRIVACY: Ad privacy choices (only where required) and Privacy policy;
  - DATA: Reset statistics (confirm) and Reset all progress (confirm by holding 2 seconds); both keep Premium, the language and the settings;
  - ABOUT: About and credits, Licences, Rate this game and Contact support, through `config/external-links.ts`;
  - the footer: "Changes apply right away." and "Version 1.0.0 (8)" as one text run (L5).

  The composition root's test joins, rendering Settings through the real providers.
- **Skills:** `toybox-screens`, `settings-and-preferences`, `toybox-components`, `toybox-design-system`, `toybox-visual-parity`, `game-host-integration`, `navigation-and-routing`, `premium-purchase`, `admob-ads`, `daily-and-statistics`, `save-persistence-and-migrations`, `game-audio-and-haptics`, `code-drawn-art-and-icons`, `accessibility`, `i18n-strings-and-catalogs`, `ios-simulator-build`, `troubleshooting-playbook`, `unit-and-component-tests`.
- **Tests first:** Print the contract and look at the design first:
  - `node skills/toybox-screens/scripts/list-screen.mjs S11` and `node skills/toybox-visual-parity/scripts/check-testids.mjs --list S11`;
  - read `skills/toybox-screens/references/s11-settings.md`;
  - open `skills/toybox-visual-parity/assets/reference/lineSiege/light-en/s11-settings--no-music.png` and `.../dark-fa/s11-settings--no-music.png`.

  Then copy each test before its module, with typed stubs (`SettingsView` and `SoundGroup` return `null`; the extras and links hooks return no-op handlers and a wrong version text). Run `npx jest packages/shell/src/screens/settings packages/shell/src/app/shell-app.test.tsx --ci --selectProjects unit` and keep the red lines. The tests:
  - `packages/shell/src/screens/settings/settings-view.test.tsx` (toybox-screens template; component). Every block ends with `findInaccessiblePressables` returning `[]`. It proves:
    - every S11 group and row has its design testID, and the Remove ads label reads "Remove ads – €1.99";
    - the autosave note row is measured whole, the footer lines are as wide as their text, and Remove ads is Bold;
    - rows that do not apply are hidden, and owners see "Premium – active" with Restore purchase;
    - each change dispatches one settings action (Theme Dark, Hints) and the Language row opens S11a;
    - keys and rows play the tap, a switch plays only the toggle feedback;
    - the 0..1 slider becomes an integer percent (80 % shown; VoiceOver's increment sends 90).
  - Add one case to `settings-view.test.tsx` for L5: "writes the version as one text run (spec S11, L5)". `settings.version` is a single text whose content is `` `Version ${isolate('1.0.0 (8)')}` `` (`isolate` from `@e07/shell/i18n/bidi.ts`, because `t()` isolates `…Text` values), with no nested text element.
  - `packages/shell/src/screens/settings/use-settings-extras.test.tsx` (template; hook):
    - the version carries its build number, and there is no price before the store answers;
    - every sub-screen opens through navigation (`SettingsLanguage`, `About`, `Licences`, `PrivacyPolicy`, `Premium`);
    - Restore purchase calls the Premium service, and Ad privacy choices reopens Google's privacy options;
    - each reset asks first in an S14 dialog, then reaches the stores (Reset all progress through the 2-second hold; settings and Premium kept);
    - in the `s14-reset-all-progress` parity frame the reset dialog opens once, with the hold frozen at 46 %.
  - `packages/shell/src/screens/settings/use-settings-links.test.tsx` (template; hook): Rate hands the App Store review page to the phone and Contact the mail app with the address and the version; Rate does nothing before the game has an App Store id.
  - `packages/shell/src/screens/settings/settings-row-specs.test.ts` (template; unit): Rate this game draws the hollow rating star (`rating-star-hollow`, the design's `star(false)`).
  - `packages/shell/src/screens/settings/sound-group.test.tsx` (toybox-components example; component): the whole row is the switch and every control can be reached; the volume moves in 10 % steps and its fill turns grey while the sound is off.
  - `packages/shell/src/app/shell-app.test.tsx` (game-host-integration template; integration through the real providers):
    - renders Settings with the host, Premium, dialogs, services and stores;
    - opens the tutorial level on a first launch;
    - shows the crash screen, whose Back to Home restarts at Home.

    Before the route change, the Settings case fails because `settings.screen` is not found (the stand-in shows): that is the right red.
- **Build:**
  1. Copy the rest of S11's manifest entry over the stubs:
     - from toybox-screens' `templates/packages/shell/src/screens/settings/` (the files directly in that folder): `settings-choice-row.tsx`, `settings-extras.ts`, `settings-footer.tsx`, `settings-row-bindings.ts`, `settings-row-specs.ts`, `settings-row.tsx`, `settings-screen.tsx`, `settings-view.tsx`, `settings-volume-row.tsx`, `use-settings-extras.ts`, `use-settings-links.ts` and `use-settings-routes.ts`;
     - from toybox-components: `examples/sound-group.tsx` to `packages/shell/src/screens/settings/sound-group.tsx`;
     - from game-host-integration: `templates/packages/shell/src/app/shell-app.test.tsx`.

     The settings-and-preferences and state-stores parts landed in T01. `app/read-version-text.ts` and `config/external-links.ts` are Shell core since E09.
  2. Route it: in `packages/shell/src/navigation/root-stack.tsx`, replace the `Settings` route's `NotBuiltScreen` with `SettingsScreen` from `@e07/shell/screens/settings/settings-screen.tsx`. The route file stays `const model = useSettingsModel(useSettingsContext()); const extras = useSettingsExtras();`.
  3. Add `"S11"` to `shell-slice.json` in the same commit. From then on `check-game-host` fails without `shell-app.test.tsx`, and `check-navigation` fails while Settings is on the stand-in.
  4. Keep the screen's rules:
     - no banner on S11 (spec 8.8);
     - no typed price: the price comes from the Premium store through `priceOf`;
     - no Save button, and no local copy of a setting;
     - row testIDs only from `SETTINGS_ROW_TEST_IDS`;
     - every handler synchronous, ending its promise with `.catch`.
  5. Unit gate: `npx jest packages/shell/src/screens/settings packages/shell/src/app --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/screens/settings/**/*.ts' --coverageThreshold='{}'` is green. Then fix every FAIL line until both `node skills/toybox-screens/scripts/check-screens.mjs . --screen S11` and `node skills/settings-and-preferences/scripts/check-settings.mjs .` print `RESULT: PASS`.
  6. The parity loop. T03 to T06 repeat it with their own screen id.
     1. Tooling and simulator, once per session. If `.parity/tooling` is missing, run `mkdir -p .parity/tooling && cp skills/toybox-visual-parity/scripts/package.json skills/toybox-visual-parity/scripts/package-lock.json .parity/tooling/ && npm ci --prefix .parity/tooling`. Then `node skills/toybox-visual-parity/scripts/selftest.mjs --tooling .parity/tooling` must print `RESULT: PASS`, and `node skills/toybox-visual-parity/scripts/setup-parity-sim.mjs --appearance light --name e07-parity-e14` prints this session's simulator UDID.
     2. Build and install the Release test build. Run `npm run build:ios:sim -- --app line-siege --variant test --ads off`, then `xcrun simctl install <parity udid> apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app`. After a JavaScript-only fix, swap the bundle instead of rebuilding (toybox-visual-parity `references/simulator-and-capture.md`, "Fast iteration after a JavaScript-only change"). Rebuild properly before the final captures. On a build failure, run `node skills/troubleshooting-playbook/scripts/find-fix.mjs --log apps/line-siege/build/logs/<step>.log`.
     3. Capture and check: `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen S11 --bundle-id io.applander.linesiege --name e07-parity-e14 --tooling .parity/tooling`. A tall frame at every offset in four variants takes several minutes, so run it in the background or with the longest timeout. The summary must name `s11-settings--no-music` as the reference.
     4. On FAIL, fix the app at the first failing rule of each run, in the printed order: screen reached, scroll, missing, bounds, text, fill, border, text-ink, structure. Open `crops/<testID>.png` in the run folder before changing code. Never touch a tolerance, mask or reference, and never force the Music rows on. Rebuild or swap the bundle, then capture again.
     5. On PASS, look. Read `sheet.png`, every `zoom-*.png` and every `eye-*.png` of every run, answer the seven eye checks, and fix every visible difference. For each run, `node skills/toybox-visual-parity/scripts/check-signoff.mjs --draft .parity/lineSiege/s11-settings/<theme>-<lang>[-y<offset>]` prints the ledger entry; add it to `parity/signoff.json` with the answers. A difference the app truly cannot fix becomes a waiver in `parity/waivers.json` with its class and reason, under the Owner rule below; that commit carries a `Gate-Change:` trailer.
     6. Run `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11` until it prints `RESULT: PASS`.
     7. When the session ends, shut down only this session's simulator: `xcrun simctl shutdown <parity udid>`.
  7. Commit `feat(shell): build the S11 Settings screen` with the screen files, the route, `shell-slice.json` and `parity/signoff.json`. The body names spec S11, 8.7, 8.11, 8.12, L1 and L5.
- **Design match:** frame `s11-settings`, compared with its design-derived reference `s11-settings--no-music`, which `parity/game-facts.json` picks because Line Siege has `hasMusic: false` (L1). It is a tall frame: every scroll offset `run-parity.mjs` plans, in light-en, light-fa, dark-en and dark-fa. Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11`. It lists the intended reference changes L1, L5 and O5 (the light `dangerFill` `#FFDCDF` of the danger rows).
- **Done when:**
  - `npx jest packages/shell/src/screens/settings packages/shell/src/app --ci --selectProjects unit` passes, `shell-app.test.tsx` included.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S11` prints `RESULT: PASS` (testIDs exact, copy keys, no banner, the hollow Rate star, the borrowed files present), and `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S11` prints `RESULT: PASS` (every S11 text in four languages).
  - `node skills/settings-and-preferences/scripts/check-settings.mjs .` prints `RESULT: PASS` with no `S11 not in shell-slice.json` line.
  - `node skills/game-host-integration/scripts/check-game-host.mjs . --game line-siege` prints `RESULT: PASS` with no `[root-file-missing]` line.
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS` with no `[route-not-built]` line for `Settings`. `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS` with no line for `reset-progress-dialog-held`.
  - These print `RESULT: PASS`: `node skills/game-audio-and-haptics/scripts/check-audio-haptics.mjs .`, `node skills/admob-ads/scripts/check-ads.mjs .` and `node skills/premium-purchase/scripts/check-premium.mjs .`.
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11` prints `RESULT: PASS`.
  - `npm run -s check:fast` is green, and the push passes the pre-push hook.
- **Owner:** Only if a parity failure survives three fixes (toybox-visual-parity rule 7), a difference seems to need a new waiver, or the design itself looks wrong. Claude sends one stop-and-ask message in git-commits-and-reporting's request form, with the dark-fa `sheet.png` and the proposed default, checked with `node skills/git-commits-and-reporting/scripts/check-report.mjs <request> --kind request`. Meanwhile it goes on with T03.

### E14-T03 · S11a Language

- **Goal:** The player picks System or one of the four languages. Each name is written in its own language and script, so someone stuck in the wrong language can find their own (spec 7.2, S11a). The text switches at once. A choice that flips the direction (for example English to Persian) saves first, then opens "Restart to apply". Restart disposes the audio and restarts in the new direction; Later keeps the old layout until the next launch. The save is untouched either way (spec S11 rules; settings-and-preferences rule 6).
- **Skills:** `toybox-screens`, `settings-and-preferences`, `rtl-and-direction`, `i18n-strings-and-catalogs`, `game-audio-and-haptics`, `navigation-and-routing`, `toybox-components`, `toybox-visual-parity`, `accessibility`, `ios-simulator-build`, `unit-and-component-tests`.
- **Tests first:** Print the contract (`node skills/toybox-screens/scripts/list-screen.mjs S11a`, `node skills/toybox-visual-parity/scripts/check-testids.mjs --list S11a`), read `skills/toybox-screens/references/s11a-language.md`, and open `skills/toybox-visual-parity/assets/reference/lineSiege/light-en/s11a-language.png` and `.../dark-fa/s11a-language.png`. Then copy each test before its module, with typed stubs (`planLanguageChange` always answers `needsRestart: false`; the view returns `null`). Run `npx jest packages/shell/src/screens/settings/language --ci --selectProjects unit` and keep the red lines:
  - `packages/shell/src/screens/settings/language/language-change.test.ts` (settings-and-preferences template; unit). `planLanguageChange`:
    - switches the text at once when the direction stays the same;
    - asks for a restart when the new language reads the other way;
    - resolves System against the phone before comparing directions.
  - `packages/shell/src/screens/settings/language/use-settings-language-model.test.tsx` (toybox-screens template; hook):
    - follows the phone as System, and saves a same-direction choice without a dialog;
    - opens Restart to apply when the direction flips, and calls `restartForDirection('rtl', …)` only on Restart;
    - opens the dialog in its parity frame without changing the saved language.
  - Add one case to that test, for the order the rules ask: "saves the new language before Restart to apply opens (spec S11)". The open-dialog mock reads `stores.settings.getState().settings.language` at the moment it is called and gets `'fa'`.
  - `packages/shell/src/screens/settings/language/language-view.test.tsx` (template; component): every S11a element with its testID (the System row with its description, the four autonym rows, the direction note); choosing a language, or System again, calls `onSelect`.
  - Add one case to the view test: "keeps every autonym in its own script in a Persian render (spec S11a)". Use `renderWithShell(<SettingsLanguageView model={…} />, { language: 'fa' })` with `selected: 'fa'`. The rows still read English, Deutsch, فارسی and کوردیی ناوەندی (never translated), the fa row's radio is checked, and `findInaccessiblePressables` returns `[]`.
  - Re-run as evidence (green since E11): `packages/shell/src/app/use-direction-restart.test.tsx`. It proves the audio is disposed first and the restart follows, and that a failed restart is logged, never thrown.
- **Build:**
  1. Copy S11a's manifest entry over the stubs: toybox-screens' `templates/packages/shell/src/screens/settings/language/` (`language-view.tsx`, `language-screen.tsx`, `use-settings-language-model.ts`), and settings-and-preferences' `templates/language-change.ts` to `packages/shell/src/screens/settings/language/language-change.ts`.
  2. Route `SettingsLanguage` to `SettingsLanguageScreen` in `root-stack.tsx`, and add `"S11a"` to `shell-slice.json` in the same commit.
  3. Keep the layout the spec draws: the list has no tab (the Toybox `List`); autonym rows pass `labelLanguage`, so `ListRow` draws them in the `optionNameList` role (18 Bold, own script and font) at the layout's start; the direction note is `NotePanel` with `iconTile="pop"`.
  4. `npx jest packages/shell/src/screens/settings/language --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/screens/settings/language/**/*.ts' --coverageThreshold='{}'` is green. Then run `node skills/toybox-screens/scripts/check-screens.mjs . --screen S11a` and `node skills/rtl-and-direction/scripts/check-rtl.mjs .` until both pass.
  5. The parity loop of T02 step 6, with `--screen S11a`; run folders are `.parity/lineSiege/s11a-language/<theme>-<lang>`. In fa the reference's System row names the render language ("سیستم (فارسی)"), a design fix (R3S-G17e) and not an app change.
  6. Commit `feat(shell): build the S11a language page with the direction restart`, with spec S11a, S11, 7.2 and N6 in the body.
- **Design match:** frame `s11a-language` (phone; its design fix R3S-G17e names the render language in the System row), in light-en, light-fa, dark-en and dark-fa. Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11a`. The dialog drawn over this page is the S14 frame `s14-restart-to-apply`, signed off with S14 in E15.
- **Done when:**
  - `npx jest packages/shell/src/screens/settings/language packages/shell/src/app/use-direction-restart.test.tsx --ci --selectProjects unit` passes.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S11a`, `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S11a` and `node skills/rtl-and-direction/scripts/check-rtl.mjs .` print `RESULT: PASS`.
  - `node skills/settings-and-preferences/scripts/check-settings.mjs .` prints `RESULT: PASS` with no SKIP line.
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS` with no `[route-not-built]` line for `SettingsLanguage`. `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS` with no line for `restart-dialog`.
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11a` prints `RESULT: PASS`.
  - `npm run -s check:fast` is green, and the push passes the pre-push hook.
- **Owner:** Only as in T02 (a parity failure that survives three fixes, a needed waiver, or a design question); meanwhile Claude goes on with T04.

### E14-T04 · S11b About and credits

- **Goal:** The About page names the game and its tagline, shows the version chip "Version 1.0.0 (8)", says "Made with Claude Code", that the game works fully offline with no account, and that all art is drawn in code (spec S11b, N9). It gives the support address, and its two links open the phone's mail app (address and version filled in) and the Licences page. Nothing on it goes online.
- **Skills:** `toybox-screens`, `settings-and-preferences`, `game-host-integration`, `code-drawn-art-and-icons`, `toybox-components`, `toybox-visual-parity`, `i18n-strings-and-catalogs`, `accessibility`, `ios-simulator-build`, `unit-and-component-tests`.
- **Tests first:** Print the contract (`node skills/toybox-screens/scripts/list-screen.mjs S11b`, `node skills/toybox-visual-parity/scripts/check-testids.mjs --list S11b`), read `skills/toybox-screens/references/s11b-about.md`, and open `skills/toybox-visual-parity/assets/reference/lineSiege/light-en/s11b-about-and-credits.png` and `.../dark-fa/s11b-about-and-credits.png`. Then copy each test before its module, with typed stubs. Run `npx jest packages/shell/src/screens/settings/about --ci --selectProjects unit` and keep the red lines:
  - `packages/shell/src/screens/settings/about/use-about-model.test.tsx` (template; hook, through `createHostWrapper` and the test game's `expo-constants`):
    - the game's name, tagline and logo come from the host;
    - the version "1.0.0 (8)" comes from `read-version-text`;
    - the support address comes from the game's config links;
    - Contact opens `mailto:support@example.com?subject=Support%201.0.0%20(8)`, and Licences navigates to `Licences`.
  - `packages/shell/src/screens/settings/about/about-view.test.tsx` (template; component): every S11b element with its design testID, and the Licences row opens Licences.
  - Add one case to the view test: "says Made with Claude Code and lists the three facts as plain rows (spec S11b)". `about.made-with-row.label` reads "Made with Claude Code". The three fact rows (`about.made-with-row`, `about.offline-row`, `about.art-sound-row`) have no `button` role (the screen map gives them none, and a chevron would promise a tap that does nothing), while `about.contact-row` and `about.licences-row` are buttons. `findInaccessiblePressables` returns `[]`.
- **Build:**
  1. Copy S11b's manifest entry over the stubs: toybox-screens' `templates/packages/shell/src/screens/settings/about/` (`about-facts.tsx`, `about-view.tsx`, `about-screen.tsx`, `use-about-model.ts`).
  2. Route `About` to `AboutScreen` in `root-stack.tsx`, and add `"S11b"` to `shell-slice.json` in the same commit.
  3. Keep the layout: the 92 pt cut `LogoTile` drawn from `useGameHost().logo` (code-drawn art, no image file); the game name in the `gameNameAbout` role; both lists are the Toybox `List` without a tab; facts without `end`, the two links with `end="chevron"`; the version chip as one text run, as in the copy deck.
  4. `npx jest packages/shell/src/screens/settings/about --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/screens/settings/about/**/*.ts' --coverageThreshold='{}'` is green, and `node skills/toybox-screens/scripts/check-screens.mjs . --screen S11b` prints `RESULT: PASS`.
  5. The parity loop of T02 step 6, with `--screen S11b`. In en, the three pre-listed design-artefact waivers on `about.version-chip` (rules bounds, text-ink and structure; the mockup draws "Version" and the number as two flex items 6 px apart) apply, so `parity/waivers.json` does not change. Every other difference is fixed in the app.
  6. Commit `feat(shell): build the S11b About and credits page`, with spec S11b and N9 in the body.
- **Design match:** frame `s11b-about-and-credits` (phone), in light-en, light-fa, dark-en and dark-fa, with the pre-listed `about.version-chip` waivers (en only). Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11b`.
- **Done when:**
  - `npx jest packages/shell/src/screens/settings/about --ci --selectProjects unit` passes.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S11b`, `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S11b` and `node skills/code-drawn-art-and-icons/scripts/check-icons-and-logos.mjs .` print `RESULT: PASS`.
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS` with no `[route-not-built]` line for `About`.
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11b` prints `RESULT: PASS` and lists the three `about.version-chip` waivers with their class.
  - `npm run -s check:fast` is green, and the push passes the pre-push hook.
- **Owner:** Only as in T02; meanwhile Claude goes on with T05.

### E14-T05 · S11c Privacy policy

- **Goal:** The privacy policy is readable offline inside Settings (spec S11c, 4.2 point 4). It shows the summary "In short: no accounts, and the game itself collects no data." and the five sections: the game, ads, purchase, phone backups, questions. Below them: "Last updated 27 Sep 2026", written in the chosen digits, and the support address. The text is bundled in all four languages (N6), with no web view, no URL and no banner.
- **Skills:** `toybox-screens`, `i18n-strings-and-catalogs`, `rtl-and-direction`, `game-host-integration`, `admob-ads`, `toybox-design-system`, `toybox-visual-parity`, `accessibility`, `ios-simulator-build`, `unit-and-component-tests`.
- **Tests first:** Print the contract (`node skills/toybox-screens/scripts/list-screen.mjs S11c`, `node skills/toybox-visual-parity/scripts/check-testids.mjs --list S11c`), read `skills/toybox-screens/references/s11c-privacy-policy.md`, and open `skills/toybox-visual-parity/assets/reference/lineSiege/light-en/s11c-privacy-policy.png` and `.../dark-fa/s11c-privacy-policy.png`. Then copy each test before its module, with typed stubs. Run `npx jest packages/shell/src/screens/settings/privacy --ci --selectProjects unit` and keep the red lines:
  - `packages/shell/src/screens/settings/privacy/use-privacy-policy-model.test.tsx` (template; hook):
    - fills the policy with the game's name, the support address and the date it last changed (`PRIVACY_POLICY_UPDATED`, 2026-09-27);
    - writes the date in the chosen digits;
    - keeps the date free of the formatter's isolates, so the sentence holds one isolate pair (a nested pair moved the Persian date).
  - `packages/shell/src/screens/settings/privacy/privacy-policy-view.test.tsx` (template; component): the summary, the five sections and the updated line, each with its design testID.
  - Add one case to the view test: "draws all five sections from the bundled Persian text (spec S11c, N6)". Use `renderWithShell(<PrivacyPolicyView model={…} />, { language: 'fa' })`. Each `privacy-policy.section.<id>.body` (game, ads, purchase, backup, contact) has text, and none shows its message id (`privacy.<id>.body`) in place of a text. `findInaccessiblePressables` returns `[]`.
  - The four languages: `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S11c` proves every S11c text (the summary, the five sections, the updated line) is in the catalogs in en, de, fa and ckb, equal to the deck; `npm run i18n:verify` and `node skills/i18n-strings-and-catalogs/scripts/check-catalogs.mjs .` pass. The texts came from the copy deck at Shell step 6, so these pass at once and are evidence, not a red.
- **Build:**
  1. Copy S11c's manifest entry over the stubs: toybox-screens' `templates/packages/shell/src/screens/settings/privacy/` (`privacy-policy-view.tsx`, `privacy-policy-screen.tsx`, `use-privacy-policy-model.ts`).
  2. Route `PrivacyPolicy` to `PrivacyPolicyScreen` in `root-stack.tsx`, and add `"S11c"` to `shell-slice.json` in the same commit.
  3. Keep the layout: body gap 18 in a scrolling body; the gold 52 pt `ArtTile` with `shield`; headings 21; paragraphs in the `prose` role; the date through `stripIsolates` before it becomes `{dateText}`. `PRIVACY_POLICY_UPDATED` changes only together with the `privacy.*` texts.
  4. Prove it stays offline: `grep -rnE --exclude='*.test.ts' --exclude='*.test.tsx' "WebView|https?://|Linking" packages/shell/src/screens/settings/privacy` prints nothing.
  5. `npx jest packages/shell/src/screens/settings/privacy --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/screens/settings/privacy/**/*.ts' --coverageThreshold='{}'` is green, and `node skills/toybox-screens/scripts/check-screens.mjs . --screen S11c` prints `RESULT: PASS`.
  6. The parity loop of T02 step 6, with `--screen S11c` (a tall frame: every planned scroll offset).
  7. Commit `feat(shell): build the S11c offline privacy policy`, with spec S11c and 4.2 in the body.
- **Design match:** frame `s11c-privacy-policy` (tall: every scroll offset `run-parity.mjs` plans), in light-en, light-fa, dark-en and dark-fa. Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11c`.
- **Done when:**
  - `npx jest packages/shell/src/screens/settings/privacy --ci --selectProjects unit` passes.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S11c`, `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S11c`, `node skills/rtl-and-direction/scripts/check-rtl.mjs .`, `node skills/i18n-strings-and-catalogs/scripts/check-catalogs.mjs .` and `node skills/admob-ads/scripts/check-ads.mjs .` print `RESULT: PASS`, and `npm run i18n:verify` passes.
  - The grep in Build step 4 prints nothing.
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS` with no `[route-not-built]` line for `PrivacyPolicy`.
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11c` prints `RESULT: PASS`.
  - `npm run -s check:fast` is green, and the push passes the pre-push hook.
- **Owner:** Only as in T02; meanwhile Claude goes on with T06.

### E14-T06 · S11d Licences

- **Goal:** The Licences page lists, in four groups (spec S11d, 7.6, N9):
  - Fonts: Vazirmatn 33.003 with its description and "Show licence text", then Lilita One and Rubik, all under the SIL Open Font License 1.1;
  - Open-source software: nine components;
  - Ads and purchase: three components;
  - Sounds: "Game sound effects – Made in code for this game".

  The game's own `GAME_ART.credits` follow the Shell's rows. Line Siege has none, so there is no CC0 row until a game adds one. Names and licences are never translated. A row's licence text opens in the browser through `licenceTextUrl`: the phone does that, not our code (N3).
- **Skills:** `toybox-screens`, `code-drawn-art-and-icons`, `settings-and-preferences`, `game-host-integration`, `i18n-strings-and-catalogs`, `rtl-and-direction`, `toybox-components`, `toybox-visual-parity`, `accessibility`, `ios-simulator-build`, `unit-and-component-tests`.
- **Tests first:** Print the contract (`node skills/toybox-screens/scripts/list-screen.mjs S11d`, `node skills/toybox-visual-parity/scripts/check-testids.mjs --list S11d`), read `skills/toybox-screens/references/s11d-licences.md`, and open `skills/toybox-visual-parity/assets/reference/lineSiege/light-en/s11d-licences.png` and `.../dark-fa/s11d-licences.png`. Then copy each test before its module, with typed stubs (`shellLicenceEntries` returns `[]`). Run `npx jest packages/shell/src/screens/settings/licences --ci --selectProjects unit` and keep the red lines:
  - `packages/shell/src/screens/settings/licences/use-licences-model.test.tsx` (template; hook): lists the Shell's rows first, then the game's own credits; hands the opened row's licence text to the browser, and nothing for a row without one.
  - `packages/shell/src/screens/settings/licences/licences-view.test.tsx` (template; component): every S11d group and row with its design testID; a licence text opens from its row and from the "Show licence text" nudge.
  - `packages/shell/src/screens/settings/licences/licence-entries.test.ts` (new, because toybox-screens ships this pure list without a test of its own; unit, with pinned exact values). It proves (spec 7.6, S11d, N9):
    - the groups come in the order fonts, software, ads-store, sounds;
    - Vazirmatn has version `33.003`, the `SIL Open Font License 1.1` and a description;
    - Lilita One and Rubik have the same licence and no version (the design names them without one);
    - the nine software rows and the three ads-and-purchase rows have their keys and licences;
    - there is exactly one sounds row, `game-sounds`;
    - every key is kebab-case and unique.
  - Evidence that Line Siege adds no row: `grep -n "const CREDITS" apps/line-siege/src/art/game-art.ts` prints `const CREDITS: readonly CreditEntry[] = [];`. A CC0 sound would add its row through `creditRowsOf`, which `packages/shell/src/art/credit-rows.test.ts` (E07) proves; run it again here.
- **Build:**
  1. Copy S11d's manifest entry over the stubs: toybox-screens' `templates/packages/shell/src/screens/settings/licences/` (`licence-entries.ts`, `licences-view.tsx`, `licences-screen.tsx`, `use-licences-model.ts`).
  2. Route `Licences` to `LicencesScreen` in `root-stack.tsx`, and add `"S11d"` to `shell-slice.json` in the same commit.
  3. Keep the layout:
     - the Vazirmatn row is a column, with its licence line and the centred "Show licence text" `QuietButton` in the row's `textExtra` slot, never in `below` (that adds 12 pt per row and breaks the tall frame's scroll offsets);
     - the name and version are Bold and kept left to right;
     - the other rows show the name Bold (`isStrong`), the licence as the description, and a chevron.
  4. `npx jest packages/shell/src/screens/settings/licences packages/shell/src/art/credit-rows.test.ts --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/screens/settings/licences/**/*.ts' --coverageThreshold='{}'` is green, and `node skills/toybox-screens/scripts/check-screens.mjs . --screen S11d` prints `RESULT: PASS`.
  5. The parity loop of T02 step 6, with `--screen S11d` (a tall frame: every planned scroll offset).
  6. Commit `feat(shell): build the S11d licences page`, with spec S11d, 7.6 and N9 in the body.
- **Design match:** frame `s11d-licences` (tall: every scroll offset `run-parity.mjs` plans), in light-en, light-fa, dark-en and dark-fa. Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11d`.
- **Done when:**
  - `npx jest packages/shell/src/screens/settings/licences packages/shell/src/art/credit-rows.test.ts --ci --selectProjects unit` passes.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S11d`, `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S11d`, `node skills/code-drawn-art-and-icons/scripts/check-icons-and-logos.mjs .` and `node skills/rtl-and-direction/scripts/check-rtl.mjs .` print `RESULT: PASS`.
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS` with no `[route-not-built]` line for `Licences`.
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11d` prints `RESULT: PASS`.
  - `npm run -s check:fast` is green, and the push passes the pre-push hook.
- **Owner:** Only as in T02; meanwhile Claude goes on with T07's checks that do not depend on it.

### E14-T07 · Gates for Settings and its pages

- **Goal:** Every check that S11 to S11d own passes at once on the branch, and nothing built before them moved: Settings is complete for Shell step 9.
- **Skills:** `settings-and-preferences`, `toybox-screens`, `toybox-visual-parity`, `game-host-integration`, `navigation-and-routing`, `state-stores`, `save-persistence-and-migrations`, `rtl-and-direction`, `i18n-strings-and-catalogs`, `react-components-and-hooks`, `toybox-components`, `toybox-design-system`, `accessibility`, `premium-purchase`, `admob-ads`, `game-audio-and-haptics`, `daily-and-statistics`, `code-drawn-art-and-icons`, `unit-and-component-tests`, `typescript-and-lint-rules`, `naming-conventions`, `pocket-arcade-product-spec`, `troubleshooting-playbook`, `quality-gates`, `tdd-workflow`.
- **Tests first:** Nothing new: the checks are this task's tests. A red check first becomes a failing Jest test in the layer that owns the cause (the model, the view or the route), and only then gets its fix. If a fix changes a screen, run that screen's parity loop again (T02 step 6) and re-sign its frames.
- **Build:** Run every command below from the repo root and fix in the code, never in a gate, a tolerance or a reference. On an unexplained failure, run `node skills/troubleshooting-playbook/scripts/find-fix.mjs --text "<the error line>"`.
- **Done when:**
  - Types and tests: `npx tsc --noEmit -p packages/shell`, `npm run -s check:fast` and `npm run test:coverage` are green, and `npm run i18n:verify` passes.
  - These print `RESULT: PASS` with no SKIP line:
    - `node skills/settings-and-preferences/scripts/check-settings.mjs .`
    - `node skills/state-stores/scripts/check-stores.mjs .`
    - `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .`
    - `node skills/rtl-and-direction/scripts/check-rtl.mjs .`
    - `node skills/i18n-strings-and-catalogs/scripts/check-i18n-code.mjs .`
    - `node skills/react-components-and-hooks/scripts/check-react-rules.mjs .`
    - `node skills/toybox-components/scripts/check-components.mjs .`
    - `node skills/accessibility/scripts/check-contrast.mjs .`
  - These print `RESULT: PASS`:
    - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S11 --screen S11a --screen S11b --screen S11c --screen S11d`
    - `node skills/game-host-integration/scripts/check-game-host.mjs . --game line-siege`, with no `[root-file-missing]` line
    - `node skills/state-stores/scripts/check-reducers.mjs .`
    - `node skills/i18n-strings-and-catalogs/scripts/check-catalogs.mjs .` and `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S11 --screen S11a --screen S11b --screen S11c --screen S11d`
    - `node skills/accessibility/scripts/check-a11y-code.mjs .`
    - `node skills/premium-purchase/scripts/check-premium.mjs .` and `node skills/premium-purchase/scripts/check-premium-behaviour.mjs .`
    - `node skills/admob-ads/scripts/check-ads.mjs .` and `node skills/admob-ads/scripts/check-ad-behaviour.mjs .`
    - `node skills/game-audio-and-haptics/scripts/check-audio-haptics.mjs .`
    - `node skills/daily-and-statistics/scripts/check-daily-stats.mjs .`
    - `node skills/toybox-design-system/scripts/check-design-system.mjs .`
    - `node skills/code-drawn-art-and-icons/scripts/check-icons-and-logos.mjs .`
  - These print `RESULT: PASS`, and their only SKIP lines name S12, S13, S14 or S15: `node skills/toybox-screens/scripts/check-screens.mjs . --all`, `node skills/navigation-and-routing/scripts/check-navigation.mjs .` and `node skills/toybox-visual-parity/scripts/check-harness.mjs .`.
  - Design: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11 --screen S11a --screen S11b --screen S11c --screen S11d` prints `RESULT: PASS` (all four variants, every planned scroll offset).
  - Offline: `grep -rnE --exclude='*.test.ts' --exclude='*.test.tsx' "https?://|WebView" packages/shell/src/screens/settings` prints nothing.
  - Tests and code rules print `RESULT: PASS`:
    - `node skills/tdd-workflow/scripts/check-tests.mjs .`
    - `node skills/unit-and-component-tests/scripts/check-test-setup.mjs .` and `node skills/unit-and-component-tests/scripts/check-test-code.mjs .`
    - `node skills/typescript-and-lint-rules/scripts/check-source.mjs .` and `node skills/typescript-and-lint-rules/scripts/check-configs.mjs .`
    - `node skills/naming-conventions/scripts/check-file-names.mjs .` and `node skills/naming-conventions/scripts/check-code-names.mjs .`
    - `node skills/pocket-arcade-product-spec/scripts/check-spec-refs.mjs .`
    - `node skills/troubleshooting-playbook/scripts/check-known-pitfalls.mjs .`
  - Gates: `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with only the e2e:ios and screenshots:ios (step 10) and release:ios (step 11) script-target lines, and `node skills/quality-gates/scripts/check-bypasses.mjs .` prints `RESULT: PASS`.
  - `npm run verify` is green, ending `verify: 11 steps passed, 1 with SKIP lines` (only knip's `[knip-exports]` line while `shell-slice.json` exists).

### E14-T08 · Simplify, code review, re-run the gates and merge

- **Goal:** The branch is simplified, reviewed, proven again and merged, with its evidence report written and checked.
- **Skills:** `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`, `toybox-visual-parity`, `toybox-screens`, `settings-and-preferences`, `ios-simulator-build`.
- **Tests first:** Every confirmed review finding gets a failing test that shows the problem before its fix: in the model hook's or the view's test for a screen finding, in `settings-rows.test.ts` or `use-settings-model.test.tsx` for a row or effect finding, in `shell-app.test.tsx` for a provider finding. `/simplify` fixes that change behaviour are test-first in the same way.
- **Build:** Follow "Close the epic" below, steps 1 to 5. Keep what the build-order manifest lists, even where `/simplify` calls it unused: `screens/settings/sound-group.tsx` and `screens/settings/use-display-settings.ts`, which only their tests import. A fix that changes a screen's pixels needs that screen's parity loop again (T02 step 6), with new ledger entries (`check-signoff.mjs --draft <run-dir> --from-ledger`, then the eye checks again). Copy git-commits-and-reporting's `templates/evidence-slice.md` to `reports/evidence-<YYYY-MM-DD>-e14-settings-pages.md` and fill it in:
  - the outcome in players' words, for example: players can now open Settings, change every preference with an instant effect, and read About, the privacy policy and the licences offline;
  - "What changed for players", one line per behaviour with its spec id (S11, S11a to S11d, 7.2, 7.3, 7.6, 8.7, 8.11, N9);
  - the Checks list, with numbers from the Jest run and the `.parity/` reports;
  - "Please look at": the dark-fa sheets of `s11-settings` and `s11a-language`, and the `s11d-licences` sheet;
  - the intended changes: the reference changes L1, L5, O5 and R3S-G17e that `check-signoff.mjs` printed, the pre-listed S11b `about.version-chip` waivers (class design-artefact), and any new waiver with its Gate-Change commit;
  - "Owner steps (not blocking)": G3 (the support address still shows `support@example.com`), G2 (Rate this game waits for the App Store id), the fa and ckb review of the settings, language, about, privacy and licences texts (R3), the Line Siege play-test, and listening to the sound previews;
  - "Not tested or not verified":
    - Contact support and "Show licence text" on a real phone (the simulator has no mail account);
    - "Restart now" reloading into right to left (E16's language-switch flow);
    - sound and vibration felt on a device;
    - "Hints during play" changing nothing visible in Line Siege (no hint key, no tips);
    - the de and ckb captures (E17).
- **Done when:**
  - Every T07 "Done when" passes again after the fixes.
  - These print `RESULT: PASS`: `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD`, `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD` and `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e14-settings-pages.md --kind slice`.
  - The branch is merged into `main` and deleted: `git branch -d epic/e14-settings-pages && git push origin --delete epic/e14-settings-pages`.

## Close the epic

1. Re-run every task's "Done when" and `npm run verify`; all green.
2. Run `/simplify` over the branch's changes (`git diff main...HEAD`). Apply its fixes; where behaviour changes, test first. Then run `npm run verify` again.
3. Run `/code-review` on the branch. Fix every confirmed finding test-first (a failing test that shows the problem, then the fix). Then run `npm run verify` again.
4. Write the epic's evidence report (git-commits-and-reporting, slice form) and check it with `node skills/git-commits-and-reporting/scripts/check-report.mjs <report> --kind slice`.
5. Merge: `git switch main && git merge --no-ff epic/e14-settings-pages && git push origin main`, then delete the branch. The push to `origin` needs the owner's word in this session (git-commits-and-reporting rule 5); without it, `main` stays local and the report says so.
