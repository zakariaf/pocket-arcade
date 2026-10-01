# E11 · First run: S1 Splash, S2 Language choice, S3 Ad consent and tracking

| | |
|---|---|
| Branch | `epic/e11-first-run-screens` |
| Depends on | E10 |
| Spec | S1 Splash, S2 First-run language choice, S3 Ad consent and tracking; 4.2 points 2 and 3 (consent in Europe, Apple's tracking prompt); 5 (the first-launch order: S1, then S2, then the tutorial; S3 before the first ad); 7.2 (choosing the language); N6 (four languages, both directions), N8 (no ad on app start); 15.1 (the S1, S2 and S3 part: each matches its design in en and fa, light and dark), 15.4 (the consent step and Apple's prompt, in order); owner decision O1; lead decision L10 |
| Build order | Shell step 9 (S1, S2, S3) |
| Tasks | 7 |

## Current state

E10 passed Shell step 8. Concretely:

- The pilot runs natively. `npm run build:ios:sim -- --app line-siege --variant test --ads off` builds a Release simulator app (`apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app`, called "the test app" below) from a clean prebuild, runs `audit:privacy`, and installs, launches and screenshots it on `e07-smoke`. Bundle id `io.applander.linesiege`. The store variant carries no test-only code. The kill test, the privacy-manifest audit and the network audit pass. Apple's tracking text (`consent.tracking.usage-description`) is in Info.plist in en, de, fa and ckb.
- **S1 exists but was never compared with its design.** `packages/shell/src/app/startup-splash.tsx`, `create-startup-splash.tsx` and `game-startup-splash.tsx` (with their tests) came in E09. `app/start-shell.ts` registers the splash while the app restarts for a direction change, and registers the held splash for the parity frame `s1-splash`.
- **S3 exists but was never compared with its design.** `packages/shell/src/screens/consent/consent-intro-screen.tsx` (with its test) is part of the Shell core. admob-ads' consent moment (`app/consent-moment.tsx`, `consent-moment-context.tsx`, `use-consent-moment.ts`, mounted in `ShellFeatures`) shows it. The order lives in `services/ads/ad-gate.ts` and `consent-moment-flow.ts` (E05), with their tests. The `ConsentPort` has `requestTracking()`.
- **S2 does not exist.** In `packages/shell/src/navigation/root-stack.tsx`, the FirstRun group holds `LanguageChoice: { screen: NotBuiltScreen, if: useNeedsLanguageChoice }` and `Tutorial` on `TutorialScreen`. Every Main and Debug route is on `NotBuiltScreen`. On a fresh install the smoke screenshot shows the stand-in with its route name.
- The parity harness is in (E09): `packages/shell/src/app/parity/**`, `parity-startup.tsx` and `parity-launch-marker.tsx`, with their tests, reached only through `TEST_ONLY`. `.gitignore` lists `.parity/`.
- `shell-slice.json` is `{ "screens": ["S1"], ... }`.

Not there yet:

- The parity tooling (`.parity/tooling`), Maestro (`tools/maestro/`), and a parity simulator for this epic.
- The repo's `parity/` folder: `signoff.json` (the sign-off ledger), `waivers.json` and `game-facts.json`.
- S2's files: `packages/shell/src/screens/first-run/language-choice-view.tsx`, `language-choice-screen.tsx` and `use-language-choice-model.ts`, plus the files S2 borrows, `app/use-direction-restart.ts`, `app/use-parity-opener.ts` and `i18n/create-language-t.ts`, each with its test.
- Any capture or sign-off of any screen.

Checks at the start:

