# E13 · Levels, Daily challenge and Statistics: S8, S9, S10

| | |
|---|---|
| Branch | `epic/e13-levels-daily-stats` |
| Depends on | E12 |
| Spec | S8 Levels, S9 Daily challenge, S10 Statistics; 7.3 (the chosen digits on tiles, dates, streaks and every statistic, `٪` in Persian); 7.5 (the Levels grid starts at the top right, and the 7-day strip and the bar chart run right to left in fa and ckb); 8.1 (best stars per level, levels open one after another, packs open by stars collected); 8.3 (today's daily level from the local date: Play opens it); 8.4 (best per level, best per mode, totals for statistics); 8.8 (banners only at the bottom of Home, Levels and Statistics, never for Premium owners); D2 (Premium never unlocks levels); 15.1 (S8, S9 and S10 match their Toybox design in light and dark, en and fa) |
| Build order | Shell step 9 (S8, S9, S10) |
| Tasks | 5 |

## Current state

Shell steps 1 to 8 passed in E01 to E10, and Shell step 9 is done for S1 to S7 (E11 and E12). Concretely:

- `shell-slice.json` lists `"screens": ["S1", "S2", "S3", "S4", "S5", "S6", "S7"]`.
- `packages/shell/src/navigation/root-stack.tsx` routes LanguageChoice, Tutorial, Home and Game to their real screens. `Levels`, `Daily` and `Stats`, like the S11 to S13 routes, still point at the `NotBuiltScreen` stand-in, and Debug and FontTest wait for S15. Home's Levels key, its Statistics key and its daily card body (`home.daily-card`) all navigate normally and land on that stand-in.
- What S4 brought for S9 and S10 (E12): daily-and-statistics' `packages/shell/src/screens/daily/daily-summary.ts`, `use-daily-summary.ts` and `use-next-day-countdown.ts` (each with its test), `packages/shell/src/app/use-today.ts`, toybox-screens' `packages/shell/src/ui/use-pair-layout.ts` and `packages/shell/src/screens/home/use-level-play.ts`.
- The Shell core from Shell step 7 (E09): the run-end write and its models (`packages/shell/src/stores/run-end.ts`, `daily-model.ts`, `stats-model.ts`, with their tests), the S14 dialog host with the reset-statistics dialog (`packages/shell/src/screens/dialogs/`, `app/dialog-context.tsx`), admob-ads' `app/use-ad-context.ts` (`useBannerSlot`), every Toybox component S8 to S10 use (`LevelTile`, `ProgressBar`, `Toast`, `CalendarTile`, `WeekStrip`, `WeekLegend`, `WeekBars`, `StatGrid`, `StatList`, `EmptyState`, `EmptyStatsPicture`, `LogoTile`, `AdBannerSlot`, `ScreenBody`, `ScreenFrame`, `TopBar`), the test helpers `testing/render-with-shell.tsx` and `testing/create-host-wrapper.tsx`, and the parity harness (`app/parity/`, `app/parity-startup.tsx`) whose plans already know `s8-levels`, `s9-daily-challenge`, `s10-statistics` and `s10-statistics-empty`.
- The rules behind the screens: game-kit's `packages/game-kit/src/levels/pack-progress.ts` (`isPackUnlocked`, `isLevelUnlocked`, `starsMissing`, `defaultStarsToUnlock`) since E02, and Line Siege's 90 generated levels in three packs of 30 that open at 0, 45 and 90 stars (`apps/line-siege/src/levels/`, E03). Line Siege's catalogs hold `line-siege.pack-name.1..3` ("First wave", "Stronger foes", "Last stand") and `line-siege.stats.monsters-defeated`, `.beams-fired` and `.biggest-combo`. The four Shell catalogs hold every S8 to S10 copy key since Shell step 6.
- `parity/`: `signoff.json` has signed entries for the S1 to S7 frames (s1-splash, s2-language-choice, s3-consent-moment, s4-home, s4-home-premium, s6-pause--no-music--no-hints, s7-result-win--score, s7-result-lose; `s3-google-s-form` is mock-only and never signed). `waivers.json` already holds the pre-listed entries for this epic's frames: the dashed edges of S8 tiles 14 to 30 and `levels.pack.2`, S8 tile 13 drawn mid-press, the dashed S9 marks (`daily.week-day.1.mark`, `daily.week-day.7.mark`) and `daily.week-card`, and S9's tilted month (`daily.today-card.calendar.month`) in dark fa. `game-facts.json` holds Line Siege's facts (hasMusic false, winLine score, hasHints false).
- The Release test build tooling works (`npm run build:ios:sim`), and Maestro 2.10.0 with Java 17 has served the parity captures since E11.

Not there yet:

- `packages/shell/src/screens/levels/` and `packages/shell/src/screens/stats/` do not exist. `packages/shell/src/screens/daily/` has only the three summary helpers: no S9 model, view, cards or route file.
- `packages/shell/src/ui/streak-card.tsx`, `packages/shell/src/screens/settings/settings-resets.ts` and `use-settings-resets.ts`: nothing can reset the statistics yet. `packages/shell/src/screens/settings/` holds only `settings-preference-actions.ts` (S5).
- No capture or sign-off exists for s8-levels, s9-daily-challenge, s10-statistics or s10-statistics-empty.

Checks at the start:

- `node skills/toybox-screens/scripts/check-screens.mjs . --all` prints `RESULT: PASS` for S1 to S7, with SKIP lines (`<S-id> not in shell-slice.json`) for S8 to S15.
- `node skills/daily-and-statistics/scripts/check-daily-stats.mjs .` prints `RESULT: PASS` with exactly one SKIP line, `SKIP packages/shell/src/screens/stats/stats-summary.ts [missing-module] S10 not in shell-slice.json`, which this epic removes.
- `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS` with `[route-not-built]` SKIP lines for Levels, Daily, Stats and the S11 to S13 routes, and `[debug-gated]` lines for S15.
- `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS`, with a `[harness-opener]` SKIP line for `levels-locked-tile-tapped` (S8) among the lines for S11 to S15.
- `node skills/settings-and-preferences/scripts/check-settings.mjs .` prints `RESULT: PASS` with SKIP lines for the S11 rules, among them a `[reset-publish]` line for `resetStatistics` ending `S10 and S11 not in shell-slice.json`.
- `node skills/game-host-integration/scripts/check-game-host.mjs . --game line-siege` prints `RESULT: PASS` with only `SKIP packages/shell/src/app/shell-app.test.tsx [root-file-missing] S11 not in shell-slice.json`.
- `npm run -s check:fast` and `npm run test:coverage` are green. `npm run verify` is green and ends with `verify: 11 steps passed, 1 with SKIP lines`; the only SKIP line is knip's `[knip-exports]` line, which stays while `shell-slice.json` exists.

## What we will do

This is Shell step 9 for the three "progress" screens. Each one lands in its own task, in spec order. Each task copies the screen's manifest entry from pocket-arcade-index's build order, with the files the screen borrows, writes and runs the tests first, routes the screen in place of its `NotBuiltScreen` stand-in, adds its id to `shell-slice.json`, and then matches the running app to the Toybox design screenshots until `check-signoff.mjs` passes.

- **S8 Levels.** Copy toybox-screens' `packages/shell/src/screens/levels/**`. Players see pack 1 with each won level's best stars, the one current level with its gold flag, and locked tiles with a dashed edge and a padlock. Tapping a locked tile shows "Unlock this one by finishing level 12."; tapping an open one plays it. The next locked pack shows as a dashed panel with "Unlocks at 45 stars". Premium never opens a level (D2). The banner closes the scrolling body. Sign off `s8-levels`.
- **S9 Daily challenge.** Copy toybox-screens' `packages/shell/src/screens/daily/**` (the screen files beside the summary helpers S4 brought) and toybox-design-system's `packages/shell/src/ui/streak-card*`. Players see today's date on a calendar tile, Play (or, once played, today's first score, a "Play again for fun" key and "Next challenge in 3 h 5 min"), the current and best streak, the streak rule, and the last 7 days as done, missed and today marks with a legend. The strip runs right to left in fa. There is no banner. Sign off `s9-daily-challenge` on the design's Sunday, 27 September 2026.
- **S10 Statistics.** Copy toybox-screens' and daily-and-statistics' `packages/shell/src/screens/stats/**`, and settings-and-preferences' `packages/shell/src/screens/settings/settings-resets*` and `use-settings-resets.ts`. Players see Overview, Levels, Best, Daily challenge, Last 7 days (a bar chart that runs right to left in fa) and Line Siege's own three numbers ("×6" for the biggest combo). "Reset statistics" asks first in an S14 dialog, then clears only the statistics in one save write. A new player gets a friendly empty state instead of a wall of zeros. The banner is pinned under the scroll. Sign off `s10-statistics` at every scroll offset and `s10-statistics-empty`.
- **Gates, review and merge.** Run every Shell step 9 check for S8 to S10 together, then `/simplify` and `/code-review`, and merge with the slice report.

Not in this epic:

- S11 Settings with S11a to S11d, the "Reset all progress" dialog that also uses `settings-resets.ts`, and the deferred `app/shell-app.test.tsx` (E14).
- S12 Premium, S13 How to play, the S14 dialog frames (`s14-reset-all-progress`, `s14-restart-to-apply`, `s14-progress-restored`) and S15 Debug (E15). The reset-statistics dialog this epic opens has no design frame of its own; E15 matches the S14 dialog frame.
- The E2E flows that walk these screens (journey 02 from Home's daily card to S9, the pilot's flow 10 that checks level 1's stars and level 2's unlock on S8, and the 11-daily journey), the debug deep link's set-date, the screenshot matrix, and deleting `shell-slice.json` (E16).
- Parity in de and ckb, which is added before a release (E16 and E17), and tablet captures.
- The Android port (E18).
- The owner's review of the fa and ckb texts on these screens, the play-test and the sound previews: listed in the report under "Owner steps (not blocking)" and never waited for.

## Final state

- [ ] The three routes are real. `grep -nE "Levels: LevelsScreen|Daily: DailyScreen|Stats: StatsScreen" packages/shell/src/navigation/root-stack.tsx` prints three lines. `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS` with no `[route-not-built]` line for Levels, Daily or Stats.
- [ ] The slice includes them: `node -e "console.log(require('./shell-slice.json').screens.join(','))"` prints `S1,S2,S3,S4,S5,S6,S7,S8,S9,S10`.
- [ ] The code side of each screen matches its spec: `node skills/toybox-screens/scripts/check-screens.mjs . --screen S8 --screen S9 --screen S10` prints `RESULT: PASS`, and `node skills/toybox-screens/scripts/check-screens.mjs . --all` prints `RESULT: PASS` for every screen in the slice.
- [ ] Every frame matches its design: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S8 --screen S9 --screen S10` prints `RESULT: PASS`, listing s8-levels, s9-daily-challenge, s10-statistics and s10-statistics-empty each as `light-en done | light-fa done | dark-en done | dark-fa done`. The only waivers it lists are the pre-listed S8 and S9 entries, or a new one with its `Gate-Change:` commit named in the report.
- [ ] The daily and statistics rules run against the app's own code with nothing skipped: `node skills/daily-and-statistics/scripts/check-daily-stats.mjs .` prints `RESULT: PASS` with no SKIP line.
- [ ] The levels did not move: `node skills/level-generation-and-solvers/scripts/check-levels.mjs . --game line-siege` prints `RESULT: PASS`, and `git diff --quiet main...HEAD -- apps/line-siege/src/levels packages/game-kit` exits 0.
- [ ] Banners appear only where spec 8.8 allows: `node skills/admob-ads/scripts/check-ads.mjs .` and `node skills/admob-ads/scripts/check-ad-behaviour.mjs .` print `RESULT: PASS`, and `grep -rl "<AdBannerSlot" packages/shell/src/screens` lists only files under `screens/home/`, `screens/levels/` and `screens/stats/`.
- [ ] Reset statistics is one save write that keeps progress: `npx jest packages/shell/src/screens/settings/settings-resets.test.ts --ci --selectProjects unit` passes, and `node skills/settings-and-preferences/scripts/check-settings.mjs .` prints `RESULT: PASS` with no `[reset-publish]` SKIP line for `resetStatistics`.
- [ ] The S8 frame state is wired: `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS` with no SKIP line for `levels-locked-tile-tapped`.
- [ ] Texts, digits, direction and VoiceOver hold: `npm run i18n:verify` passes. `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S8 --screen S9 --screen S10 --game line-siege`, `check-catalogs.mjs .`, `check-i18n-code.mjs .` (i18n-strings-and-catalogs), `check-rtl.mjs .` (rtl-and-direction) and `check-a11y-code.mjs .` (accessibility) print `RESULT: PASS`.
- [ ] `npx tsc --noEmit -p packages/shell`, `npm run -s check:fast` and `npm run test:coverage` are green. `npm run verify` is green and ends with `verify: 11 steps passed, 1 with SKIP lines`; the only SKIP line is knip's `[knip-exports]`, while `shell-slice.json` exists.
- [ ] The slice report passes: `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e13-levels-daily-stats.md --kind slice` prints `RESULT: PASS`.

## Skills to load

Always: `pocket-arcade-index`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`.

For this epic:

- `pocket-arcade-product-spec`: prints the exact spec lines (S8, S9, S10, 7.3, 7.5, 8.1, 8.3, 8.4, 8.8, D2, 15.1) for each slice plan, commit body and the report, and `check-spec-refs` checks the citations.
- `toybox-screens`: the S8, S9 and S10 specs and templates (views, model hooks, route files and their tests), `list-screen` for each screen's exact testIDs and copy keys, and `check-screens`.
- `toybox-visual-parity`: the parity session (tooling, simulator, capture), `run-parity`, the sheets and eye checks, the pre-listed waivers, the ledger, `check-harness` and `check-signoff`.
- `toybox-components`: `LevelTile`, `WeekStrip`, `WeekLegend`, `WeekBars`, `StatGrid`, `StatList`, `EmptyState` and the other parts are called exactly as shipped, with their base testID props; `check-components`.
- `toybox-design-system`: the themed-card example `ui/streak-card*` that S9's manifest lands, the tokens and type roles (`levelNumber` at line height 1.45 in Persian, `streakValue`, `number`), and `check-design-system`.
- `i18n-strings-and-catalogs`: every text through `t()` with the copy-deck keys, the ICU plurals ("28 / 90 stars", "5 days", "2 h 14 min"), the Shell date formatter for S9, `copy-deck.mjs check`, `check-catalogs`, `check-i18n-code` and `npm run i18n:verify`.
- `rtl-and-direction`: the Levels grid, the week strip and the bar chart mirror through plain `row` layouts (never `row-reverse`); Persian digits through `createNumberFormatter(localeTagFor(...))` and `createPercentFormatter`; `check-rtl`.
- `accessibility`: the `findInaccessiblePressables` audit in every view test, the tile and week-mark labels (state is never shown by colour alone), locked tiles that stay pressable, the 200 % text stacking, `check-a11y-code` and `check-contrast`.
- `react-components-and-hooks`: the route-model-view pattern, model hooks with no `useMemo` (React Compiler), `useReduceMotion()` for the flag bob, and `check-react-rules`.
- `navigation-and-routing`: replacing the `Levels`, `Daily` and `Stats` stand-ins in `root-stack.tsx`, the Game route params for a level and a daily run, and `check-navigation`.
- `daily-and-statistics`: the daily rules behind S9 (first completion counts, replays change nothing, "played yesterday or today", a clock going backwards), `useToday()` and `useNextDayCountdown()`, the S10 summary (`stats-summary.ts`, `use-stats-summary.ts`), and `check-daily-stats`.
- `level-generation-and-solvers`: the pack and unlock rules S8 shows (`pack-progress.ts`: packs at 0, 45 and 90 stars, levels one after another, `starsMissing`) and `check-levels --game line-siege`, which proves the levels are unchanged.
- `state-stores`: the progress and stats stores the hooks read (`selectLevels`, `selectDigits`), `updateAndPublish` for the reset, and `check-stores` (no `cross-section-write`).
- `save-persistence-and-migrations`: the `stats`, `daily` and `progress` sections the screens read, the reset written to both slots with the backup refreshed, and `check-save-layer`.
- `settings-and-preferences`: `settings-resets.ts` and `use-settings-resets.ts` (Reset statistics keeps progress, settings and Premium), the Numbers setting the screens follow, and `check-settings` (`reset-publish`).
- `admob-ads`: `useBannerSlot('levels')` and `useBannerSlot('stats')`, the banner as the S8 body's last item and pinned under S10, no banner on S9 or for Premium owners; `check-ads` and `check-ad-behaviour`.
- `game-host-integration`: `useGameHost()` for the packs, the counters (save key, label and `'sum'` or `'max'`), the logo and the game name; Home's `useLevelPlay()` for the empty state's Play; `check-game-host`.
- `ios-simulator-build`: the Release test build the parity simulator runs (`npm run build:ios:sim -- --app line-siege --variant test --ads off`) and the rebuild before each final sign-off.
- `e2e-maestro`: the pinned Maestro 2.10.0 and Java 17 that `capture-app.mjs` drives, and the simulated clock of the debug kit that the parity launch sets to 2026-09-27.
- `unit-and-component-tests`: `renderWithShell` (language, settings and Premium options), `createHostWrapper` and `createShellWrapper` for hook tests, the fake clock, the paths-first Jest commands, `check-test-setup` and `check-test-code`.
- `typescript-and-lint-rules`: the copied TypeScript stays within the strict config and the size limits; `check-source` and `check-configs`.
- `naming-conventions`: the new files, the hooks and the kebab-case testIDs and counter ids (`stats.game-card.monsters-defeated`); `check-file-names` and `check-code-names`.
- `troubleshooting-playbook`: `find-fix` for any red test, build or capture, and `check-known-pitfalls` before the gates.