- `npx tsc --noEmit -p packages/shell`, `npm run -s check:fast` and `npm run test:coverage` are green. `npm run verify` ends with `verify: 11 steps passed, 1 with SKIP lines`. Its only SKIP line is knip's `[knip-exports]`, which stays while `shell-slice.json` exists.
- `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS`. Its SKIP lines are for screens outside the slice, `[harness-game-facts]` included.
- `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS`, with a `[route-not-built]` SKIP line for every stand-in route, LanguageChoice included.
- `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with only the e2e:ios, screenshots:ios (step 10) and release:ios (step 11) script-target SKIP lines.

Confirm the start with `git log --oneline -3 main`, `npm run -s check:fast`, `cat shell-slice.json` and `ls packages/shell/src/app/startup-splash.tsx packages/shell/src/screens/consent/consent-intro-screen.tsx packages/shell/src/app/consent-moment.tsx packages/shell/src/app/parity-startup.tsx`.

## What we will do

This is Shell step 9 for the first three screens, the ones a player meets on the very first launch.

- **Parity tooling first.** Install the parity tooling: three pinned npm packages that the parity scripts load from `.parity/tooling`. Install the pinned Maestro 2.10.0, which reads the element bounds. Create this epic's own parity simulator, `e07-parity-e11` (iPhone 16 Pro, iOS 26.5, status bar at 9:41). Then copy the parity ledger, the pre-listed waivers and the pilot's game facts (`parity/**`), before the first sign-off, in a commit with a `Gate-Change:` trailer.
- **S1 Splash.** The splash code exists. We pin the S1 rules with tests, capture `s1-splash` in light-en, light-fa, dark-en and dark-fa, fix every difference, look at every sheet and sign it off.
- **S2 Language choice.** We copy S2's manifest entry test-first: the view, the route component, the model hook, and the borrowed `use-direction-restart`, `use-parity-opener` and `create-language-t`. We route `LanguageChoice` in place of its stand-in, add S2 to the slice, then match and sign off `s2-language-choice` in the four variants. The behaviour:
  - the phone's language is pre-selected when it is one of the four (Persian for fa-IR, Sorani for ckb-IQ and Kurdish in Arabic script); otherwise English, which covers Kurmanji (`ku-TR`);
  - Continue is written in the language being chosen;
  - Continue saves the language; when the direction flips, the app restarts once, after the audio has been disposed;
  - then the FirstRun group opens the tutorial by itself.
- **S3 Ad consent and tracking.** Nothing new to copy: S3 is not a route. We add S3 to the slice, which makes the S3 harness rules strict, and map every S3 rule to the test that proves it:
  - the intro appears only right before Google's form, and Apple's prompt alone when no form is due (L10);
  - declining or restricted tracking still serves ads;
  - none of it with ads off, for Premium, offline, before the tutorial, during a level, or in the held parity frame.

  We add the missing tests, then match and sign off `s3-consent-moment`. The mock-only `s3-google-s-form` is looked at, never captured.
- **Prove it and close.** Every first-run gate is run, then `/simplify` and `/code-review`, a slice report, and the merge.

Not in this epic:

- S4 to S15, the real consent moment over Home's banner, and the parity-game-facts test `apps/line-siege/src/parity-game-facts.test.ts`:
  - S4 to S7, plus the facts test, which comes with S5's manifest entry, when S6 and S7 make `[harness-game-facts]` strict: **E12**;
  - S8 to S10: **E13**;
  - S11 with its "Ad privacy choices" row, and S11a to S11d: **E14**;
  - S12 to S15: **E15**.
- The E2E flows: the first-launch journey (S1, then S2, then a Persian pick that restarts once, then the tutorial, then Home) and the language switch on the simulator. Also the debug deep link, the runtime network layer and the measured cold start (S1's "under 1 second"): **E16**.
- The ads smoke test on an `ADS_MODE=test` build (S3, Google's form, the tracking prompt declined, then a banner, in a simulated EU region), and the de and ckb parity variants added before a release: **E17**.
- The Android port: **E18**.
- The owner's review of fa and ckb texts. No new text is expected here: every S1, S2 and S3 text came from the copy deck in E06. Any text that does change is listed for the owner and never waited for (O6).

## Final state

- [ ] The parity tooling works on this Mac:
  - `node skills/toybox-visual-parity/scripts/selftest.mjs --tooling .parity/tooling` prints `RESULT: PASS`;
  - `node skills/toybox-visual-parity/scripts/setup-parity-sim.mjs --appearance light --name e07-parity-e11 --check` prints `RESULT: PASS`;
  - `tools/maestro/bin/maestro --version` prints `2.10.0`.
- [ ] The parity ledger, the pre-listed waivers and the pilot's facts are committed, with a Gate-Change trailer. `git log --format=%B -1 -- parity/game-facts.json | grep '^Gate-Change:'` prints the trailer. `node -e "console.log(JSON.stringify(require('./parity/game-facts.json').games['line-siege']))"` prints `{"designGame":"lineSiege","hasMusic":false,"winLine":"score","hasHints":false}`.
- [ ] The slice holds the three first-run screens: `node -e "console.log(require('./shell-slice.json').screens.join(','))"` prints `S1,S2,S3`.
- [ ] S2 is routed. `grep -n 'LanguageChoice: { screen: LanguageChoiceScreen' packages/shell/src/navigation/root-stack.tsx` finds the line. `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS`, and none of its lines names `LanguageChoice`.
- [ ] The code side of each screen holds: `node skills/toybox-screens/scripts/check-screens.mjs . --screen S1 --screen S2 --screen S3` prints `RESULT: PASS` (testIDs, copy keys, view tests with the accessibility audit, model hook and test, `splash-held`, `borrowed-file`).
- [ ] Each screen matches its design. `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S1 --screen S2 --screen S3` prints `done` for `s1-splash`, `s2-language-choice` and `s3-consent-moment` in light-en, light-fa, dark-en and dark-fa, and `mock-only` for `s3-google-s-form`, then `RESULT: PASS`. Every entry in `parity/signoff.json` has the seven eye checks answered and no open difference.
- [ ] S2's behaviour is proven: `npx jest packages/shell/src/screens/first-run packages/shell/src/app/use-direction-restart.test.tsx packages/shell/src/app/use-parity-opener.test.tsx packages/shell/src/i18n/create-language-t.test.ts packages/shell/src/navigation --ci --selectProjects unit` passes (phone locales, Continue in the chosen language, save, then one restart on a direction flip after `audio.dispose()`, then the tutorial).
- [ ] S3's order is proven:
  - `node skills/admob-ads/scripts/check-ad-behaviour.mjs .` and `node skills/admob-ads/scripts/check-ads.mjs .` print `RESULT: PASS`;
  - `npx jest packages/shell/src/services/ads packages/shell/src/app/consent-moment.test.tsx packages/shell/src/screens/consent --ci --selectProjects unit` passes;
  - each of the four `run.json` files of the held frame under `.parity/lineSiege/s3-consent-moment/` records `"systemAlert": null` (no Google form, no tracking prompt).
- [ ] The harness is complete for the slice: `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS`, and none of its SKIP lines names S1, S2 or S3.
- [ ] The texts are the copy deck's: `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S1 --screen S2 --screen S3 --game line-siege` prints `RESULT: PASS`, and `npm run i18n:verify` passes.
- [ ] A fresh install opens on S2: `node skills/ios-simulator-build/scripts/check-screenshot.mjs reports/ios/line-siege/` prints `RESULT: PASS`, and `reports/ios/line-siege/smoke-test-off.png` shows the real language choice (looked at), not the stand-in.
- [ ] Types, tests and gates are green: `npx tsc --noEmit -p packages/shell`, `npm run -s check:fast` and `npm run test:coverage`. `npm run verify` ends with `verify: 11 steps passed, 1 with SKIP lines` (knip's `[knip-exports]` while the slice file exists).
- [ ] The slice report passes: `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e11-first-run-screens.md --kind slice` prints `RESULT: PASS`.

## Skills to load

Always: `pocket-arcade-index`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`.

For this epic:

- `pocket-arcade-product-spec`: prints the exact lines of S1, S2, S3, 4.2, 5, 7.2, N6, N8, 15.1 and 15.4 (`spec-lookup.mjs`) for the first test of each slice and the commit bodies; `check-spec-refs.mjs`.
- `toybox-screens`: S1, S2 and S3 specs (`references/s01-splash.md`, `s02-language-choice.md`, `s03-consent.md`), S2's templates and borrowed files, `list-screen.mjs`, `check-screens.mjs`.
- `toybox-visual-parity`: the tooling, the parity simulator, `run-parity.mjs`, the sheets and the seven eye checks, `parity/**`, `check-harness.mjs`, `check-signoff.mjs`, `frames.json` and the reference images.
- `toybox-components`: the parts these screens are made of (LogoTile, BusyBlocks, ArtTile, OptionCard with its RadioMark, Sticker, the hero Button, NotePanel), their testID parts and edge widths; `check-components.mjs`.
- `toybox-design-system`: the type roles (`gameNameSplash`, `splashTagline`, `optionNameChoice`, `title`, `lead`), tokens and dark mode, where a `fill` or `text-ink` failure points; `check-design-system.mjs`.
- `code-drawn-art-and-icons`: the splash logo tile (152, -6 degrees, 7 pt ring), the `globe` and `shield` art tiles and the `info` and `forward` icons; `check-icons-and-logos.mjs`.
- `i18n-strings-and-catalogs`: `create-language-t.ts`, the S1 to S3 copy keys and the tracking text, `copy-deck.mjs check`, `check-i18n-code.mjs`, `check-catalogs.mjs`, `npm run i18n:verify`.
- `rtl-and-direction`: the direction restart (save first, at most once, from a mounted component), autonyms in their own script and direction, the fa layouts; `check-rtl.mjs`.
- `accessibility`: radio roles and selected state, the loader's label, `findInaccessiblePressables`, contrast in dark mode; `check-a11y-code.mjs`, `check-contrast.mjs`.
- `react-components-and-hooks`: the S2 model hook (state initialisers, no `useMemo` under the React Compiler, effects); `check-react-rules.mjs`.
- `navigation-and-routing`: the `LanguageChoice` route in place of `NotBuiltScreen`, the FirstRun guards (never `navigate`); `check-navigation.mjs`.
- `settings-and-preferences`: the `set-language` action and what it changes (language, digits, `firstRun.languageChosen`), and the language-change plan.
- `state-stores`: the settings store and its reducer, which S2 dispatches into; `check-stores.mjs`.
- `admob-ads`: the consent moment, the gate's order (O1, L10), `ConsentPort.requestTracking()`; `check-ads.mjs`, `check-ad-behaviour.mjs`.
- `game-audio-and-haptics`: `audio.dispose()` before the direction reload; `check-audio-haptics.mjs` (`dispose-before-reload`).
- `privacy-and-network-audit`: S1 never waits for the network and S2 and S3 add no network code; `audit-repo.mjs`.
- `performance-budgets`: S1 adds no start-up work; `check-perf-code.mjs` keeps only the Home-mark slice line.
- `ios-simulator-build`: the Release test build, its install on the parity simulator, the smoke screenshot; `check-sim-setup.mjs`, `check-screenshot.mjs`.
- `e2e-maestro`: the pinned Maestro installer and Java 17, which the parity capture needs for element bounds.
- `unit-and-component-tests`: `renderWithShell` and `createShellWrapper` (with `language: 'fa'`), mocks of `expo-localization` and the direction module; `check-test-code.mjs`.
- `typescript-and-lint-rules`: the copied files stay within the strict config and the size limits; `check-source.mjs`.
- `naming-conventions`: file names, hook names and testIDs of the new files; `check-file-names.mjs`, `check-code-names.mjs`.
- `architecture-and-boundaries`: the parity opener and harness stay behind the test-only gate, and the S2 files sit in their zones; `check-boundaries.mjs`.
- `troubleshooting-playbook`: `find-fix.mjs` on a failing build or capture log, `check-known-pitfalls.mjs`.

## How we work in this epic

1. Branch: `git switch main && git pull && git switch -c epic/e11-first-run-screens`. Push the branch after each task (`git push -u origin epic/e11-first-run-screens`), but only once the owner has given the word to push in this session (git-commits-and-reporting rule 5). Without it, the commits stay local and the report says so. Never bypass the pre-push hook.
2. Test first, always. Write each task's "Tests first" items, run them and watch them fail for the right reason, write the minimum code to pass, then refactor. Never weaken or edit a test to make it pass.
3. Commit each task in Conventional Commits form, with the trailers the skills ask for (Gate-Change:, Spec-Change:). `npm run -s check:fast` must be green before every commit.
4. Screens: a task that builds or changes a screen is not done until toybox-visual-parity's capture matches the Toybox design screenshot for every frame it names, in light-en, light-fa, dark-en and dark-fa at every scroll offset, and check-signoff passes for those frames.
5. Stop and ask the owner only at a step marked **Owner**.

Two things hold for every screen task below.

- **What "red" means for a look fix.** A behaviour fix starts with a failing Jest case. A pure look fix (a padding, a box width, a type role) starts with a parity FAIL line, which is the failing test of the look. The re-run that passes is its green.
- **A new test case on code that already exists.** S1 and S3 came from E09's templates, so a new case written here may pass on its first run. Before trusting it, break the code on purpose for a moment (for example, pass an empty game name), watch the case fail with an assertion diff, then put the code back. Say so in the commit body.

The parity commands below use `--name e07-parity-e11` (this epic's simulator), `--bundle-id io.applander.linesiege` and `--tooling .parity/tooling`. All three S1 to S3 frames are phone frames, so `run-parity.mjs` plans one scroll offset (0) for each. Each run takes 10 to 20 seconds and a screen has 4 runs: run the command in the background or with the longest timeout. A narrowed run (`--themes`, `--langs`) is for iteration only and never counts as done.

## Tasks

### E11-T01 · Parity tooling, Maestro and this epic's parity simulator

- **Goal:** The machine side of the parity loop can run on this Mac. That means:
  - the pinned parity packages are in the gitignored `.parity/tooling` and pass the skill's self-test;
  - Maestro 2.10.0 runs on Java 17;
  - this epic's own simulator `e07-parity-e11` is booted (iPhone 16 Pro, iOS 26.5, en_US, status bar at 9:41) and holds the current Release test build;
  - `check-harness` proves E09's harness is complete and wired for the slice.

  No product code changes.
- **Skills:** `toybox-visual-parity`, `e2e-maestro`, `ios-simulator-build`, `troubleshooting-playbook`, `quality-gates`, `git-commits-and-reporting`.
- **Tests first:** The skill's self-test and checkers are this task's tests. Run each before setting anything up and keep the red lines for the report:
  - `node skills/toybox-visual-parity/scripts/selftest.mjs --tooling .parity/tooling` exits 2 with `ERROR [bad-input] pngjs 7.0.0 is not installed in .../.parity/tooling/node_modules`.
  - `node skills/toybox-visual-parity/scripts/setup-parity-sim.mjs --appearance light --name e07-parity-e11 --check` fails with `sim-missing`.
  - `tools/maestro/bin/maestro --version` fails (no such file).
  - `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS`, as E09 left it. If it fails a rule for S1, which has been in the slice since E09 (for example `[harness-launch-marker]` on the held splash in `start-shell.ts`), that is a defect left by E09. Note it here and fix it test-first in T03.
- **Build:**
  1. Install the parity tooling into the repo, because the skill folder is shared through `.claude/skills` and must stay read-only:
     `mkdir -p .parity/tooling && cp skills/toybox-visual-parity/scripts/package.json skills/toybox-visual-parity/scripts/package-lock.json .parity/tooling/ && npm ci --prefix .parity/tooling`.
     This installs pngjs 7.0.0, pixelmatch 7.2.0 and playwright 1.63.0, with no browser download.
     Then confirm `grep -nx '.parity/' .gitignore` finds the line (E09 added it) and `git check-ignore -q .parity/tooling` exits 0.
  2. Install Maestro the one allowed way (e2e-maestro rule 1):
     - Copy `skills/e2e-maestro/templates/packages/tooling/scripts/install-maestro.sh` to `packages/tooling/scripts/install-maestro.sh`, byte for byte, and `chmod +x` it. It is one file of Shell step 10's `packages/tooling/scripts/**`, brought forward because the parity capture is the first thing that needs Maestro. E16 copies the rest and finds this one identical (`cmp`).
     - Run `bash packages/tooling/scripts/install-maestro.sh`. It downloads the pinned zip, checks its SHA-256 and installs into the gitignored `tools/maestro/`.
     - Check Java 17 with `/usr/libexec/java_home -v 17`. The parity scripts set the three Maestro no-telemetry variables themselves.
  3. Run `node skills/toybox-visual-parity/scripts/selftest.mjs --tooling .parity/tooling` until it prints `RESULT: PASS`. Anything else means the tooling itself is broken: stop and report (the skill's rule).
  4. Create and boot the simulator: `node skills/toybox-visual-parity/scripts/setup-parity-sim.mjs --appearance light --name e07-parity-e11`. It prints `udid <UDID>`; keep it as `<parity udid>` for the whole epic. Then run the same command with `--check`.
  5. Build and install the Release test build:
     - `npm run build:ios:sim -- --app line-siege --variant test --ads off`;
     - `xcrun simctl install <parity udid> apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app`;
     - `plutil -extract CFBundleIdentifier raw -o - apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app/Info.plist` prints `io.applander.linesiege`.

     On a build failure, run `node skills/troubleshooting-playbook/scripts/find-fix.mjs --log apps/line-siege/build/logs/<step>.log`.
  6. Prove the capture path end to end with one narrowed run. This is iteration, never a sign-off:
     `node skills/toybox-visual-parity/scripts/run-parity.mjs --frame s1-splash --themes light --langs en --bundle-id io.applander.linesiege --name e07-parity-e11 --tooling .parity/tooling`.
     The run must reach the screen: no `screen-not-reached`, no "hierarchy from another simulator", no `system-alert`. Its gate results do not matter yet (T03).
  7. Commit `packages/tooling/scripts/install-maestro.sh` as `build(tooling): add the pinned maestro installer for parity captures`. The trailer paragraph holds `Gate-Change: packages/tooling/scripts/install-maestro.sh, the pinned Maestro 2.10.0 installer from e2e-maestro, brought forward from Shell step 10 because parity captures need Maestro`. Check the message first with `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged`.
- **Done when:**
  - `node skills/toybox-visual-parity/scripts/selftest.mjs --tooling .parity/tooling` prints `RESULT: PASS`.
  - `node skills/toybox-visual-parity/scripts/setup-parity-sim.mjs --appearance light --name e07-parity-e11 --check` prints `RESULT: PASS`.
  - `tools/maestro/bin/maestro --version` prints `2.10.0`, and `git status --short tools .parity` prints nothing (both ignored).
  - The narrowed `s1-splash` run reached the screen, and its `run.json` records `<parity udid>` and `"systemAlert": null`.
  - `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS`, its SKIP lines naming only screens outside the slice.
  - `node skills/ios-simulator-build/scripts/check-sim-setup.mjs .` and `node skills/quality-gates/scripts/check-gate-wiring.mjs .` print `RESULT: PASS`; check-gate-wiring prints only its three script-target lines.
  - `npm run -s check:fast` is green.
- **Owner:** Only if Java 17 is missing (`/usr/libexec/java_home -v 17` fails and there is no Android Studio JBR), or the iOS 26.5 runtime is gone. Installing either needs the owner's admin password. Claude sends one stop-and-ask message in git-commits-and-reporting's request form, checked with `node skills/git-commits-and-reporting/scripts/check-report.mjs <request> --kind request`. Meanwhile Claude does T02 and the Jest and checker side of T03 to T05; the captures wait.

### E11-T02 · Parity ledger, pre-listed waivers and the pilot's game facts

- **Goal:** The three files of the repo's `parity/` folder exist before the first sign-off (S1, in T03), as the S2 manifest entry says:
  - `parity/signoff.json`: the empty sign-off ledger;
  - `parity/waivers.json`: the pre-listed platform waivers;
  - `parity/game-facts.json`: Line Siege's facts, `designGame lineSiege`, `hasMusic false`, `winLine score`, `hasHints false`.

  `waivers.json` and `game-facts.json` are gated paths, so they get their own commit with a `Gate-Change:` trailer.
- **Skills:** `toybox-visual-parity`, `quality-gates`, `git-commits-and-reporting`.
- **Tests first:** No product code changes, so there is no Jest test. The checks that read these files are the tests. Run them before the copy and record the result:
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S1` prints `not-captured` for light-en, light-fa, dark-en and dark-fa, and `RESULT: FAIL`. This is the done check that T03 turns green.
  - `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `SKIP parity/game-facts.json [harness-game-facts] ... not in shell-slice.json`. This rule does not go red here: it falls due only when a screen whose frame has reference variants joins the slice (S6, S7, S11 or S14). That is E12, with the facts test `apps/line-siege/src/parity-game-facts.test.ts` from S5's manifest entry. Nothing checks the facts' values before then. That is why this task compares them with the expected values by hand, below.
  - After the copy, check-harness parses both files. A malformed waiver fails `waiver-invalid`, and a malformed ledger fails `ledger-invalid`.
- **Build:**
  1. `mkdir -p parity && cp skills/toybox-visual-parity/templates/parity/signoff.json skills/toybox-visual-parity/templates/parity/waivers.json parity/`.
  2. `sed 's/__GAME_ID__/line-siege/' skills/toybox-visual-parity/templates/parity/game-facts.json > parity/game-facts.json`. The key must be the app folder name, `line-siege`.
  3. Check the values:
     - `node -e "console.log(JSON.stringify(require('./parity/game-facts.json').games['line-siege']))"` prints `{"designGame":"lineSiege","hasMusic":false,"winLine":"score","hasHints":false}`;
     - `cmp parity/waivers.json skills/toybox-visual-parity/templates/parity/waivers.json` and `cmp parity/signoff.json skills/toybox-visual-parity/templates/parity/signoff.json` exit 0;
     - `npx prettier --check parity` passes. If Prettier asks for a format change, apply it with `--write` and confirm that the JSON content is unchanged.
  4. Commit the three files as `chore(repo): add the parity ledger, pre-listed waivers and game facts`. The trailer paragraph holds `Gate-Change: parity/waivers.json and parity/game-facts.json from toybox-visual-parity (pre-listed platform waivers; Line Siege facts hasMusic false, winLine score, hasHints false), copied before the first sign-off (Shell step 9, S2 manifest entry)`. Check it with `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged`.
- **Done when:**
  - `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS`, with no `waiver-invalid` or `ledger-invalid` line.
  - `git log --format=%B -1 -- parity/game-facts.json | grep '^Gate-Change:'` prints the trailer.
  - `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD` prints `RESULT: PASS`.
  - `npm run -s check:fast` is green.

### E11-T03 · S1 Splash matched to its design

- **Goal:** S1's rules (spec S1) each have a test that names them, and the held splash (frame `s1-splash`) matches its Toybox design in all four variants, signed off. The design shows:
  - the logo tile 152 at -6 degrees with its 7 pt white ring;
  - the game name in Lilita One 50, also in Persian;
  - the tagline in a 290 pt box, written right to left in Persian;
  - the three loader blocks, held still.
- **Skills:** `toybox-screens`, `toybox-visual-parity`, `toybox-components`, `toybox-design-system`, `code-drawn-art-and-icons`, `rtl-and-direction`, `accessibility`, `i18n-strings-and-catalogs`, `navigation-and-routing`, `admob-ads`, `privacy-and-network-audit`, `ios-simulator-build`, `unit-and-component-tests`, `pocket-arcade-product-spec`, `troubleshooting-playbook`.
- **Tests first:**
  1. Print the contract and the spec:
     - `node skills/toybox-screens/scripts/list-screen.mjs S1` lists five testIDs: `splash.screen` (bounds and fill), `splash.logo` (crop-only inside `splash.screen`, hidden from VoiceOver), `splash.game-name` (bounds and text), `splash.tagline` (bounds and text) and `splash.loader` (bounds and crop, labelled `splash.loading.a11y-label`);
     - `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs S1 N8`.
  2. The done check is red: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S1` prints `not-captured` for the four variants (the narrowed T01 run is not a sign-off).
  3. Map each S1 rule to the test that already proves it, and run those tests now. Each must pass. Where a test lacks the spec line, add a `// Spec S1: ...` comment above it, without touching an assertion.
     - "Then goes to S2 on first launch, otherwise straight to Home": `packages/shell/src/navigation/route-guards.test.tsx` ('starts a first launch on the language choice', 'lands on Home when the tutorial is finished') and `navigation-root.test.tsx` ('opens the first-run group on a first launch and Home once it is finished').
     - "Loads the save, settings and language": `packages/shell/src/app/hydrate-save.test.ts` ('starts a first launch from a fresh document ...', 'loads the document a previous launch wrote, synchronously'), and `test/integration/i18n/start-shell-imports.test.ts` (the direction is planned before anything renders).
     - "No ad on launch, ever" (N8): `packages/shell/src/services/ads/ad-gate.test.ts` ('refreshes consent info at launch without showing any form', 'asks nothing at launch for Premium or with ads off') and `consent-moment-flow.test.ts` ('waits while no banner screen is open, so the moment never covers a level').
     - "Never waits for the network": static proof from `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .`. The runtime "network attempts: 0" comes with E16.
  4. New Jest cases (component), red first:
     - In `packages/shell/src/app/startup-splash.test.tsx`: 'tells VoiceOver which game is loading (spec S1)'. The loader's accessible name is the en catalog text "Loading {gameName}…" with "Line Siege" in it; match it loosely, because `t()` isolates the name with FSI and PDI.
     - In the same file: 'says Loading in Persian with the game name kept in Latin letters'. Render with `renderWithShell(..., { language: 'fa' })`. The label is the fa catalog text (`در حال بارگذاری`) and still holds `Line Siege`. End every rendering test with `expect(findInaccessiblePressables(screen.container)).toStrictEqual([])`.
     - Prove each new case can fail (see "How we work"): pass `gameName=""` for a moment and watch the diff.
  5. Run `npx jest packages/shell/src/app/startup-splash.test.tsx packages/shell/src/app/create-startup-splash.test.tsx packages/shell/src/navigation/route-guards.test.tsx --ci --selectProjects unit`.
  6. The look's red is the first full run: `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen S1 --bundle-id io.applander.linesiege --name e07-parity-e11 --tooling .parity/tooling` (four runs). Every FAIL line is a failing test of the look; keep the first run's summary for the report.
- **Build:**
  1. Read the target before changing anything:
     - the references `skills/toybox-visual-parity/assets/reference/lineSiege/light-en/s1-splash.png` and `dark-fa/s1-splash.png` (then `light-fa` and `dark-en`);
     - `frames["s1-splash"].state` in `skills/toybox-visual-parity/assets/frames.json` ("The startup splash held on screen ... Do not continue to Home");
     - `skills/toybox-screens/references/s01-splash.md`.
  2. Make sure the capture is of the current code: after any code change, rebuild with `npm run build:ios:sim -- --app line-siege --variant test --ads off` and reinstall with `xcrun simctl install <parity udid> apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app`. During iteration, a JavaScript-only change may use the bundle swap in toybox-visual-parity's `references/simulator-and-capture.md` ("Fast iteration"). The sign-off captures always run on a full rebuild.
  3. On each FAIL, read `skills/toybox-visual-parity/references/failure-messages.md` for the rule. Then open `.parity/lineSiege/s1-splash/<theme>-<lang>/crops/<testID>.png`, the reference `.layout.json` and, for an inner gap, the mockup CSS in `skills/toybox-visual-parity/assets/design/toybox.html`. Fix the first failing rule of each run, in the printed order: screen reached, scroll, missing, bounds, text, fill, border, text-ink, structure. Then run the screen again. The known S1 causes (`s01-splash.md`, Pitfalls):
     - the column lacks the body's 6 pt top padding: everything sits 3 pt high;
     - the tagline box is not exactly 290 pt with `maxWidth: '100%'`: the centred Persian tagline moves 3.6 pt;
     - `splash.loader` sits on the 14 pt blocks instead of the padded View (58 pt tall, 44 pt bottom padding);
     - the splash root lacks `SafeAreaProvider` with `initialWindowMetrics` (17 pt high, loader 34 pt low) or `DirectionProvider` (the Persian full stop at the wrong end);
     - the loader keeps hopping because the splash reads only the phone's Reduce motion: it must OR in `TEST_ONLY?.isParityMotionFrozen()` (check-screens `splash-held`).

     Fix in `app/startup-splash.tsx`, `app/create-startup-splash.tsx` or the component or token at fault, never in a reference, a tolerance, a mask or a gate. If the same failure survives three fixes, stop and report it with the sheet.
  4. When all four runs pass, look. For each run, read `sheet.png`, every `zoom-*.png` and every `eye-*.png` (listed in the run's `sheets.json`), and answer the seven eye checks: icons, pictures, shadows, alignment, wrapping, direction, feel. For S1, look in particular at:
     - the logo tile's -6 degree tilt and 7 pt ring against `skills/code-drawn-art-and-icons/assets/reference/logos-design.png`;
     - Lilita One for the name in fa as well;
     - the fa tagline's full stop at the left end;
     - the loader blocks standing still;
     - the dark ground and ink.

     Fix every visible difference, then run the screen again. A difference the app truly cannot draw becomes a waiver in `parity/waivers.json` (one element, one rule, its class and reason, the date the owner was told), in its own commit with a `Gate-Change:` trailer. None is expected for S1.
  5. Record the look. For each run, `node skills/toybox-visual-parity/scripts/check-signoff.mjs --draft .parity/lineSiege/s1-splash/<theme>-<lang>` prints the ledger entry; add `--from-ledger` after a rebuild. Paste each entry into `parity/signoff.json` with the answers and any differences, each `fixed` or `waived`.
  6. Commit each fix with its test or its parity red, for example `fix(shell): keep the s1 tagline in its 290 pt box`, with the spec line S1 in the body. Then commit the ledger as `chore(repo): sign off s1 splash against its design`.
- **Design match:** frame `s1-splash` (root `splash.screen`, a phone frame, 5 testIDs). Variants: light-en, light-fa, dark-en and dark-fa, at scroll offset 0, the only offset `run-parity.mjs` plans for a phone frame. References: `skills/toybox-visual-parity/assets/reference/lineSiege/{light-en,light-fa,dark-en,dark-fa}/s1-splash.png`. Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S1`.
- **Done when:**
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S1` prints `RESULT: PASS`, with `splash-held` strict.
  - `npx jest packages/shell/src/app/startup-splash.test.tsx packages/shell/src/app/create-startup-splash.test.tsx packages/shell/src/app/hydrate-save.test.ts packages/shell/src/navigation/route-guards.test.tsx --ci --selectProjects unit` passes.
  - The last full `run-parity.mjs --screen S1 ...` run passed all four runs on a full rebuild.
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S1` prints the `s1-splash` row as `light-en done | light-fa done | dark-en done | dark-fa done`, then `RESULT: PASS`.
  - `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS`.
  - `npm run -s check:fast` is green.

### E11-T04 · S2 Language choice

- **Goal:** On a first launch, S1 hands over to S2 (spec S2, 7.2, N6):
  - The four languages, each in its own script and font: English, Deutsch, فارسی, کوردیی ناوەندی.
  - The phone's language is pre-selected and carries the small gold "Phone language" sticker (+3 degrees) when it is one of the four:
    - fa, and prs (Dari), become Persian;
    - ckb, and ku in Arabic script, become Sorani;
    - ku in Latin script (`ku-TR`, Kurmanji) is not one of the four.

    When the phone's language is not one of the four, English is selected and no sticker shows.
  - Continue is written in the selected language.
  - Continue dispatches `set-language`, which also sets `firstRun.languageChosen`. When the chosen language reads the other way from the current layout, the app awaits `audio.dispose()` and then restarts once in the new direction.
  - The FirstRun group then opens the tutorial by itself; the hook never navigates.
  - S2 is routed, in the slice, and matches `s2-language-choice` in the four variants.
- **Skills:** `toybox-screens`, `toybox-visual-parity`, `toybox-components`, `toybox-design-system`, `code-drawn-art-and-icons`, `i18n-strings-and-catalogs`, `rtl-and-direction`, `navigation-and-routing`, `settings-and-preferences`, `state-stores`, `game-audio-and-haptics`, `react-components-and-hooks`, `accessibility`, `architecture-and-boundaries`, `unit-and-component-tests`, `typescript-and-lint-rules`, `naming-conventions`, `ios-simulator-build`, `pocket-arcade-product-spec`, `git-commits-and-reporting`.
- **Tests first:** Print `node skills/toybox-screens/scripts/list-screen.mjs S2` (18 testIDs, with each part's parity reach) and `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs S2 7.2 N6`.

  Copy each test from `skills/toybox-screens/templates/packages/shell/src/` to the same path before its module. Give each module a typed stub with the same exports and wrong values, so every red is an assertion diff and never `Cannot find module`. Add `// Spec S2 and 7.2: ...` above the first `describe` of each file. The tests:
  - `i18n/create-language-t.test.ts` (unit): speaks the chosen language whatever the app language is ("Weiter" for de); writes numbers in the chosen digits. Stub: `createLanguageT` returns `(key) => key`.
  - `app/use-direction-restart.test.tsx` (hook): disposes audio first, then calls `restartForDirection` in the new direction; logs a failed restart instead of throwing. Stub: the hook returns a no-op.
  - `app/use-parity-opener.test.tsx` (hook): opens the frame's state once on mount, through the handler it is given; does nothing on a normal launch or in a frame that shows another state. Stub: a no-op. S2 does not use it. It lands with S2 because S2 is the first screen in the Shell order whose manifest entry brings it; S4, S11 and S11a import it later.
  - `screens/first-run/use-language-choice-model.test.tsx` (hook):
    - the template's four cases: phone language pre-selected with Continue in that language; English when the phone speaks none of the four; save on Continue and restart only on a direction flip; Sorani from `ku` in Arabic script;
    - a new `it.each` over phone locales (spec 7.2), written as `getLocales()` entries `{ languageCode, languageScriptCode }`. The phone locales fa-IR, ckb-IQ, de-DE and prs-AF are each pre-selected (prs as fa). `ku` with script `Latn` (Kurmanji, ku-TR) and `ku` with no script give `phoneLanguage` `null` and English selected. For the list `[ja, fa]`, the first language the app speaks wins (fa);
    - a new case: a Persian choice on an LTR layout writes the save before it asks for the restart (rtl-and-direction rule 4). Inside the mocked `restartForDirection`, read `stores.settings.getState().settings.language` and expect `'fa'`. That the tutorial opens once a language is chosen is proven by `navigation/route-guards.test.tsx` ('opens the tutorial once a language is chosen'), which this task runs.

    Stub: `phoneLanguageOf` returns `null` and the hook returns `{ selected: 'en', phoneLanguage: null, tSelected: (k) => k, ... }` with no-op handlers.
  - `screens/first-run/language-choice-view.test.tsx` (component):
    - the template's two cases: every S2 testID found, English selected as a radio; Continue in the selected language, choices reported;
    - a new case: the "Phone language" sticker sits inside the phone's row only. With `phoneLanguage: 'de'`, `within(screen.getByTestId('language-choice.language-row.de')).getByTestId('language-choice.phone-badge', { includeHiddenElements: true })` finds it. With `phoneLanguage: null` there is no sticker;
    - a new case: a Persian render (`renderWithShell(..., { language: 'fa' })`) shows the fa title and subtitle, keeps every autonym as written, and passes the audit.

    Every rendering test ends with `expect(findInaccessiblePressables(screen.container)).toStrictEqual([])`. Stub: the view renders only `<ScreenFrame testID="language-choice.screen" />`.
  - Before evidence:
    - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S2` fails `screen-not-built`;
    - once S2 joins `shell-slice.json` (Build step 2), `node skills/navigation-and-routing/scripts/check-navigation.mjs .` fails `[route-not-built]` on `LanguageChoice` until Build step 3 routes it.
- **Build:**
  1. Copy over the stubs, from `skills/toybox-screens/templates/packages/shell/src/` to the same paths. This is S2's manifest entry: `language-choice*`, `use-language-choice-model*`, `use-direction-restart*`, `use-parity-opener*` and `create-language-t*`. The files are:
     - `screens/first-run/language-choice-view.tsx`, `language-choice-screen.tsx` and `use-language-choice-model.ts`;
     - `app/use-direction-restart.ts` and `app/use-parity-opener.ts`;
     - `i18n/create-language-t.ts`.

     Run each test green.
  2. Add S2 to the slice: `"screens": ["S1", "S2"]` in `shell-slice.json`, with its `why` updated. Run `node skills/navigation-and-routing/scripts/check-navigation.mjs .` and keep its red: `[route-not-built]` on `LanguageChoice`.
  3. Route it. In `packages/shell/src/navigation/root-stack.tsx`, replace `LanguageChoice: { screen: NotBuiltScreen, if: useNeedsLanguageChoice }` with `LanguageChoice: { screen: LanguageChoiceScreen, if: useNeedsLanguageChoice }`, importing `LanguageChoiceScreen` from `@e07/shell/screens/first-run/language-choice-screen.tsx`, exactly as navigation-and-routing's `templates/root-stack.tsx` has it. `Tutorial` stays on `TutorialScreen`, and every other route stays as it is. check-navigation now passes.
  4. Run the slice's tests and checks:
     - `npx jest packages/shell/src/screens/first-run packages/shell/src/app/use-direction-restart.test.tsx packages/shell/src/app/use-parity-opener.test.tsx packages/shell/src/i18n/create-language-t.test.ts packages/shell/src/navigation --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/screens/first-run/**/*.ts' --coverageThreshold='{}'`, then `npx tsc --noEmit -p packages/shell` and `npm run -s check:fast`;
     - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S2` (including `borrowed-file`), `node skills/navigation-and-routing/scripts/check-navigation.mjs .`, `node skills/rtl-and-direction/scripts/check-rtl.mjs .`, `node skills/game-audio-and-haptics/scripts/check-audio-haptics.mjs .` (`dispose-before-reload` on `use-direction-restart.ts`), `node skills/i18n-strings-and-catalogs/scripts/check-i18n-code.mjs .`, `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S2`, `node skills/react-components-and-hooks/scripts/check-react-rules.mjs .`, `node skills/accessibility/scripts/check-a11y-code.mjs .`, `node skills/state-stores/scripts/check-stores.mjs .` and `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .`.

     Fix every FAIL line test-first.
  5. Commit tests, code, route and slice together as `feat(shell): add the first-run language choice (S2)`. The body names `Spec S2, 7.2 and N6`. Before committing, run `node skills/tdd-workflow/scripts/check-test-edits.mjs . --staged --message reports/commit-message.txt` and `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged`.
  6. Check it on the simulator:
     - `npm run build:ios:sim -- --app line-siege --variant test --ads off`. A fresh install is a first launch, so `reports/ios/line-siege/smoke-test-off.png` must now show the real S2, not the stand-in with its route name. Open it with the Read tool and look.
     - `node skills/ios-simulator-build/scripts/check-screenshot.mjs reports/ios/line-siege/`.
     - `xcrun simctl install <parity udid> apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app`.
  7. Match the design.
     - Read the references `light-en/s2-language-choice.png` and `dark-fa/s2-language-choice.png`, and `frames["s2-language-choice"].state`. In the en capture English is selected and carries the sticker. In the fa capture the Persian row does, because the render language is the phone's language.
     - Run `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen S2 --bundle-id io.applander.linesiege --name e07-parity-e11 --tooling .parity/tooling` (four runs), and fix the first failing rule of each run as in T03.
     - The known S2 causes (`skills/toybox-screens/references/s02-language-choice.md`, Pitfalls):
       - a body that ends at the safe area clips the Continue key's 6 pt hard shadow: the view needs `ScreenFrame edges={UNDER_HOME_INDICATOR_EDGES}` and `ScreenBody isUnderHomeIndicator`;
       - an autonym in the UI font: pass `language` to AppText;
       - an autonym whose script reads the other way must sit at the end of its row, next to the radio mark (OptionCard does this; the screen passes nothing extra);
       - the sticker is centred on its row;
       - the chosen card is accent and pushed in, with a check in its radio;
       - the hero key's forward icon is at the end and points the reading way.
  8. Look at every sheet, zoom and eye page of the four runs, and answer the seven eye checks. Look in particular at:
     - Vazirmatn for فارسی and کوردیی ناوەندی in the en capture;
     - the globe art tile's -5 degree tilt;
     - the sticker's +3 degrees;
     - the forward icon mirrored in fa;
     - the radio marks at the row end in both directions.

     Record each run with `check-signoff.mjs --draft .parity/lineSiege/s2-language-choice/<theme>-<lang>` into `parity/signoff.json`, then commit it as `chore(repo): sign off s2 language choice against its design`. Commit each fix, test-first, before the ledger.
- **Design match:** frame `s2-language-choice` (root `language-choice.screen`, a phone frame, 18 testIDs, each OptionCard with its `.label` and `.radio` parts). Variants: light-en, light-fa, dark-en and dark-fa, at scroll offset 0. References: `skills/toybox-visual-parity/assets/reference/lineSiege/{light-en,light-fa,dark-en,dark-fa}/s2-language-choice.png`. Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S2`.
- **Done when:**
  - The Jest run of Build step 4 passes, and `npx tsc --noEmit -p packages/shell` and `npm run -s check:fast` are green.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S2` prints `RESULT: PASS`.
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs .` prints `RESULT: PASS`, and no line names `LanguageChoice`.
  - `node skills/game-audio-and-haptics/scripts/check-audio-haptics.mjs .` prints `RESULT: PASS` with only the toggle's `[ui-feedback]` slice line.
  - `node skills/rtl-and-direction/scripts/check-rtl.mjs .`, `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S2` and `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` print `RESULT: PASS`.
  - The smoke screenshot shows S2, and `check-screenshot.mjs` prints `RESULT: PASS`.
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S2` prints the `s2-language-choice` row as `light-en done | light-fa done | dark-en done | dark-fa done`, then `RESULT: PASS`.

### E11-T05 · S3 Ad consent and tracking

- **Goal:** The consent moment follows spec S3, 4.2 points 2 and 3, O1 and L10, and its intro matches `s3-consent-moment` in the four variants:
  - the Shell's intro appears only right before Google's form, so its footnote ("Google's form opens next") is always true;
  - Apple's prompt comes after the form, while the player has not answered it. When no form is due, the prompt appears on its own with the app's sentence (`consent.tracking.usage-description`) and no intro;
  - declined, restricted or unavailable tracking still serves ads;
  - none of it with ads off, for Premium, offline, before the tutorial, during a level, or in the held parity frame, which asks neither Google nor Apple.

  S3 joins the slice. There is nothing new to copy, because S3 is not a route.
- **Skills:** `toybox-screens`, `toybox-visual-parity`, `admob-ads`, `toybox-components`, `toybox-design-system`, `code-drawn-art-and-icons`, `i18n-strings-and-catalogs`, `rtl-and-direction`, `accessibility`, `privacy-and-network-audit`, `unit-and-component-tests`, `ios-simulator-build`, `pocket-arcade-product-spec`, `git-commits-and-reporting`.
- **Tests first:**
  1. Print `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs S3 4.2 15.4` and `node skills/toybox-screens/scripts/list-screen.mjs S3`. The second lists 9 testIDs: `consent.screen`, `consent.art` (crop-only), `consent.title`, `consent.body`, `consent.detail-note` with its `.icon` and `.label`, `consent.continue-button` and `consent.footnote`.
  2. Add S3 to `shell-slice.json` (`"screens": ["S1", "S2", "S3"]`) first, then run the checks whose S3 rules were slice SKIP lines until now:
     - `node skills/toybox-visual-parity/scripts/check-harness.mjs .`: the consent cover `app/consent-moment.tsx` draws `<ParityLaunchMarker />` as its first child (`[harness-launch-marker]`), and the launch member `isConsentMomentHeld` reaches the consent moment host (`[harness-not-wired]`);
     - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S3`.

     Also run the order checks that were already strict: `node skills/admob-ads/scripts/check-ads.mjs .` and `node skills/admob-ads/scripts/check-ad-behaviour.mjs .`. The latter runs the consent-order and consent-moment-flow cases, for example 'prepareAds with consent: intro, form, ATT, then initialize', 'prepareAds where consent is not required (no intro, no form, ATT still first)', 'prepareAds when the player declines ATT now: ads still initialize' and 'the held S3 parity frame asks neither Google nor Apple'. Every FAIL line is a red to fix; record which SKIP lines went away.
  3. Map each S3 rule to the Jest case that proves it, and run them with `npx jest packages/shell/src/services/ads packages/shell/src/app/consent-moment.test.tsx --ci --selectProjects unit`:

     | S3 rule | Proving case |
     |---|---|
     | Intro, then Google's form, then Apple's prompt, then initialize and preload | `services/ads/ad-gate.test.ts` 'shows the consent moment, the form, the ATT prompt, then initializes and preloads'; `app/consent-moment.test.tsx` 'shows S3 over Home, then Google form, ATT, initialize and preload after Continue' |
     | No intro where no form is due; Apple's prompt alone (L10) | `ad-gate.test.ts` 'shows no consent moment and no form where consent is not required, but still asks ATT'; `consent-moment-flow.test.ts` 'shows no moment where consent is not required or was already given (ATT still first)' |
     | Declined or restricted tracking still serves ads | `ad-gate.test.ts`, the `it.each` over `'denied'`, `'restricted'` and `'unavailable'` |
     | No prompt when consent allows no ads | `ad-gate.test.ts` 'keeps the SDK uninitialized and asks no ATT when consent does not allow ad requests' |
     | Skipped during the tutorial, for Premium, offline, with ads off | `ad-gate.test.ts` 'skips the consent moment, the form and ATT %s'; `consent-moment-flow.test.ts` 'asks nothing, ATT included, %s' |
     | Never over a level; the prompt only over a banner screen | `consent-moment-flow.test.ts` 'waits while no banner screen is open, so the moment never covers a level', 'asks ATT only over a banner screen: a player who left for a level is asked back on Home' |
     | Shown later when the player comes online | `consent-moment-flow.test.ts` 'tries again when the player comes online on a banner screen' |
     | The held parity frame asks nobody | `consent-moment.test.tsx` 'holds the S3 parity frame on screen and asks neither Google nor Apple'; `consent-moment-flow.test.ts` 'holds the S3 parity frame: the moment at once, and neither Google nor Apple is asked' |
     | Apple's sentence is ours, in four languages | `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S3` (`system-text-missing`, `system-text-plain` for `consent.tracking.usage-description`); Info.plist proven by E10's `check-sim-app` `att-string` |

     Write a new failing case only where a rule has no proving case. Put it in the owner's test file, red first, then fix the code. Never bend the flow to make a capture pass.
  4. New view cases in `packages/shell/src/screens/consent/consent-intro-screen.test.tsx` (component; spec S3 and L10):
     - 'shows the S3 texts exactly as the copy deck writes them': title "Ad privacy", the lead, the note label "Ads come from Google. The game itself collects no data." (inside `consent.detail-note`), the hero key "Choose options", and the footnote "Google’s form opens next. You can change your choice any time in Settings.";
     - 'writes the intro in Persian, right to left': `renderWithShell(..., { language: 'fa' })` shows the fa title `حریم خصوصی تبلیغات` and the fa key `انتخاب گزینه‌ها`.

     Both end with the `findInaccessiblePressables` audit. Prove each can fail (see "How we work"): swap the footnote key for `consent.intro.body` for a moment and watch the diff.