## How we work in this epic

1. Branch: `git switch main && git pull && git switch -c epic/e13-levels-daily-stats`. Push the branch after each task (`git push -u origin epic/e13-levels-daily-stats`), but only once the owner has given the word to push in this session (git-commits-and-reporting rule 5). Without it, the commits stay local and the report says so. Never bypass the pre-push hook.
2. Test first, always. Write each task's "Tests first" items, run them and watch them fail for the right reason, write the minimum code to pass, then refactor. Never weaken or edit a test to make it pass.
3. Commit each task in Conventional Commits form, with the trailers the skills ask for (Gate-Change:, Spec-Change:). `npm run -s check:fast` must be green before every commit.
4. Screens: a task that builds or changes a screen is not done until toybox-visual-parity's capture matches the Toybox design screenshot for every frame it names, in light-en, light-fa, dark-en and dark-fa at every scroll offset, and check-signoff passes for those frames.
5. Stop and ask the owner only at a step marked **Owner**.

## Tasks

### E13-T01 · S8 Levels

- **Goal:** Players see their progress and can pick any open level (spec S8). Each pack is a section ("Pack 1 – First wave", "30 levels") with its star progress ("28 / 90 stars" and a bar). Its grid of six columns shows won levels with their best stars (8.1), exactly one current level with its gold flag, and locked levels with a dashed edge and a padlock. Levels open one after another, and packs open by stars collected (0, 45 and 90 for Line Siege), so nobody is stuck on one hard level. A locked tile, when tapped, explains itself ("Unlock this one by finishing level 12."), and Premium never unlocks anything (D2). Level numbers use the chosen digits (7.3), the grid starts at the top right in fa (7.5), and the banner closes the scrolling body (8.8).
- **Skills:** `toybox-screens`, `toybox-visual-parity`, `toybox-components`, `level-generation-and-solvers`, `state-stores`, `react-components-and-hooks`, `navigation-and-routing`, `admob-ads`, `game-host-integration`, `i18n-strings-and-catalogs`, `rtl-and-direction`, `accessibility`, `unit-and-component-tests`, `ios-simulator-build`, `e2e-maestro`, `pocket-arcade-product-spec`, `tdd-workflow`.
- **Tests first:**
  - Plan the slice: `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs S8 8.1 7.5 D2` and tdd-workflow's `templates/slice-plan.md`. Print the contract with `node skills/toybox-screens/scripts/list-screen.mjs S8`, and open `skills/toybox-visual-parity/assets/reference/lineSiege/light-en/s8-levels.png` and `dark-fa/s8-levels.png`.
  - Copy the four tests from toybox-screens' `templates/packages/shell/src/screens/levels/` to the same paths, add the cases below, then give each module a typed stub with the same exports and wrong values: `tileWidthFor` returns 0, `levelPacksOf` returns `[]`, `starsByLevelOf` returns `{}`, `useLevelsModel` returns a model with no packs, and `LevelsView` renders `null`. Run `npx jest packages/shell/src/screens/levels --ci --selectProjects unit` and keep the red lines. Every failure must be an assertion diff, never `Cannot find module`.
  - `tile-width.test.ts` (unit; template): the six columns are floored to the device pixel grid, not to whole points (53.67 pt on a 402 pt phone at 3x, as the design draws), and stay inside the 640 pt content width on a tablet.
  - `levels-model-of.test.ts` (unit): the template's three cases (the first pack opens with one current level and only the next locked pack shows; a pack opens by stars collected, with its first level; the best stars of each won level come from the save). Add these cases:
    - **Line Siege's real shape:** three packs of 30 opening at 0, 45 and 90 stars, as game-kit's `defaultStarsToUnlock` gives them. At 44 stars pack 2 is locked, with `unlockStars` 45 and `missingStars` 1. At 45 it is open and its first level is `current`. Pack 3 opens at 90.
    - **The design's player:** levels 1 to 11 won with stars 3,3,2,3,1,3,3,2,3,2,3. This gives pack 1 `earnedStars` 28 of `totalStars` 90 (progress 28/90), level 12 the only `current` tile, 13 to 30 `locked`, and pack 2 as the one locked panel with `missingStars` 17.
    - **One after another:** a won level 20 with level 19 not won leaves 19 `current` (the first open unfinished level), and never two `current` tiles in one pack.
    - **Digits:** each tile's `numberText` comes from the `formatNumber` passed in (a Persian formatter gives `۱۲`).
  - `use-levels-model.test.tsx` (hook through `createHostWrapper`): the template's three cases. Those are the packs with saved stars and catalog pack names; a tapped locked tile focuses, and an open one navigates to `Game` with `{ start: 'new', ref: { kind: 'level', level } }`; and the `levels-locked-tile-tapped` parity frame opens with the first locked tile focused and `isReducedMotion` true. Add these cases:
    - **D2:** the same save with Premium owned gives the same tile states (every tile after the current one stays `locked`), and `banner.isAllowed` is false.
    - **Digits follow the setting:** in fa with the Numbers setting on Automatic, tile 12 reads `۱۲`; with the setting on Latin it reads `12`.
    - **The banner** comes from `useBannerSlot('levels')`: the model's `banner` matches what the slot hook gives for the same context.
  - `levels-view.test.tsx` (component through `renderWithShell`): the template's three cases. Those are every S8 testID, including the parts `LevelTile` derives (`.number`, `.stars-<k>`, `.flag`) and the locked pack's `.icon`, `.locked-badge`, `.requirement` and `.explanation`; an open level plays and a locked one explains; and the toast for the tapped locked tile. Add these cases:
    - `levels.pack.1.heading` reads "Pack 1 – First wave", `levels.pack.1.count` "30 levels" and `levels.pack.1.progress-label` "28 / 90 stars". `levels.pack.2.requirement` reads "Unlocks at 45 stars".
    - A locked tile stays pressable, and its VoiceOver label is "Level 13, locked". `levels.locked-toast` reads "Unlock this one by finishing level 12." and is drawn only while a locked tile is focused.
    - `levels.banner-ad` is the last child of the `levels.grid` ScrollView when the slot is allowed, and absent when it is not (a Premium owner).
    - An fa render (`renderWithShell(..., { language: 'fa' })`): `levels.pack.1.tiles` is a plain `row` with wrap (no `row-reverse`, no reversed array) whose children run from tile 1 to 30. iOS's right-to-left layout therefore puts level 1 at the top right, and the light-fa capture proves the position. The numbers are in Persian digits.
    - Every test that renders ends with `expect(findInaccessiblePressables(screen.container)).toStrictEqual([])`.
  - Red for the wiring: add `"S8"` to `shell-slice.json` before routing. `node skills/navigation-and-routing/scripts/check-navigation.mjs .` must now fail `[route-not-built]` for Levels, and `node skills/toybox-screens/scripts/check-screens.mjs . --screen S8` must fail (the screen is due).