- **Build:**
  1. Fix every red from steps 2 to 4 in the file that owns it: `app/consent-moment.tsx`, `services/ads/consent-moment-flow.ts`, `services/ads/ad-gate.ts` or `screens/consent/consent-intro-screen.tsx`. Each fix is test-first.
  2. Run `node skills/toybox-screens/scripts/check-screens.mjs . --screen S3`, `node skills/toybox-visual-parity/scripts/check-harness.mjs .`, `node skills/admob-ads/scripts/check-ads.mjs .`, `node skills/admob-ads/scripts/check-ad-behaviour.mjs .`, `node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S3` and `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .` until each prints `RESULT: PASS`.
  3. Commit as `test(shell): pin the s3 intro texts and add s3 to the slice`, holding the view cases, `shell-slice.json` and any fix. The body names `Spec S3, 4.2, 15.4; O1 and L10`.
  4. Match the design.
     - Read `light-en/s3-consent-moment.png` and `dark-fa/s3-consent-moment.png`, and `frames["s3-consent-moment"].state`. In the held frame, consent is required, the player is online, the tutorial is done and the player is not Premium. The host shows the intro and holds it.
     - Look at `s3-google-s-form.png` too. It is mock-only: Google draws that sheet, so it is never built, captured or signed.
     - Rebuild and reinstall as in T03, then run `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen S3 --bundle-id io.applander.linesiege --name e07-parity-e11 --tooling .parity/tooling`. That is four runs of `s3-consent-moment`, plus a `mock-only` line for `s3-google-s-form`.
     - A capture with Apple's or Google's dialog on screen fails `system-alert`. That would mean the held frame asked someone: fix the flow test-first, never the capture.
     - The S3 layout (`s03-consent.md`):
       - two grows centre the text block between the top and the key;
       - the shield art tile on gold paper;
       - the `title` 30 and `lead` 18 roles;
       - the note panel with its `info` icon;
       - the hero key with its forward icon at the end;
       - the 13 pt muted caption under it.
  5. Look at every sheet, zoom and eye page of the four runs and answer the seven eye checks. Look in particular at the shield art and the info icon, the forward icon mirrored in fa, the caption wrapping in fa, and the dark gold paper. Then record each run with `check-signoff.mjs --draft .parity/lineSiege/s3-consent-moment/<theme>-<lang>` into `parity/signoff.json`, and commit it as `chore(repo): sign off s3 consent intro against its design`.
- **Design match:** frame `s3-consent-moment` (root `consent.screen`, a phone frame, 9 testIDs, the held moment). Variants: light-en, light-fa, dark-en and dark-fa, at scroll offset 0. References: `skills/toybox-visual-parity/assets/reference/lineSiege/{light-en,light-fa,dark-en,dark-fa}/s3-consent-moment.png`. `s3-google-s-form` is mock-only: looked at, never compared. Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S3`.
- **Done when:**
  - `npx jest packages/shell/src/services/ads packages/shell/src/app/consent-moment.test.tsx packages/shell/src/screens/consent --ci --selectProjects unit` passes.
  - `node skills/admob-ads/scripts/check-ads.mjs .` and `node skills/admob-ads/scripts/check-ad-behaviour.mjs .` print `RESULT: PASS`.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S3` and `node skills/toybox-visual-parity/scripts/check-harness.mjs .` print `RESULT: PASS`, and no check-harness SKIP line names S3.
  - `node -e "for (const v of ['light-en','light-fa','dark-en','dark-fa']) { if (require('./.parity/lineSiege/s3-consent-moment/' + v + '/run.json').systemAlert !== null) process.exit(1) }"` exits 0.
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S3` prints the `s3-consent-moment` row as `light-en done | light-fa done | dark-en done | dark-fa done`, the `mock-only` row for `s3-google-s-form`, then `RESULT: PASS`.
  - `npm run -s check:fast` is green.

### E11-T06 · Prove the first-run screens

- **Goal:** Every check that judges S1, S2 and S3 holds at once on the branch, and nothing else moved. Every remaining SKIP line names a screen outside the slice or a later Shell step, never S1, S2 or S3. The texts are the copy deck's, and any fa or ckb change is listed for the owner.
- **Skills:** `toybox-screens`, `toybox-visual-parity`, `navigation-and-routing`, `rtl-and-direction`, `i18n-strings-and-catalogs`, `admob-ads`, `accessibility`, `toybox-components`, `toybox-design-system`, `code-drawn-art-and-icons`, `react-components-and-hooks`, `state-stores`, `game-audio-and-haptics`, `performance-budgets`, `privacy-and-network-audit`, `architecture-and-boundaries`, `ios-simulator-build`, `unit-and-component-tests`, `typescript-and-lint-rules`, `naming-conventions`, `pocket-arcade-product-spec`, `troubleshooting-playbook`.
- **Tests first:** Nothing new: the checks are the tests. A red check becomes a failing Jest case in the layer that owns the cause before its fix, or a parity FAIL line for a look fix. A fix to a screen means a new capture and a new sign-off of that screen (T03 to T05, steps "match" and "look").
- **Build:**
  1. Run every check from the repo root into one file, so the SKIP lines can be read together:
     ```sh
     mkdir -p reports/e11
     { node skills/toybox-screens/scripts/check-screens.mjs . --screen S1 --screen S2 --screen S3
       node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S1 --screen S2 --screen S3
       node skills/toybox-visual-parity/scripts/check-harness.mjs .
       node skills/navigation-and-routing/scripts/check-navigation.mjs .
       node skills/rtl-and-direction/scripts/check-rtl.mjs .
       node skills/i18n-strings-and-catalogs/scripts/check-i18n-code.mjs .
       node skills/i18n-strings-and-catalogs/scripts/check-catalogs.mjs .
       node skills/i18n-strings-and-catalogs/scripts/copy-deck.mjs check . --screen S1 --screen S2 --screen S3 --game line-siege
       node skills/admob-ads/scripts/check-ads.mjs .
       node skills/admob-ads/scripts/check-ad-behaviour.mjs .
       node skills/accessibility/scripts/check-a11y-code.mjs .
       node skills/accessibility/scripts/check-contrast.mjs .
       node skills/toybox-components/scripts/check-components.mjs .
       node skills/toybox-design-system/scripts/check-design-system.mjs .
       node skills/code-drawn-art-and-icons/scripts/check-icons-and-logos.mjs .
       node skills/react-components-and-hooks/scripts/check-react-rules.mjs .
       node skills/state-stores/scripts/check-stores.mjs .
       node skills/game-audio-and-haptics/scripts/check-audio-haptics.mjs .
       node skills/performance-budgets/scripts/check-perf-code.mjs .
       node skills/privacy-and-network-audit/scripts/audit-repo.mjs .
       node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .
       node skills/ios-simulator-build/scripts/check-sim-setup.mjs .
       node skills/unit-and-component-tests/scripts/check-test-code.mjs .
       node skills/tdd-workflow/scripts/check-tests.mjs .
       node skills/typescript-and-lint-rules/scripts/check-source.mjs .
       node skills/naming-conventions/scripts/check-file-names.mjs .
       node skills/naming-conventions/scripts/check-code-names.mjs .
       node skills/pocket-arcade-product-spec/scripts/check-spec-refs.mjs .
       node skills/troubleshooting-playbook/scripts/check-known-pitfalls.mjs .
       node skills/quality-gates/scripts/check-gate-wiring.mjs .
     } > reports/e11/gates.txt 2>&1
     ```
     Then read it with `grep -E '^(FAIL|RESULT)' reports/e11/gates.txt`.
  2. Fix every FAIL line test-first, in its owner's layer, and run the list again.
  3. Check the texts:
     - `npm run i18n:verify`;
     - `git diff --stat main...HEAD -- packages/shell/src/i18n/catalogs apps/line-siege/src/i18n` is expected to print nothing. Any fa or ckb line that did change goes into the report's text-change block for the owner's review (O6, never waited for).
  4. Confirm the slice and the route: `node -e "console.log(require('./shell-slice.json').screens.join(','))"` prints `S1,S2,S3`.
- **Done when:**
  - `grep -c '^RESULT: PASS' reports/e11/gates.txt` equals the number of checks run (30), and `grep -E '^(FAIL|RESULT: FAIL)' reports/e11/gates.txt` prints nothing.
  - `grep -E '^SKIP .*\bS[123] not in shell-slice' reports/e11/gates.txt` prints nothing. Every SKIP line names S4 to S15, or a later step's script target (e2e:ios, screenshots:ios, release:ios).
  - In particular:
    - check-navigation has no `LanguageChoice` line;
    - check-harness has no S1, S2 or S3 line;
    - check-audio-haptics has only the toggle's `[ui-feedback]` line;
    - check-perf-code has only `SKIP packages/shell/src/screens/home/use-home-model.ts [perf-layer] S4 not in shell-slice.json`.
  - `npm run i18n:verify` passes, and the text diff is empty or listed for the owner.
  - `npx tsc --noEmit -p packages/shell`, `npm run -s check:fast` and `npm run test:coverage` are green.
  - `npm run verify` ends with `verify: 11 steps passed, 1 with SKIP lines`, its only SKIP line being knip's `[knip-exports]`.

### E11-T07 · Simplify, code review, re-run the gates and merge

- **Goal:** The branch is simplified and reviewed, every confirmed finding is fixed test-first, every changed screen is captured and signed off again, the evidence report is written, and the branch is merged.
- **Skills:** `toybox-visual-parity`, `toybox-screens`, `admob-ads`, `ios-simulator-build`, `pocket-arcade-product-spec`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`.
- **Tests first:** Every confirmed `/code-review` finding, and every `/simplify` change that alters behaviour, first gets a failing test that shows the problem:
  - a Jest case in the owner's test file: `use-language-choice-model.test.tsx`, `language-choice-view.test.tsx`, `consent-intro-screen.test.tsx`, `consent-moment.test.tsx`, `ad-gate.test.ts`, `startup-splash.test.tsx` or `create-startup-splash.test.tsx`;
  - or, for a look change, a parity FAIL line.

  A refactor that keeps behaviour needs no new test, but every existing test stays green and unedited.