- **Build:**
  1. Copy S8's manifest entry (Shell step 9, S8): toybox-screens' `packages/shell/src/screens/levels/**`. That is `levels-model.ts`, `levels-model-of.ts`, `use-levels-model.ts`, `tile-width.ts`, `levels-view.tsx` (the banner as the ScrollView's last item, the toast at 352 pt), `pack-section.tsx` (the Toybox `LevelTile` grid), `locked-pack-panel.tsx` (the Locked sticker on its own line) and `levels-screen.tsx` (`const model = useLevelsModel(); return <LevelsView model={model} />`). S8 borrows nothing.
  2. In `packages/shell/src/navigation/root-stack.tsx` replace the `Levels` stand-in with `Levels: LevelsScreen` and its import (navigation-and-routing's `templates/root-stack.tsx`).
  3. Texts: `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S8 --game line-siege`. If a key is missing, run `copy-deck.mjs apply . --screen S8 --game line-siege` and then `npm run i18n:verify`.
  4. Run the tests green, then `npx tsc --noEmit -p packages/shell` and `npm run -s check:fast`. Commit with the slice file, for example `feat(shell): add the s8 levels screen with packs, stars and locks`, with a body that names Spec S8, 8.1, 7.5, 8.8 and D2.
  5. Parity session, once per session (T02 and T03 reuse it):
     - Tooling: if `.parity/tooling/node_modules` is missing, run `mkdir -p .parity/tooling && cp skills/toybox-visual-parity/scripts/package.json skills/toybox-visual-parity/scripts/package-lock.json .parity/tooling/ && npm ci --prefix .parity/tooling`. Then `node skills/toybox-visual-parity/scripts/selftest.mjs --tooling .parity/tooling` must print `RESULT: PASS`. Anything else means the tooling is broken: stop and report.
     - Simulator: `node skills/toybox-visual-parity/scripts/setup-parity-sim.mjs --appearance light --name e07-parity-e13` prints this session's UDID. Never use another session's simulator or `booted`.
     - Build: `npm run build:ios:sim -- --app line-siege --variant test --ads off`, then `xcrun simctl install <udid> apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app`. `plutil -extract CFBundleIdentifier raw -o - <App>.app/Info.plist` prints `io.applander.linesiege`.
     - After a JavaScript-only fix, use the bundle swap (toybox-visual-parity's `references/simulator-and-capture.md`, "Fast iteration"). In `apps/line-siege`, run `APP_VARIANT=test EXPO_PUBLIC_APP_VARIANT=test ADS_MODE=off npx expo export:embed --platform ios --dev false --entry-file index.ts --bundle-output build/parity-bundle/main.jsbundle --assets-dest build/parity-bundle/assets`. Copy `main.jsbundle` into the `.app`, run `codesign --force --sign - --deep <App>.app` and `xcrun simctl install <udid> <App>.app`. Rebuild with `npm run build:ios:sim` before the final sign-off captures.
     - Maestro 2.10.0 and Java 17 are the ones E11 set up for parity (`capture-app.mjs` finds Maestro in `tools/maestro/bin/maestro`, `$PARITY_MAESTRO`, PATH or `~/.maestro/bin/maestro`). If Maestro is missing, install it only with e2e-maestro's pinned installer, never with Homebrew.
     - When the session ends, run `xcrun simctl shutdown <udid>` for this simulator only.
  6. Capture: `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen S8 --bundle-id io.applander.linesiege --name e07-parity-e13 --tooling .parity/tooling`. The run takes about a minute per variant, so run it in the background or with the longest timeout. The `levels-locked-tile-tapped` state is opened once on mount by `use-levels-model.ts` through the same state a tap sets. The current tile's flag bob holds still because `useReduceMotion()` is true in a capture. While fixing, `--frame s8-levels --themes light --langs en` narrows the run; a narrowed run is never a sign-off.
  7. On FAIL: fix one rule at a time in the printed order (screen reached, scroll, missing, bounds, text, fill, border, text-ink, structure). Open `crops/<testID>.png` in the run folder and the reference `.layout.json` before changing code, and read `references/failure-messages.md` for the rule. The fix goes into the app, never into a tolerance, a mask or a reference. A capture fails before a fix, so the capture is the red test. When a fix changes a model value, a testID or a text key, add a failing Jest case first.
  8. On PASS, look. Read every `sheet.png`, `zoom-*.png` and `eye-*.png` of each run. On S8, check that the Persian digits are whole (line height 1.45), the mini stars, padlocks, flag sticker and progress bar look right, and tile 13 shows its focus ring. The problems waived on each run must be exactly the 20 pre-listed ones: the dashed edges of tiles 14 to 30 and `levels.pack.2` (`platform`, structure), and tile 13 drawn mid-press (`design-artefact`, bounds and structure). Open one dashed crop to confirm that only the dash phase differs.
  9. Record: for each of the four runs, `node skills/toybox-visual-parity/scripts/check-signoff.mjs --draft .parity/lineSiege/s8-levels/<light-en|light-fa|dark-en|dark-fa>` prints the ledger entry. Answer the seven eye checks, add the entries to `parity/signoff.json`, and commit, for example `chore(repo): sign off s8-levels in light and dark, en and fa`.
- **Design match:** frame `s8-levels` (base reference, no variants) in light-en, light-fa, dark-en and dark-fa. Its state is `levels-locked-tile-tapped`: tile 13 focused with the toast, pack 1 at 28 / 90 stars, pack 2 locked with 17 more stars needed, and the banner placeholder at the bottom. The pre-listed waivers are the only accepted differences. Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S8`.
- **Done when:**
  - `npx jest packages/shell/src/screens/levels --ci --selectProjects unit` passes, and `npx tsc --noEmit -p packages/shell` and `npm run -s check:fast` are green.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S8` prints `RESULT: PASS`.
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS` with no `[route-not-built]` line for Levels.
  - `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS` with no SKIP line for `levels-locked-tile-tapped`.
  - `node skills/admob-ads/scripts/check-ads.mjs .` prints `RESULT: PASS` (`levels.banner-ad` from `useBannerSlot('levels')`).
  - `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen S8 --bundle-id io.applander.linesiege --name e07-parity-e13 --tooling .parity/tooling` ends with `RESULT: PASS` for all four runs on a fresh `build:ios:sim` build.
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S8` prints `RESULT: PASS` with `s8-levels light-en done | light-fa done | dark-en done | dark-fa done`.
- **Owner:** only if the same parity failure survives three fixes, or a difference needs a waiver that is not pre-listed. Send one stop-and-ask message (git-commits-and-reporting's `templates/owner-request.md`, checked with `check-report.mjs <file> --kind request`) with the dark-fa `sheet.png` and the crop. A new waiver goes into `parity/waivers.json` in its own commit with a `Gate-Change:` trailer and is named in the report. Meanwhile Claude goes on with T02.

### E13-T02 · S9 Daily challenge

- **Goal:** One special level per day, the same on every phone (spec S9, 8.3). Players see today on a calendar tile and can play it. After the first finished game they see today's first score, a "Play again for fun" key whose replays change nothing, and "Next challenge in {h} h {m} min" until local midnight. They also see the current and best streak ("played yesterday or today"), the streak rule, and the last 7 days as done, missed and today marks with a legend. The strip runs right to left in fa (7.5), and every date and number uses the Shell date formatter and the chosen digits (7.3). A clock that goes backwards keeps the done days done. There is no banner (8.8).
- **Skills:** `toybox-screens`, `toybox-visual-parity`, `toybox-design-system`, `toybox-components`, `daily-and-statistics`, `react-components-and-hooks`, `navigation-and-routing`, `admob-ads`, `i18n-strings-and-catalogs`, `rtl-and-direction`, `accessibility`, `unit-and-component-tests`, `ios-simulator-build`, `e2e-maestro`, `pocket-arcade-product-spec`, `tdd-workflow`.
- **Tests first:**
  - Plan the slice: `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs S9 8.3 7.5` and the slice plan. Run `node skills/toybox-screens/scripts/list-screen.mjs S9`, and open the light-en and dark-fa `s9-daily-challenge.png` references.
  - Copy `use-daily-model.test.tsx` and `daily-view.test.tsx` from toybox-screens' `templates/packages/shell/src/screens/daily/`, and `streak-card.test.tsx` from toybox-design-system's `examples/` (its line 1 names `packages/shell/src/ui/streak-card.test.tsx`). Add the cases below, then stub `useDailyModel` (a fixed model with the wrong date and no week), `DailyView` and `StreakCard` (both render `null`). Run `npx jest packages/shell/src/screens/daily packages/shell/src/ui/streak-card.test.tsx --ci --selectProjects unit` and keep the red lines. The summary helpers' tests from S4 (`daily-summary.test.ts`, `use-daily-summary.test.tsx`, `use-next-day-countdown.test.tsx`) must stay green throughout.
  - `use-daily-model.test.tsx` (hook through `createShellWrapper` with daily-and-statistics' fake clock and a test save). The template's two cases: today named from the Shell clock and the catalogs, with no result before the first game; and Play and Replay navigating to `Game` with `{ start: 'new', ref: { kind: 'daily', date: today } }`, with Back leaving. Add these cases, each over the summary `buildDailySummary` gives:
    - **Play or today's result:** with no result today, `todayResult` is null. After one run end for today, written as the game host writes it (`updateAndPublish` with `applyRunEnd(doc, end, clock.today())`), `todayResult.score` is that score.
    - **The first completion counts:** a second run end for today with a higher score (a replay) leaves `todayResult.score`, `currentStreak`, `bestStreak` and the week unchanged.
    - **Played yesterday or today:** with a streak whose last day is yesterday at length 5, `currentStreak` is 5 before today's game and 6 after it. A save whose last played day is two days ago gives 0 and keeps the best streak.
    - **The clock goes backwards:** after today is done, `clock.setToday(<yesterday>)` and a re-render keep the day already done marked done, never count it twice, and throw nothing.
    - **Today from `useToday()`, never cached:** `clock.advance` past midnight and a re-render move `dateText`, `dayText` and the week to the new day; the seventh column is the new today.
    - **"Next challenge in" from `useNextDayCountdown()`:** a fake clock with `msUntilNextLocalDay` at 3 h 5 min (11,100,000 ms) gives `todayResult` hours 3 and minutes 5 after today's game. `clock.advance(600_000)` and a re-render give 2 h 55 min.
    - **Digits:** in fa, `dayText` for 2026-09-27 reads `۲۷`.
  - `daily-view.test.tsx` (component through `renderWithShell`). The template's two cases: every S9 testID, including the parts `WeekStrip` derives from `dayTestIDBase="daily.week-day"` (`.letter`, `.mark`, `.today-tag`) and `CalendarTile`'s `.month` and `.day`; and Replay with the score once today is played. Add these cases:
    - **The week:** columns `daily.week-day.1` to `.7`, oldest first, with 7 being today and carrying the "Today" tag. Each mark has its own VoiceOver label (`daily.week.day-done.a11y-label`, `daily.week.day-missed.a11y-label`, `daily.today.label`) and its own icon (check, cross, play), so a state is never shown by colour alone. The legend shows `daily.week-card.legend.done` "Done" and `.missed` "Missed".
    - **Right to left:** in fa, `daily.week-strip` is a plain `row` (no `row-reverse`) with its columns oldest to today, so Monday sits on the right. The letters and numbers are Persian.
    - **After today's game:** `daily.play-button` is gone. `daily.replay-button` "Play again for fun", `daily.replay-note` "Replays don't change today's result.", `daily.today-card.score` and `daily.today-card.next-in` "Next challenge in 3 h 5 min" are shown.
    - **No banner:** nothing in the tree has a `*.banner-ad` testID.
    - **200 % text:** with `@e07/shell/ui/use-window-class.ts` mocked to large text, `daily.current-streak-card` and `daily.best-streak-card` stack in one column (`usePairLayout`).
    - Every test that renders ends with the `findInaccessiblePressables` audit.
  - `ui/streak-card.test.tsx` (component; toybox-design-system's example): the streak shows as a header and a value, with one named action, and passes the audit.
  - Red for the wiring: add `"S9"` to `shell-slice.json` first. `check-navigation.mjs .` fails `[route-not-built]` for Daily, and `check-screens.mjs . --screen S9` fails.
- **Build:**
  1. Copy S9's manifest entry (Shell step 9, S9). From toybox-screens' `packages/shell/src/screens/daily/**`, copy the screen files only: `daily-model.ts`, `use-daily-model.ts`, `daily-today-card.tsx`, `daily-view.tsx`, `daily-week-card.tsx` (the Toybox `WeekStrip` and `WeekLegend`), `streak-card.tsx` and `daily-screen.tsx`. From toybox-design-system, copy `packages/shell/src/ui/streak-card*` (`examples/streak-card.tsx` and its test). The borrowed files are already in place since S4 (`ui/use-pair-layout.ts`, `app/use-today.ts`, `daily-summary.ts`, `use-daily-summary.ts`, `use-next-day-countdown.ts`). Leave them unchanged: `git diff main -- packages/shell/src/screens/daily/daily-summary.ts packages/shell/src/screens/daily/use-daily-summary.ts packages/shell/src/screens/daily/use-next-day-countdown.ts` prints nothing.
  2. Route `Daily: DailyScreen` in `root-stack.tsx`, in place of its stand-in.
  3. Texts: `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S9 --game line-siege`. Dates come only from `format-date.ts` (`formatMonthShort`, `formatWeekdayDayMonth`, `formatWeekdayLetter`, `formatWeekdayName`), never `Date`, `Intl.DateTimeFormat` or `toLocale*`, which `check-daily-stats` scans for.
  4. Tests green, `tsc` and `check:fast` green, then commit, for example `feat(shell): add the s9 daily challenge with streaks and the week`, with a body that names Spec S9, 8.3, 7.3 and 7.5.
  5. Capture with the T01 session (a fresh `build:ios:sim` build installed): `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen S9 --bundle-id io.applander.linesiege --name e07-parity-e13 --tooling .parity/tooling`. The parity launch puts the debug kit's simulated clock on the frame date, Sunday 2026-09-27 (`launchDefaults.date` in frames.json). The fixture's `daily` section then draws Monday missed, Tuesday to Saturday done and Sunday as today, with a current streak of 5 and a best of 12. S9 needs no frame-state opener.
  6. Fix and look as in T01 steps 7 and 8. On S9, check that the calendar tile is tilted -3 degrees with the month band, that the chain icons and the gold rating star in the streak cards look right, and that the Today tag is tilted under the last column. Check that the strip and legend run right to left in fa. The waived problems must be exactly the pre-listed ones: the dashed edges of `daily.week-day.1.mark`, `daily.week-day.7.mark` and `daily.week-card` (`platform`, structure), and the tilted month `daily.today-card.calendar.month` in dark fa (`platform`, text-ink).
  7. Record the four ledger entries (`check-signoff.mjs --draft .parity/lineSiege/s9-daily-challenge/<variant>`) and commit, for example `chore(repo): sign off s9-daily-challenge in light and dark, en and fa`.
- **Design match:** frame `s9-daily-challenge` (base reference) in light-en, light-fa, dark-en and dark-fa. Its state: Sunday 27 Sep 2026, today not played, streak 5 days, best 12, and the strip missed, done ×5, today. The after-today state is a Chosen state the design does not draw; the view test covers it. Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S9`.
- **Done when:**
  - `npx jest packages/shell/src/screens/daily packages/shell/src/ui/streak-card.test.tsx --ci --selectProjects unit` passes, and `npx tsc --noEmit -p packages/shell` and `npm run -s check:fast` are green.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S9` prints `RESULT: PASS`.
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS` with no `[route-not-built]` line for Daily.
  - `node skills/daily-and-statistics/scripts/check-daily-stats.mjs .` prints `RESULT: PASS`; its only SKIP line is still the S10 `stats-summary.ts` one.
  - `node skills/toybox-design-system/scripts/check-design-system.mjs .` and `node skills/toybox-components/scripts/check-components.mjs .` print `RESULT: PASS` (the new `ui/streak-card.tsx` uses tokens only).
  - `node skills/admob-ads/scripts/check-ads.mjs .` prints `RESULT: PASS`, and `grep -rl "<AdBannerSlot" packages/shell/src/screens/daily` prints nothing.
  - `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen S9 --bundle-id io.applander.linesiege --name e07-parity-e13 --tooling .parity/tooling` ends with `RESULT: PASS` for all four runs on a fresh build.
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S9` prints `RESULT: PASS` with `s9-daily-challenge light-en done | light-fa done | dark-en done | dark-fa done`.
- **Owner:** only as in T01 (a parity failure that survives three fixes, or a waiver that is not pre-listed). Send one stop-and-ask message with the sheet. Meanwhile Claude goes on with T03.

### E13-T03 · S10 Statistics

- **Goal:** Players see their own history, stored only on the phone (spec S10, 8.4). The cards are:
  - Overview: games played, wins, win rate as "62%", and total play time as "2 h 14 min", translated in full.
  - Levels: completed, stars "28 / 90", three-star levels.
  - Best: best score per mode (Levels, Daily, Endless), the best level score "Level 9: 2,310", and the longest win streak.
  - Daily challenge: completed, current and best streak.
  - Last 7 days: a bar chart of games per day that runs right to left in fa (7.5).
  - Line Siege's card: "Monsters defeated", "Beams fired", and "Biggest combo" shown as "×6".

  Every number uses the chosen digits (7.3). "Reset statistics" asks first in an S14 dialog, then clears only the statistics in one save write that every store re-reads, keeping levels, stars, settings and Premium. A new player gets the empty state ("No stats yet", "Play a level") instead of a wall of zeros. The banner is pinned under the scroll for non-Premium players (8.8).
- **Skills:** `toybox-screens`, `toybox-visual-parity`, `toybox-components`, `daily-and-statistics`, `settings-and-preferences`, `state-stores`, `save-persistence-and-migrations`, `game-host-integration`, `admob-ads`, `react-components-and-hooks`, `navigation-and-routing`, `i18n-strings-and-catalogs`, `rtl-and-direction`, `accessibility`, `unit-and-component-tests`, `ios-simulator-build`, `e2e-maestro`, `pocket-arcade-product-spec`, `tdd-workflow`.
- **Tests first:**
  - Plan the slice: `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs S10 7.3 7.5 8.4 8.8` and the slice plan. Run `node skills/toybox-screens/scripts/list-screen.mjs S10`, and open the light-en and dark-fa `s10-statistics.png` and `s10-statistics-empty.png` references.
  - Copy the six tests before their modules:
    - daily-and-statistics' `templates/packages/shell/src/screens/stats/stats-summary.test.ts` and `use-stats-summary.test.tsx`;
    - settings-and-preferences' `templates/settings-resets.test.ts` (its line 1 names `packages/shell/src/screens/settings/settings-resets.test.ts`);
    - toybox-screens' `templates/packages/shell/src/screens/stats/stats-snapshot-of.test.ts`, `use-stats-model.test.tsx` and `stats-view.test.tsx`.

    Add the cases below, then give each module a typed stub: `buildStatsSummary` returns a non-empty summary of zeros and `splitDuration` returns 0 h 0 min; `useStatsSummary` returns the same summary; `createSettingsResets` returns handlers that do nothing; `useSettingsResets` returns those handlers; `statsSnapshotOf` returns empty cells; `useStatsModel` returns a model with `isEmpty` false and no numbers; `StatsView` renders `null`. Run `npx jest packages/shell/src/screens/stats packages/shell/src/screens/settings --ci --selectProjects unit` and keep the red lines.
  - `stats-summary.test.ts` (unit; daily-and-statistics). The template's four cases: the empty state for a new player; every S10 card from the save sections; the Endless best hidden for games without Endless; play time split into whole hours and minutes. Add these cases:
    - The design's player (frames.json `fixtureSave`): 58 games, 36 wins, the win rate 36/58, play time 2 h 14 min, 11 levels completed, 28 stars, 7 three-star levels, daily completed 19, current streak 5 and best 12. The best scores per mode come from `stats.bestScore`, and the best level score is level 9 with 2,310.
    - `isEmpty` is exactly `gamesPlayed === 0`: a player with one lost game sees the cards, not the empty state.
    - Last 7 days: exactly seven days, oldest first, ending today, with 0 for a day without games, read from `stats.days`.
  - `use-stats-summary.test.tsx` (template): summarises the saved statistics for today and follows the stats store's changes.
  - `settings-resets.test.ts` (unit; template): Reset statistics clears the statistics in both save slots and in the stats store, keeping progress. Reset all progress keeps settings and Premium; that is the other half of the file, which S11 uses in E14.
  - `stats-snapshot-of.test.ts` (unit). The template's three cases: the game's counter order and labels, with 0 for a counter never measured; a best-of counter (`aggregate: 'max'`) shown with a times sign, as the design draws "×6"; Endless and the best level score left out until they exist, with seven days named. Add Line Siege's three counters: `monsters-defeated` 1,284 and `beams-fired` 3,907 (`'sum'`, plain numbers) and `biggest-combo` ×6 (`'max'`), with kebab-case ids.
  - `use-stats-model.test.tsx` (hook through `createHostWrapper`). The template's three cases: the snapshot filled from the save with the game's counters labelled in game order; the empty state for a new player, without a best level score; asking before resetting, then clearing the statistics. Add these cases:
    - **The reset is confirmed in S14 and written once:** `onReset` opens the dialog `{ kind: 'reset-stats' }`, and nothing changes until it is confirmed. On confirm, exactly one `updateAndPublish` write happens (one save update, backup refreshed). It clears the statistics, keeps the progress store's levels and stars, and turns the model into the empty state at once, because the stores re-read the save.
    - **Durations translated:** in fa the play-time value is the fa catalog's `stats.duration` text in Persian digits. The string contains no Latin digit (`/[0-9]/` does not match).
    - **Percent:** the win rate reads `62%` in en, and in fa it uses Persian digits and `٪` (`createPercentFormatter`).
    - **Banner:** `banner` comes from `useBannerSlot('stats')`, and `banner.isAllowed` is false for a Premium owner.
    - **Empty state's Play** is Home's `useLevelPlay().onPlay`: it navigates to `Game` with the next level.
  - `stats-view.test.tsx` (component through `renderWithShell`). The template's five cases: the win rate as the bare percentage under its label; every S10 panel with its design testIDs; no Endless row for games without Endless; no best level score until a level is won; the empty state with its Play. Add these cases:
    - **The chart:** `stats.week-bar.1` to `.7` with 7 being today, each with its VoiceOver label "{weekdayName}: N games". A day with 0 games shows only its "0" value and no `.bar` child.
    - **Right to left:** in fa, `stats.week-card.chart` lays the bars in a plain `row` (no `row-reverse`), oldest to today, so time runs right to left, and every value is in Persian digits.
    - **The game card:** `stats.game-card.monsters-defeated`, `.beams-fired` and `.biggest-combo`, each with `.value` and `.label`. The combo reads "×6", and the title reads "Line Siege stats".
    - **Reset and the local note:** `stats.reset-button` (danger, trash icon) calls `onReset`. `stats.local-note` with its padlock `stats.local-note.icon` closes the normal page. The empty state's note has no padlock.
    - **Banner:** `stats.banner-ad` sits outside the ScrollView and pins under it when allowed. It is absent for a Premium owner, and then the body runs under the home indicator.
    - Every test that renders ends with the `findInaccessiblePressables` audit.
  - Red for the wiring: add `"S10"` to `shell-slice.json` first. `check-navigation.mjs .` fails `[route-not-built]` for Stats. `check-screens.mjs . --screen S10` fails (the screen is due, and `borrowed-file` names the missing summaries and resets with their owner skills). `check-daily-stats.mjs .` fails `[missing-module]` for `stats-summary.ts` instead of skipping it.
- **Build:**
  1. Copy S10's manifest entry (Shell step 9, S10):
     - toybox-screens' `packages/shell/src/screens/stats/**`: `stats-model.ts`, `stats-snapshot-of.ts`, `use-stats-model.ts`, `stats-cells.ts`, `stat-panel.tsx`, `stats-panels.tsx`, `stats-empty-state.tsx`, `stats-local-note.tsx`, `stats-view.tsx` and `stats-screen.tsx`;
     - daily-and-statistics' `packages/shell/src/screens/stats/**`: `stats-summary.ts` and `use-stats-summary.ts`;
     - settings-and-preferences' `packages/shell/src/screens/settings/settings-resets*` and `use-settings-resets.ts`, from the flat `templates/settings-resets.ts` and `templates/use-settings-resets.ts`, whose line 1 names the repo path.

     S10 also borrows `screens/home/use-level-play.ts` and `app/use-today.ts`, both in place since S4.
  2. Route `Stats: StatsScreen` in `root-stack.tsx`, in place of its stand-in.
  3. Texts: `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S10 --game line-siege`. The counter labels come from Line Siege's `line-siege.stats.*` keys through `gameMessageText`, and the durations, plurals and `stats.levels.stars-value` from the Shell catalogs.
  4. Tests green, `tsc` and `check:fast` green, then commit, for example `feat(shell): add the s10 statistics screen and its reset`, with a body that names Spec S10, 7.3, 7.5, 8.4 and 8.8.
  5. Capture with the T01 session (a fresh build installed): `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen S10 --bundle-id io.applander.linesiege --name e07-parity-e13 --tooling .parity/tooling`.
     - `s10-statistics` is a tall frame (`settleMs` 10000). `run-parity` plans the scroll offsets at which every element is whole at least once, and captures each variant at each offset into `.parity/lineSiege/s10-statistics/<variant>[-y<offset>]`. The banner stays pinned at the bottom at every offset.
     - `s10-statistics-empty` is captured with the new-player plan (`progress: new-player`).
     - Run it in the background: S10 is the longest screen of the epic.
  6. Fix and look as in T01 steps 7 and 8. On S10, check:
     - the icon tiles (stats, grid, the gold rating star, calendar) and the 36 pt logo tile on the game card;
     - the bar heights (value / max × 92) and the zero day;
     - the "×6" combo and the bare percentage;
     - the danger key with its trash icon, and the local note's padlock;
     - the boxed-star picture of the empty state;
     - the Persian digits and `٪` in fa.

     S10 has no pre-listed waiver, so every difference is a fix. A true platform limit becomes a waiver only as T01's **Owner** line says.
  7. Record a ledger entry for every run (`check-signoff.mjs --draft .parity/lineSiege/s10-statistics/<variant>[-y<offset>]` and `.../s10-statistics-empty/<variant>`) and commit, for example `chore(repo): sign off s10-statistics and s10-statistics-empty`.
- **Design match:** frames `s10-statistics` (tall: every scroll offset `run-parity` plans, with the banner pinned) and `s10-statistics-empty`, each in light-en, light-fa, dark-en and dark-fa. Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S10`.
- **Done when:**
  - `npx jest packages/shell/src/screens/stats packages/shell/src/screens/settings --ci --selectProjects unit` passes. `npx tsc --noEmit -p packages/shell`, `npm run -s check:fast` and `npm run test:coverage` are green.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S10` prints `RESULT: PASS` (no `borrowed-file` line).
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS` with no `[route-not-built]` line for Stats.
  - `node skills/daily-and-statistics/scripts/check-daily-stats.mjs .` prints `RESULT: PASS` with no SKIP line.
  - `node skills/settings-and-preferences/scripts/check-settings.mjs .` prints `RESULT: PASS`. No `[reset-publish]` line names `resetStatistics`; the remaining SKIP lines name only S11 screens.
  - `node skills/state-stores/scripts/check-stores.mjs .` (no `cross-section-write`) and `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .` print `RESULT: PASS`.
  - `node skills/game-host-integration/scripts/check-game-host.mjs . --game line-siege` prints `RESULT: PASS` with only the S11 `shell-app.test.tsx` SKIP line.
  - `node skills/admob-ads/scripts/check-ads.mjs .` prints `RESULT: PASS` (`stats.banner-ad` from `useBannerSlot('stats')`).
  - `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen S10 --bundle-id io.applander.linesiege --name e07-parity-e13 --tooling .parity/tooling` ends with `RESULT: PASS` for every run (both frames, four variants, every planned offset) on a fresh build.
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S10` prints `RESULT: PASS` with both frames `light-en done | light-fa done | dark-en done | dark-fa done`.
- **Owner:** only as in T01 (a parity failure that survives three fixes, or any waiver, since S10 has none pre-listed). Send one stop-and-ask message with the sheet. Meanwhile Claude goes on with T04's checks that do not depend on it.

### E13-T04 · Gates for Levels, Daily and Statistics

- **Goal:** Every Shell step 9 "done when" for S8, S9 and S10 holds at once on the branch, and nothing outside these screens moved: no level, golden or earlier screen changed, the banners are only where 8.8 allows them, and the slice's SKIP lines are exactly the ones the later screens explain.
- **Skills:** `toybox-screens`, `toybox-visual-parity`, `toybox-components`, `toybox-design-system`, `daily-and-statistics`, `level-generation-and-solvers`, `admob-ads`, `navigation-and-routing`, `settings-and-preferences`, `state-stores`, `save-persistence-and-migrations`, `game-host-integration`, `i18n-strings-and-catalogs`, `rtl-and-direction`, `accessibility`, `react-components-and-hooks`, `unit-and-component-tests`, `typescript-and-lint-rules`, `naming-conventions`, `pocket-arcade-product-spec`, `troubleshooting-playbook`, `quality-gates`, `tdd-workflow`.
- **Tests first:** Nothing new: the checks below are the tests. A red check is reproduced first as a failing test in the layer that owns it (a model hook test, a view test, a summary test), then fixed. A capture that turns red after a fix is re-run, re-looked at and re-signed as in T01 steps 6 to 9.
- **Build:** Run `node skills/troubleshooting-playbook/scripts/check-known-pitfalls.mjs .` first. Then run every command below from the repo root, and use `node skills/troubleshooting-playbook/scripts/find-fix.mjs --text "<the FAIL line>"` on anything red. Fix in the owning layer (model hook, view, summary), never in a checker, a tolerance or a reference.
  - If a fix touched a file outside `screens/levels/`, `screens/daily/`, `screens/stats/` and the two reset files (a Toybox component, a token, the banner band), every earlier signed screen that uses it is captured again and re-signed: `run-parity.mjs --screen <id> ...`, then `check-signoff.mjs --draft <run> --from-ledger` and the look.
  - Commit only fixes, each test-first, with the usual trailers.
- **Done when:**
  - Types and tests: `npx tsc --noEmit -p packages/shell`, `npm run -s check:fast` and `npm run test:coverage` are green.
  - The screens: `node skills/toybox-screens/scripts/check-screens.mjs . --screen S8 --screen S9 --screen S10` and `node skills/toybox-screens/scripts/check-screens.mjs . --all` print `RESULT: PASS`.
  - The design match: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S8 --screen S9 --screen S10` prints `RESULT: PASS` with all four frames done in all four variants. `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS` with SKIP lines only for S11 to S15 states.
  - The data: `node skills/daily-and-statistics/scripts/check-daily-stats.mjs .` prints `RESULT: PASS` with no SKIP line. `node skills/level-generation-and-solvers/scripts/check-levels.mjs . --game line-siege` prints `RESULT: PASS`, and `git diff --quiet main...HEAD -- apps/line-siege/src/levels packages/game-kit` exits 0.
  - The ads: `node skills/admob-ads/scripts/check-ads.mjs .` and `node skills/admob-ads/scripts/check-ad-behaviour.mjs .` print `RESULT: PASS`, and `grep -rl "<AdBannerSlot" packages/shell/src/screens` lists only files under `screens/home/`, `screens/levels/` and `screens/stats/`.
  - The routes: `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS`, its `[route-not-built]` lines naming only the S11 to S13 routes and its `[debug-gated]` lines S15.
  - The stores and save: `node skills/settings-and-preferences/scripts/check-settings.mjs .`, `node skills/state-stores/scripts/check-stores.mjs .`, `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .` and `node skills/game-host-integration/scripts/check-game-host.mjs . --game line-siege` print `RESULT: PASS`, with SKIP lines that name only S11.
  - Texts, direction and VoiceOver: `npm run i18n:verify` passes. These print `RESULT: PASS`:
    - `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S8 --screen S9 --screen S10 --game line-siege`;
    - `node skills/i18n-strings-and-catalogs/scripts/check-catalogs.mjs .`;
    - `node skills/i18n-strings-and-catalogs/scripts/check-i18n-code.mjs .`;
    - `node skills/rtl-and-direction/scripts/check-rtl.mjs .`;
    - `node skills/accessibility/scripts/check-a11y-code.mjs .`;
    - `node skills/accessibility/scripts/check-contrast.mjs .`.
  - Look and code: these print `RESULT: PASS`:
    - `node skills/toybox-components/scripts/check-components.mjs .`;
    - `node skills/toybox-design-system/scripts/check-design-system.mjs .`;
    - `node skills/react-components-and-hooks/scripts/check-react-rules.mjs .`;
    - `node skills/unit-and-component-tests/scripts/check-test-setup.mjs .`;
    - `node skills/unit-and-component-tests/scripts/check-test-code.mjs .`;
    - `node skills/typescript-and-lint-rules/scripts/check-source.mjs .`;
    - `node skills/typescript-and-lint-rules/scripts/check-configs.mjs .`;
    - `node skills/naming-conventions/scripts/check-file-names.mjs .`;
    - `node skills/naming-conventions/scripts/check-code-names.mjs .`;
    - `node skills/pocket-arcade-product-spec/scripts/check-spec-refs.mjs .`.
  - No bypass: `node skills/quality-gates/scripts/check-bypasses.mjs .` and `node skills/quality-gates/scripts/check-gate-wiring.mjs .` print `RESULT: PASS`. check-gate-wiring prints only the e2e:ios and screenshots:ios (Shell step 10) and release:ios (Shell step 11) script-target lines.
  - `npm run verify` is green, ending with `verify: 11 steps passed, 1 with SKIP lines`; the only SKIP line is knip's `[knip-exports]`.

### E13-T05 · Simplify, code review, re-run the gates and merge

- **Goal:** The branch is simplified, reviewed, re-checked and merged, with its evidence report written for the owner.
- **Skills:** `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`, `toybox-visual-parity`, `toybox-screens`, `ios-simulator-build`, `unit-and-component-tests`, `troubleshooting-playbook`.
- **Tests first:** Every confirmed `/code-review` finding, and every `/simplify` change that alters behaviour, first gets a failing test that shows the problem. That test goes in the owning test file: `levels-model-of.test.ts` or `use-levels-model.test.tsx` for unlock and focus logic, `use-daily-model.test.tsx` for dates, streaks and the countdown, `stats-summary.test.ts`, `stats-snapshot-of.test.ts` or `use-stats-model.test.tsx` for numbers and the reset, and the view tests for testIDs, texts, mirroring and the audit. Then comes the fix. A pure simplification that keeps behaviour needs no new test, and the existing tests must stay green unchanged.
- **Build:** Follow "Close the epic" below, steps 1 to 5.
  - When a fix changes anything S8, S9 or S10 draws, rebuild (`npm run build:ios:sim -- --app line-siege --variant test --ads off`) and install on this session's parity simulator. Capture the changed screen again with `run-parity.mjs --screen <S8|S9|S10> ...`, re-read its sheets, draft its entries with `check-signoff.mjs --draft <run> --from-ledger`, answer the eye checks again, and commit the updated `parity/signoff.json`.
  - Copy git-commits-and-reporting's `templates/evidence-slice.md` to `reports/evidence-<YYYY-MM-DD>-e13-levels-daily-stats.md` and fill it in:
    - The outcome in players' words: players can now pick any open level and see how to open the locked ones, follow today's challenge and their streak, and see their own statistics.
    - "What changed for players": one line per behaviour with its spec id (S8, S9, S10, D2, 7.5, 8.8).
    - Checks: the test counts from the Jest run, and "Design match" lines for S8, S9 and S10 naming `parity/signoff.json`.
    - "Please look at": the dark-fa `sheet.png` of s8-levels, s9-daily-challenge and s10-statistics (from `.parity/lineSiege/...`).
    - "Not tested or not verified": parity in de and ckb (before a release), tablet captures, S9's after-today state and the reset-statistics dialog (no design frame; covered by view tests), the E2E flows over these screens (E16), and every waiver in effect with its class and reason: the 20 S8 entries (dashed edges, tile 13 mid-press) and the 4 S9 entries (dashed marks and week card, the tilted month in dark fa), each with its Gate-Change commit if it is new.
    - "Owner steps (not blocking)": the fa and ckb texts of S8 to S10, the Line Siege play-test, and the sound previews.
- **Done when:**
  - Every T04 "Done when" passes again after the fixes, and `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S8 --screen S9 --screen S10` prints `RESULT: PASS` on the final build.
  - These print `RESULT: PASS`:
    - `node skills/tdd-workflow/scripts/check-tests.mjs .`;
    - `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD` (no test was weakened or rewritten after it was committed);
    - `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD` (headers, spec lines, and `Gate-Change:` exactly on commits that touched `parity/waivers.json`, if any);
    - `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e13-levels-daily-stats.md --kind slice`.
  - The branch is merged into `main` and deleted (`git branch -d epic/e13-levels-daily-stats && git push origin --delete epic/e13-levels-daily-stats`).
- **Owner:** only if `/code-review` confirms a defect inside a file copied verbatim from a skill template (a library defect, not something to patch in the copy), or a fix would change a pre-listed waiver or a reference. Send one stop-and-ask message (`templates/owner-request.md`, checked with `check-report.mjs <file> --kind request`) with the failing test and the template path. Meanwhile Claude fixes every other finding, lists this one under "Not tested or not verified", and does not merge until the owner answers.

## Close the epic

1. Re-run every task's "Done when" and `npm run verify`; all green.
2. Run `/simplify` over the branch's changes (`git diff main...HEAD`). Apply its fixes; where behaviour changes, test first. Then run `npm run verify` again.
3. Run `/code-review` on the branch. Fix every confirmed finding test-first (a failing test that shows the problem, then the fix). Then run `npm run verify` again.
4. Write the epic's evidence report (git-commits-and-reporting, slice form) and check it with `node skills/git-commits-and-reporting/scripts/check-report.mjs <report> --kind slice`.
5. Merge: `git switch main && git merge --no-ff epic/e13-levels-daily-stats && git push origin main`, then delete the branch. The push to `origin` needs the owner's word in this session (git-commits-and-reporting rule 5); without it, `main` stays local and the report says so.