- **Build:** Follow "Close the epic" below, steps 1 to 5. In addition:
  1. If any file a screen renders changed after its sign-off (the view, its model, a component or token it uses), rebuild and reinstall on `e07-parity-e11`, then run `run-parity.mjs --screen <S1|S2|S3> ...` again. Redraft each run with `check-signoff.mjs --draft <run-dir> --from-ledger`, look at every sheet again (the eye checks reopen), update `parity/signoff.json`, and rerun `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S1 --screen S2 --screen S3`.
  2. Re-run T06's list into `reports/e11/gates.txt`, plus these history checks, all printing `RESULT: PASS`:
     - `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD`;
     - `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD`.
  3. Write the report: copy `skills/git-commits-and-reporting/templates/evidence-slice.md` to `reports/evidence-<YYYY-MM-DD>-e11-first-run-screens.md` and fill it in only from the files in `reports/` and `.parity/`. It holds:
     - **The outcome, in players' words.** The first launch now shows the game's splash, then lets a Persian or Sorani speaker pick their language with one tap, and the ad-privacy intro appears only right before Google's form.
     - **Design match.** One line per frame (`s1-splash`, `s2-language-choice`, `s3-consent-moment`): the reference used, the four variants passed, what was checked by eye, and the fixes made on the way. Attach each frame's dark fa sheet: `.parity/lineSiege/<frame>/dark-fa/sheet.png`.
     - **Waivers.** Every waiver added for these frames, with its class, reason and Gate-Change commit (none expected), plus the pre-listed ones copied in T02.
     - **Design questions**, if any.
     - **Not tested or not verified:**
       - the direction flip on the device and the first-launch journey (E16 flows);
       - the real Google form and Apple prompt on an `ADS_MODE=test` build (the ads smoke test, E17);
       - the de and ckb parity variants (before a release, E17);
       - S1's cold-start time (E16).
     - **Owner steps (not blocking):** the fa and ckb review of any changed text (none expected), the Line Siege play-test, and listening to the sound previews.
  4. When the session's captures are done, shut down this epic's simulator by its UDID: `xcrun simctl shutdown <parity udid>`. Never `all`, never another session's simulator.
- **Done when:**
  - Every T06 "Done when" holds again after the fixes, and `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S1 --screen S2 --screen S3` prints `RESULT: PASS` against the final build.
  - `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD` and `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD` print `RESULT: PASS`.
  - `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e11-first-run-screens.md --kind slice` prints `RESULT: PASS`.
  - The branch is merged into `main` with `--no-ff` and deleted (`git branch -d epic/e11-first-run-screens && git push origin --delete epic/e11-first-run-screens`).

## Close the epic

1. Re-run every task's "Done when" and `npm run verify`; all green.
2. Run `/simplify` over the branch's changes (`git diff main...HEAD`). Apply its fixes; where behaviour changes, test first. Then run `npm run verify` again.
3. Run `/code-review` on the branch. Fix every confirmed finding test-first (a failing test that shows the problem, then the fix). Then run `npm run verify` again.
4. Write the epic's evidence report (git-commits-and-reporting, slice form) and check it with `node skills/git-commits-and-reporting/scripts/check-report.mjs <report> --kind slice`.
5. Merge: `git switch main && git merge --no-ff epic/e11-first-run-screens && git push origin main`, then delete the branch. The push to `origin` needs the owner's word in this session (git-commits-and-reporting rule 5); without it, `main` stays local and the report says so.
