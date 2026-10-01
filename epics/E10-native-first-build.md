# E10 · Native composer, plugins and the first Release simulator build

| | |
|---|---|
| Branch | `epic/e10-native-first-build` |
| Depends on | E09 |
| Spec | N3 (our code makes no network requests), N9 (app icon and splash drawn in code), N10 (the save kill test, owed since E04); S1 (start-up under 1 second: the native cold-start module); 4.2 (Apple's tracking prompt text, the privacy manifest); 7.6 (all fonts bundled in the app); 8.13 (the network audit); 15.3 (static audit layers), 15.6 (killing the app loses at most the move in progress); owner decisions O1 (tracking prompt) and O4 (app ids); lead decision L14 (owner-placeholder results) |
| Build order | Shell step 8 |
| Tasks | 9 |

## Current state

Shell step 7 passed in E09. Concretely:

- `apps/line-siege` is wired: `game.config.ts` (bundle id `io.applander.linesiege`, Premium `io.applander.linesiege.premium`, and the scaffold's placeholder AdMob ids and `example.com` links until owner steps G5 and G3), the one-statement `app.config.ts`, the 3-line `index.ts`, `metro.config.js` with the variant cache key, the five Toybox TTFs and their OFL files in `assets/fonts/`, `LOGO_ART` in `src/art/logo-art.ts` and `PALETTE` in `src/theme/palette.ts`.
- `packages/shell` holds the save layer, the services behind ports, the stores, the four Shell catalogs (each with `consent.tracking.usage-description`), the theme and components, the art, the composition root and the boot (`app/start-shell.ts`), the JS half of the perf layer (`app/perf/`, `markJsEntry()`), the debug kit with the network guard (`screens/debug/network-guard.ts`), and the navigator, where S1 is built and every other route still shows its `NotBuiltScreen` stand-in. `shell-slice.json` lists `"screens": ["S1"]`.
- `packages/shell/src/config/` still has the bootstrap's phase-0 `with-shell.ts` and its test: no privacy manifest, no native plugin list, no art. `splash-grounds.ts` is the empty template.
- Installed native modules (each in `apps/line-siege` with a Shell peer and a root override): expo-sqlite, expo-constants, expo-haptics, expo-network, expo-tracking-transparency, expo-iap, react-native-audio-api, react-native-google-mobile-ads, expo-localization and the React Navigation set.
- `packages/tooling` has the gate tooling (`quality/`, `git/`, `deps/`, `audit/audit-licenses.ts`), and the i18n, sims, levels, ads, audio, art (`render-art.ts` included) and visual tooling.

Not there yet:

- `packages/shell/src/config/shell-plugins.ts`, `packages/shell/src/config/privacy-manifest.ts` and the final `with-shell.ts`.
- The packages `expo-font` and `expo-splash-screen`.
- The shell-native module: `packages/shell/expo-module.config.json` and `packages/shell/ios/`.
- `apps/line-siege/assets/generated/` (app icon and splash PNGs); `splash-grounds.ts` has no Line Siege entry.
- The audit tooling (`packages/tooling/src/audit/` apart from `audit-licenses.ts`, and `packages/tooling/network-audit/`) and the simulator build tooling (`packages/tooling/src/build/`, `src/ios/`, `src/e2e/maestro-args.ts`).
- Any prebuild (`apps/line-siege/ios/`) or simulator build. The app has never run natively, and the save kill test is still owed.

Checks at the start:

- These pass with not-yet-due SKIP lines (`due at Shell step 8: packages/shell/src/config/shell-plugins.ts not yet created`) that this epic removes: `check-design-system.mjs .` `[font-plugin]`, `check-ads.mjs .` `[plugin-entry]` and `[att-plugin]`, `check-premium.mjs .` `[plugin-entry]`, `check-audio-haptics.mjs .` `[audio-plugin]`, `check-perf-code.mjs .` `[perf-layer]` for `packages/shell/ios`. Their slice lines (Home's cold-start mark, the S11/S6 toggle feedback, and the screen lines of the other checkers) stay until E12-E15.
- `check-gate-wiring.mjs .` passes with six script-target SKIP lines: audit:network, audit:privacy and build:ios:sim (due at step 8), e2e:ios and screenshots:ios (step 10), release:ios (step 11).
- `npm run -s check:fast` and `npm run test:coverage` are green. `npm run verify` stops at `audit:network`, the one step that quality-gates' "When verify is green" table expects to be red before Shell step 8, because its target `packages/tooling/src/audit/audit-network.ts` is missing.

## What we will do

This is Shell step 8: everything the pilot app needs before it can be built natively, then its first Release simulator builds.

- **Audit tooling first.** Copy the privacy and network audit tooling. It gives `audit:network`, `audit:privacy` and `audit:licenses` their targets, so `npm run verify` (which the pre-push hook runs) is green from the first commit. It also lets the simulator build run `audit:privacy` after every prebuild. This task comes first, ahead of the build-order text, so that every task of the epic can be pushed.
- **One composer, one plugin list.** Replace the bootstrap's phase-0 `withShell` with architecture-and-boundaries' final composer and `shellPlugins`, the single list of native plugins. They land in one commit with the exact trailer `Spec-Change: with-shell final composer (phase 0 placeholder replaced)`. The same task installs `expo-font`, so the five Toybox fonts are embedded, and adds the app's privacy manifest, Apple's tracking prompt text in en, de, fa and ckb, and the app-id guard.
- **Native cold-start module.** Add the Swift `ProcessStartModule`, the native half of the cold-start layer, so the step-10 E2E run can measure cold start from process start.
- **App icon and splash.** Install `expo-splash-screen`. Draw the pilot's app icon and native splash in code with `render-art.ts`, and commit the PNGs.
- **Simulator build tooling.** Add `npm run build:ios:sim`.
- **First builds.** Make a Release simulator build of the test variant, then of the store variant straight after without clearing any cache, which proves that test-only code is absent from the store build. Then run the save kill test, and run the privacy-manifest audit and the network audit (with its pod and config layers) against the real prebuild.

No task in this epic builds or changes a screen, so no design frame is signed off here.

Not in this epic:

- Matching S1 to its Toybox frame `s1-splash`, and building S2 and S3 (E11). The other screens (E12-E15).
- The E2E flows, the runtime network layer (layer F: "network attempts: 0" and the socket sampler), the debug deep link, the first simulator cold-start numbers and their baseline, the mid-level kill flow and the screenshot matrix (E16).
- The StoreKit harness, the release audits (`audit-app-bundle.mjs`, `check-store-artifact.mjs`), the archive and TestFlight (E17).
- The Android port (E18).
- Owner steps G3 and G5, the real links and AdMob ids. Until the owner supplies them, the store build's check ends with the G3 owner-placeholder lines by design (L14), and nothing in this epic waits for them.

## Final state

- [ ] The audit tooling is in place and the static N3 audit passes: `npx jest packages/tooling/src/audit --ci --selectProjects unit` passes and `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .` prints `RESULT: PASS`.
- [ ] There is one composer and one plugin list: `npx jest packages/shell/src/config --ci --selectProjects unit` passes. `git log --oneline --grep 'Spec-Change: with-shell final composer (phase 0 placeholder replaced)'` shows the swap commit.
- [ ] Every plugin resolves: `(cd apps/line-siege && APP_VARIANT=test ADS_MODE=off npx expo config --json)` prints a config whose `plugins` hold the variant marker, expo-sqlite, expo-localization, expo-font, expo-iap, react-native-google-mobile-ads, expo-tracking-transparency, react-native-audio-api and expo-splash-screen, with no "Failed to resolve plugin" error.
- [ ] The app icon and splash are drawn in code and committed: `node packages/tooling/src/art/render-art.ts --app line-siege --check` exits 0, and `node skills/code-drawn-art-and-icons/scripts/check-app-art.mjs . --app line-siege` prints `RESULT: PASS`.
- [ ] The plugin-list rules are strict now: `check-ads.mjs .` (admob-ads), `check-premium.mjs .` (premium-purchase) and `check-design-system.mjs .` (toybox-design-system) each print `RESULT: PASS` with no SKIP line.
- [ ] `node skills/performance-budgets/scripts/check-perf-code.mjs .` prints `RESULT: PASS` with only `SKIP packages/shell/src/screens/home/use-home-model.ts [perf-layer] S4 not in shell-slice.json`. `node skills/game-audio-and-haptics/scripts/check-audio-haptics.mjs .` prints `RESULT: PASS` with only the toggle's `[ui-feedback]` slice line (`S11 not in shell-slice.json (nor S6): ...`).
- [ ] `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with only the e2e:ios and screenshots:ios (step 10) and release:ios (step 11) script-target SKIP lines.
- [ ] The test build works: `npm run build:ios:sim -- --app line-siege --variant test --ads off` ran from a clean prebuild and printed `ready (...)` with its screenshot path. `node skills/ios-simulator-build/scripts/check-sim-app.mjs --app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app --variant test --ads off --game line-siege` prints `RESULT: PASS`, which covers the tracking text in en, de, fa and ckb, the id `io.applander.linesiege`, the privacy manifest and the 120 Hz key. `node skills/ios-simulator-build/scripts/check-screenshot.mjs reports/ios/line-siege/` prints `RESULT: PASS`, and the screenshot was opened and looked at.
- [ ] All five fonts are embedded: `plutil -extract UIAppFonts json -o - <test App.app>/Info.plist` lists `LilitaOne.ttf`, `Rubik-Regular.ttf`, `Rubik-Bold.ttf`, `Vazirmatn-Regular.ttf` and `Vazirmatn-Bold.ttf`.
- [ ] The native module is linked: `grep -c E07Shell apps/line-siege/ios/Podfile.lock` prints 1 or more after the prebuild, and the Release build compiled it.
- [ ] The store build carries no test-only code. Its `check-sim-app.mjs ... --variant store --ads off --game line-siege` run prints no `test-code`, `constants-variant`, `bundle-id` or `att-string` line. Its only FAIL lines are the two G3 `owner-placeholder` lines (privacy host `example.com`, support address `support@example.com`), followed by `OWNER STEPS PENDING: G3` and `RESULT: FAIL`: the expected result until owner step G3. `grep -a -c SHELL_TEST_BUILD_ONLY <store App.app>/main.jsbundle` prints 0.
- [ ] The kill test passes (15.6): `node skills/save-persistence-and-migrations/scripts/kill-test.mjs --create --app <test App.app> --bundle-id io.applander.linesiege --game-id line-siege --repo .` prints `RESULT: PASS`.
- [ ] The privacy manifest and the network audit pass against the real prebuild: `node skills/privacy-and-network-audit/scripts/audit-privacy-manifest.mjs .` prints `RESULT: PASS`. `npm run audit:network` prints `audit:network: 0 failure(s)` with its pod and config layers run. `node skills/privacy-and-network-audit/scripts/audit-bundle.mjs --export dist-audit/line-siege --variant store .` prints `RESULT: PASS`.
- [ ] `ios/` is never committed: `git ls-files apps/line-siege/ios` prints nothing.
- [ ] `npm run verify` is green and ends with `verify: 11 steps passed, 1 with SKIP lines`. Its only SKIP line is knip's `[knip-exports]` line, which stays while `shell-slice.json` exists.
- [ ] The slice report passes: `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e10-native-first-build.md --kind slice` prints `RESULT: PASS`.

## Skills to load

Always: `pocket-arcade-index`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`.

For this epic:

- `pocket-arcade-product-spec`: prints the exact spec lines (N3, N9, N10, S1, 4.2, 7.6, 8.13, 15) for commit bodies and the report, and checks spec citations.
- `architecture-and-boundaries`: the final `with-shell.ts` and `shell-plugins.ts` pair with their tests, the app-id guard, build variants, and the layout and boundary checks.
- `dependency-management`: installs `expo-font` and `expo-splash-screen` under the pinning policy (Shell peer, root override, `npx expo install` with the table spec), and the dependency policy check.
- `privacy-and-network-audit`: the audit tooling, the network baselines, the Shell's `privacy-manifest.ts`, `audit-repo`, `audit-privacy-manifest` and `audit-bundle`.
- `performance-budgets`: the shell-native cold-start module and `check-perf-code`, including the 120 Hz plist key.
- `code-drawn-art-and-icons`: `render-art.ts`, the app icon and splash PNGs, `splash-grounds.ts`, `check-app-art`.
- `ios-simulator-build`: the build tooling, `npm run build:ios:sim`, `check-sim-setup`, `check-sim-app`, `check-screenshot`, the e07- simulator rules.
- `toybox-design-system`: the five fonts in the `expo-font` entry and `check-design-system` (`[font-plugin]`).
- `admob-ads`: the AdMob and tracking-prompt plugin entries and `check-ads` (`[plugin-entry]`, `[att-plugin]`).
- `premium-purchase`: the bare `expo-iap` entry and `check-premium` (`[plugin-entry]`).
- `game-audio-and-haptics`: `AUDIO_API_PLUGIN`, `check-audio-haptics` (`[audio-plugin]`), and the prebuild facts (no background audio, no microphone text).
- `i18n-strings-and-catalogs`: the tracking prompt text comes from the four Shell catalogs; `npm run i18n:verify`.
- `rtl-and-direction`: expo-localization gets `supportedLocales` only, never `supportsRTL` or `forcesRTL`; `check-rtl`.
- `save-persistence-and-migrations`: the kill test, `inspect-save`, `check-save-layer`.
- `golden-tests`: proves no golden changed on this branch (`check-goldens`, `check-golden-changes`).
- `troubleshooting-playbook`: `check-known-pitfalls` before the first build and `find-fix` on any failing build log.
- `unit-and-component-tests`: the Jest projects and commands, `check-test-setup` and `check-test-code`.
- `typescript-and-lint-rules`: the copied TypeScript stays within the strict config and size limits (`check-source`, `check-configs`).
- `naming-conventions`: the names of the new files (`check-file-names`, `check-code-names`).

## How we work in this epic

1. Branch: `git switch main && git pull && git switch -c epic/e10-native-first-build`. Push the branch after each task (`git push -u origin epic/e10-native-first-build`), but only once the owner has given the word to push in this session (git-commits-and-reporting rule 5). Without it, the commits stay local and the report says so. Never bypass the pre-push hook.
2. Test first, always. Write each task's "Tests first" items, run them and watch them fail for the right reason, write the minimum code to pass, then refactor. Never weaken or edit a test to make it pass.
3. Commit each task in Conventional Commits form, with the trailers the skills ask for (Gate-Change:, Spec-Change:). `npm run -s check:fast` must be green before every commit.
4. Screens: a task that builds or changes a screen is not done until the app's capture matches the Toybox design screenshot for every frame it names, in light-en, light-fa, dark-en and dark-fa at every scroll offset, and check-signoff passes for those frames.
5. Stop and ask the owner only at a step marked **Owner**.

## Tasks

### E10-T01 · Privacy and network audit tooling

- **Goal:** Give the no-network promise (N3, 8.13, 15.3) its static audit before any native code is built. `npm run audit:network`, `audit:privacy` and `audit:licenses` get their target files, so `npm run verify` and the pre-push hook are green from this commit on. `npm run build:ios:sim` can then run `audit:privacy` after each prebuild; its preflight stops with exit 2 when that target is missing.
- **Skills:** `privacy-and-network-audit`, `quality-gates`, `dependency-management`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:** Copy each test from privacy-and-network-audit's `templates/packages/tooling/src/audit/` before its module. Give each module a typed stub (same exports, wrong values), so the red run is an assertion diff and never `Cannot find module`. Then run `npx jest packages/tooling/src/audit --ci --selectProjects unit` and keep the red lines. The tests:
  - `network-baseline.test.ts`: findings the reasoned baseline explains pass; a new category, a new package or a stale entry is reported.
  - `network-js-layer.test.ts` (layer B): first-party network code is reported directly; only `external-links.ts` is exempt, and only for its URLs; localhost is ignored.
  - `network-native-layer.test.ts` (layer C): finds packages where npm hoisted them, stops at the podspec folder, and attributes each finding to its own module.
  - `network-pods-layer.test.ts` (layer D): reads the trunk pods of a `Podfile.lock` and fails any pod outside the three allowed ones.
  - `network-config-layer.test.ts` (layer E): accepts the bare `expo-iap` entry and `updates.enabled: false`, and needs the tracking plugin and its text in en, de, fa and ckb when ads are enabled (O1).
  - `network-runtime-layer.test.ts` (layer F helpers): keeps only non-loopback connections and samples every running copy of the app.
  - `privacy-manifest.test.ts`: merges every pod's reasons and lists the missing ones. It keeps the app's own manifest at `NSPrivacyTracking: false` with no tracking domains, and answers App Privacy with Device ID used for tracking by the ads SDK.
  - `release-bundle-checks.test.ts`: allows Google's sample ids only inside the AdMob library, and flags test-only code, StoreKit test code and debug screens.
  - Before evidence: `node skills/quality-gates/scripts/check-gate-wiring.mjs .` still prints the audit:network and audit:privacy script-target lines.
- **Build:**
  - Copy the modules over the stubs, from privacy-and-network-audit's `templates/packages/tooling/src/audit/` into `packages/tooling/src/audit/`: `audit-network.ts`, `audit-privacy.ts`, `bundle-modules.ts`, `network-baseline.ts`, `network-js-layer.ts`, `network-native-layer.ts`, `network-pods-layer.ts`, `network-config-layer.ts`, `network-runtime-layer.ts`, `sample-sockets.ts`, `privacy-manifest.ts` and `release-bundle-checks.ts`.
  - Copy `templates/packages/tooling/network-audit/js-baseline.json` and `native-baseline.json` into `packages/tooling/network-audit/`. This is a gated path, so the commit carries `Gate-Change: network-audit starting baselines from privacy-and-network-audit (Shell step 8)`.
  - Confirm that `packages/tooling/src/audit/audit-licenses.ts` and `packages/tooling/src/deps/banned-packages.ts` exist (the bootstrap wrote them). Restore them from `templates/tooling-deps/` only if one is missing; never overwrite.
  - Confirm that the three npm scripts in the root `package.json` match the canonical ones byte for byte (`node packages/tooling/src/audit/audit-network.ts` and so on).
  - Do not copy the Shell's `packages/shell/src/config/privacy-manifest.ts` here. Only `with-shell.ts` imports it, and knip fails a file that nothing imports, so it lands with the composer in T02. The network guard is already in from E09.
  - If an old `apps/line-siege/ios/` exists, delete it. It is generated and gitignored, and the pod and config layers must wait for T06's clean prebuild.
  - Run `npx prettier --check packages/tooling`.
  - Commit `feat(tooling): add the static network and privacy audits` with the Gate-Change trailer. Check it first with `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged`.
- **Done when:**
  - `npx jest packages/tooling/src/audit --ci --selectProjects unit` passes.
  - `npm run audit:network` exits 0, printing `line-siege: SKIPPED pods/config layers: run npx expo prebuild first` and `audit:network: 0 failure(s)`, and `npm run audit:licenses` passes.
  - `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with the audit:network and audit:privacy lines gone; build:ios:sim, e2e:ios, screenshots:ios and release:ios remain.
  - `npm run -s check:fast` is green, `npm run verify` is green, and `git push -u origin epic/e10-native-first-build` passes the pre-push hook.
- **Owner:** Only if `npm run audit:network` reports a NEW third-party finding beyond the starting baselines. Adding it to a baseline needs the owner's approval (privacy-and-network-audit rule 3). Claude sends one stop-and-ask message in git-commits-and-reporting's request form, checked with `check-report.mjs <request> --kind request`, and meanwhile goes on with T02 to T05.

### E10-T02 · Final composer and the one plugin list

- **Goal:** One config composer writes every native setting:
  - the app-id guard: only `io.applander.<id>` and `<bundleId>.premium` (O4);
  - the app's privacy manifest (4.2);
  - Apple's tracking prompt text in en, de, fa and ckb (O1, 4.2 point 3);
  - the five embedded fonts (7.6) and the 120 Hz key;
  - every native plugin in one list (N3: only the ads and store SDKs go online);
  - `withGameArt` last.

  Every package on the list is installed, so `npx expo config` resolves.
- **Skills:** `architecture-and-boundaries`, `dependency-management`, `toybox-design-system`, `admob-ads`, `premium-purchase`, `game-audio-and-haptics`, `privacy-and-network-audit`, `i18n-strings-and-catalogs`, `rtl-and-direction`, `pocket-arcade-product-spec`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - Pre-check the text the list reads: `grep -c '"consent.tracking.usage-description"' packages/shell/src/i18n/catalogs/en.json packages/shell/src/i18n/catalogs/de.json packages/shell/src/i18n/catalogs/fa.json packages/shell/src/i18n/catalogs/ckb.json` prints 1 for each file, and `npm run i18n:verify` passes.
  - `packages/shell/src/config/shell-plugins.test.ts`, from architecture-and-boundaries' `templates/shell-plugins.test.ts`. It proves:
    - every native module of the Shell is listed exactly once;
    - expo-localization gets only the four languages;
    - expo-font gets the five Toybox faces (`FONT_FILES` has length 5);
    - `expo-iap` and `expo-sqlite` have no options;
    - the audio entry is `AUDIO_API_PLUGIN`;
    - AdMob gets Google sample ids in test builds and the game's ids in live builds;
    - `expo-tracking-transparency` gets the catalog's en text in every ads mode.

    Run it against a typed stub `shell-plugins.ts` (same exports; `shellPlugins` returns `[]`, `FONT_FILES` is `[]`, the four texts are empty) and see the assertion diffs.
  - `packages/shell/src/config/with-shell.test.ts`, from the template `with-shell.test.ts`, written over the phase-0 test. It proves:
    - the URL scheme exists only in test builds, `extra` has no null, live ad units appear only in a live store build, and a live build with sample ids is refused;
    - the team id, the build number, the home-screen name and `NSUserTrackingUsageDescription` are set per language in `locales`;
    - only `io.applander.<game id without hyphens>` is accepted (`com.example.linesiege` and hyphenated ids throw), and only `<bundleId>.premium` as the Premium id;
    - the plugins are the variant marker first, then every Shell plugin;
    - `ios.privacyManifests` is `PRIVACY_MANIFESTS`;
    - the icon and the `expo-splash-screen` entry are added last, and only for a game `render-art.ts` has drawn.

    First copy privacy-and-network-audit's `templates/packages/shell/src/config/privacy-manifest.ts` (pure data: the test's expected value). Then add a typed stub `appIdOf` (returns `''`) to the phase-0 `with-shell.ts`. Run `npx jest packages/shell/src/config --ci --selectProjects unit` and keep the red lines: no privacy manifest, no Shell plugins after the marker, no tracking text in `locales`, the app ids not guarded.
- **Build:**
  1. Install `expo-font`. Run `node skills/dependency-management/scripts/plan-dependency.mjs expo-font --root . --online` and its printed steps in order: the Shell peer `"expo-font": "*"` and the root override, then `npx expo install expo-font@~57.0.4` in `apps/line-siege`. Then `npm approve-scripts --allow-scripts-pending` must print `No packages with unreviewed install scripts.`, and `(cd apps/line-siege && npx expo install --check && npx expo-doctor)` must pass. Commit the manifests and `package-lock.json` alone as `build(deps): add expo-font to line-siege with its shell peer`.
  2. Copy architecture-and-boundaries' `templates/shell-plugins.ts` and `templates/with-shell.ts` into `packages/shell/src/config/`, replacing the stub and the phase-0 composer. Run `npx jest packages/shell/src/config --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/config/**/*.ts' --coverageThreshold='{}'`: all green.
  3. Check that `withShell` sets `ios.infoPlist.CADisableMinimumFrameDurationOnPhone: true` (performance-budgets rule; `check-perf-code` and `check-sim-app` read it), and that the expo-localization entry has no `supportsRTL` or `forcesRTL`.
  4. Commit `with-shell.ts`, `with-shell.test.ts`, `shell-plugins.ts`, `shell-plugins.test.ts` and `privacy-manifest.ts` in one `feat(shell)` commit. The body names N3, 4.2, 7.6, O1 and O4 (print them with `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs N3 4.2 7.6`). The trailer paragraph holds exactly `Spec-Change: with-shell final composer (phase 0 placeholder replaced)`. Before committing, run `node skills/tdd-workflow/scripts/check-test-edits.mjs . --staged --message reports/commit-message.txt` (the trailer accepts the replaced phase-0 assertions) and `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged`.
- **Done when:**
  - `npx tsc --noEmit -p packages/shell` and `npm run -s check:fast` are green.
  - `(cd apps/line-siege && APP_VARIANT=test ADS_MODE=off npx expo config --json)` and `(cd apps/line-siege && APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=off npx expo config --json)` resolve every plugin. `splash-grounds.ts` is still empty, so no splash entry appears yet.
  - These print `RESULT: PASS` with no SKIP line: `node skills/admob-ads/scripts/check-ads.mjs .`, `node skills/premium-purchase/scripts/check-premium.mjs .` and `node skills/toybox-design-system/scripts/check-design-system.mjs .`.
  - `node skills/game-audio-and-haptics/scripts/check-audio-haptics.mjs .` prints `RESULT: PASS` with only the toggle's `[ui-feedback]` slice line.
  - These print `RESULT: PASS`: `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .` (`att-config` and `privacy-manifest` are strict now), `node skills/rtl-and-direction/scripts/check-rtl.mjs .`, `node skills/architecture-and-boundaries/scripts/check-layout.mjs .`, `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` and `node skills/dependency-management/scripts/check-deps-policy.mjs .`.
  - Expected until T03: `node skills/performance-budgets/scripts/check-perf-code.mjs .` now fails only on `[perf-layer]` for the three native files, because the native half falls due once the plugin list exists.

### E10-T03 · Native cold-start module

- **Goal:** The Shell becomes an Expo module package with `ProcessStartModule`. Cold start is then measured from the moment the process starts (S1: under 1 second; budget under 1,000 ms), not from the moment the JS bundle loads, which misses about 90 % of it. It lands now, with the plugin list and before the first native build, because the step-10 E2E run measures cold start.
- **Skills:** `performance-budgets`, `architecture-and-boundaries`, `tdd-workflow`.
- **Tests first:**
  - `node skills/performance-budgets/scripts/check-perf-code.mjs .` is red: `[perf-layer]` names `packages/shell/expo-module.config.json`, `packages/shell/ios/E07Shell.podspec` and `packages/shell/ios/ProcessStartModule.swift` as missing.
  - `npx jest packages/shell/src/app/perf --ci --selectProjects unit` stays green, because `process-start.ts` answers null in Jest through `requireOptionalNativeModule`.
  - The Swift code has no Jest test. Its proof is the T06 build (pod `E07Shell` autolinked and compiled) and the E16 cold-start run. `process-start.ts` keeps its `// device-only: covered by the simulator cold-start run ...` line, which `check-tests` accepts.
- **Build:**
  - Copy performance-budgets' `templates/shell-native/expo-module.config.json` to `packages/shell/expo-module.config.json`, and `templates/shell-native/ios/E07Shell.podspec` and `templates/shell-native/ios/ProcessStartModule.swift` into `packages/shell/ios/`.
  - Confirm that the module name in `expo-module.config.json` (`ProcessStartModule`) and the name the JS asks for (`requireOptionalNativeModule('ProcessStart')` in `app/perf/process-start.ts`) match the Swift module's definition.
  - No JS change, and never an edit in `apps/line-siege/ios/`.
  - Commit `feat(shell): measure cold start from process start` with the spec line S1 in the body.
- **Done when:**
  - `node skills/performance-budgets/scripts/check-perf-code.mjs .` prints `RESULT: PASS` with only `SKIP packages/shell/src/screens/home/use-home-model.ts [perf-layer] S4 not in shell-slice.json`.
  - `node skills/architecture-and-boundaries/scripts/check-layout.mjs .` and `node skills/tdd-workflow/scripts/check-tests.mjs .` print `RESULT: PASS`.
  - `npm run -s check:fast` is green.

### E10-T04 · App icon and splash

- **Goal:** The pilot's app icon (light, dark and tinted) and its native splash (light and dark) are drawn in code from `LOGO_ART` and the Line Siege palette (N9), committed, and wired through `withGameArt`, before the first `expo config` or prebuild that includes them. The splash is the S1 logo tile, so the hand-off from the native splash to S1 looks seamless.
- **Skills:** `code-drawn-art-and-icons`, `dependency-management`, `architecture-and-boundaries`, `tdd-workflow`.
- **Tests first:**
  - `node skills/code-drawn-art-and-icons/scripts/check-app-art.mjs . --app line-siege` is red: `art-missing` for the five PNGs, and `art-unwired` because `splash-grounds.ts` lacks the game and `expo-splash-screen` is not a dependency.
  - `node packages/tooling/src/art/render-art.ts --app line-siege --check` exits 1.
  - The CLI and wiring tests that pin the behaviour stay green and are run first: `npx jest packages/tooling/src/art/art-cli.test.ts packages/shell/src/config/art-config.test.ts packages/shell/src/config/with-shell.test.ts --ci --selectProjects unit`. They cover `--help`, the exit codes and the one-line `ERROR:`, and that the icon and splash join the config only for a drawn game.
- **Build:** In this order, because once `splash-grounds.ts` lists the game, `withGameArt` adds the `expo-splash-screen` plugin and `expo config` fails without the package:
  1. Install the package. Run `node skills/dependency-management/scripts/plan-dependency.mjs expo-splash-screen --root . --online` and its printed steps: the Shell peer `"expo-splash-screen": "*"` and the root override, then `npx expo install expo-splash-screen@~57.0.9` in `apps/line-siege`. Then run `npm approve-scripts --allow-scripts-pending` and `(cd apps/line-siege && npx expo install --check && npx expo-doctor)`.
  2. Run `node packages/tooling/src/art/render-art.ts --app line-siege`. It writes `icon-light.png`, `icon-dark.png`, `icon-tinted.png`, `splash-logo.png` and `splash-logo-dark.png` into `apps/line-siege/assets/generated/`, and adds Line Siege's light and dark grounds to `packages/shell/src/config/splash-grounds.ts`, whose first lines carry `// GENERATED by packages/tooling/src/art/render-art.ts`. Never hand-edit that file.
  3. Look at every PNG before committing. Open each at 1024 px with the Read tool, make 256 px copies (`mkdir -p reports/art && sips -Z 256 apps/line-siege/assets/generated/icon-light.png --out reports/art/icon-light-256.png`, and the same for the other four), open those too, and compare them with `skills/code-drawn-art-and-icons/assets/reference/line-siege-app-art.png`. Check: the glyph is inside the central 62 %, the light icon is opaque and full bleed, the dark icon has a clear background, the tinted icon is grey, and the splash tile has its 7 pt ring and -6° tilt.
  4. Commit the install (both `package.json` files and `package-lock.json`), the five PNGs and `splash-grounds.ts` together in one commit: `feat(line-siege): draw the app icon and native splash in code`, with the spec line N9 in the body.
- **Done when:**
  - `node packages/tooling/src/art/render-art.ts --app line-siege --check` exits 0.
  - `node skills/code-drawn-art-and-icons/scripts/check-app-art.mjs . --app line-siege` and `node skills/code-drawn-art-and-icons/scripts/check-icons-and-logos.mjs .` print `RESULT: PASS`.
  - `(cd apps/line-siege && APP_VARIANT=test ADS_MODE=off npx expo config --type public --json)` shows `icon`, `ios.icon` and the `expo-splash-screen` entry with Line Siege's two grounds.
  - `node skills/dependency-management/scripts/check-deps-policy.mjs .` and `node skills/architecture-and-boundaries/scripts/check-layout.mjs .` print `RESULT: PASS`, the latter covering native modules in every app plus the Shell peer.
  - `npm run -s check:fast` is green.

### E10-T05 · Simulator build tooling

- **Goal:** One command, `npm run build:ios:sim`, turns `apps/line-siege` into a Release simulator app. It starts from a clean prebuild, runs `audit:privacy`, builds with the pinned Xcode 26.6 through `DEVELOPER_DIR`, and installs, launches and screenshots the app on the `e07-smoke` simulator. The repo setup is checked before the first build.
- **Skills:** `ios-simulator-build`, `troubleshooting-playbook`, `typescript-and-lint-rules`, `tdd-workflow`.
- **Tests first:** Copy each test from ios-simulator-build's `templates/packages/tooling/src/` before its module. Run each against a typed stub, so the red is an assertion diff: `npx jest packages/tooling/src/build packages/tooling/src/ios packages/tooling/src/e2e --ci --selectProjects unit`.
  - `build/sim-build-plan.test.ts`: the preflight (`buildScriptProblems`) passes when `audit:privacy` and its file exist, and names a missing file and the skill that ships it. `parseSimBuildArgs` defaults to a test build with test ads on the smoke simulator, and a store build to live ads.
  - `ios/toolchain.test.ts`: `pickXcode` picks the app whose version matches, not the one named `Xcode.app`, and refuses a missing version. `assertXcodeVersion` accepts only 26.6. `toolEnv` sets `DEVELOPER_DIR`, `EXPO_NO_TELEMETRY` and `CI`.
  - `ios/simulators.test.ts`: names are `e07-<purpose>` in kebab-case; a simulator is found by name on the pinned iOS 26.5 runtime, and an existing one is reused.
  - `e2e/maestro-args.test.ts`: the device UDID and a driver port go before the command; "booted", a name, a list of devices or a port outside 1024-65535 are refused; `freeDriverPort` returns a free port.
  - Before evidence: `node skills/ios-simulator-build/scripts/check-sim-setup.mjs .` fails `npm-script` because the target of `build:ios:sim` is missing.
- **Build:**
  - Copy `packages/tooling/src/build/sim-build-plan.ts` and `build-ios-sim.ts`, `packages/tooling/src/ios/toolchain.ts` and `simulators.ts`, and `packages/tooling/src/e2e/maestro-args.ts` over the stubs.
  - Do not copy this skill's `test-only*.ts`, `app-env.d.ts` or `app-variant*.ts`. They have been in the repo since E01, E06 and E09, and the test-only pair has grown members that a copy would drop.
  - Confirm the root script `"build:ios:sim": "node packages/tooling/src/build/build-ios-sim.ts"` (canonical since E01).
  - Confirm that `.gitignore` holds `apps/*/ios/`, `apps/*/android/`, `apps/*/build/` and `reports/`, merging any missing line from ios-simulator-build's environment reference.
  - Confirm that `apps/line-siege/metro.config.js` keys `config.cacheVersion` on `EXPO_PUBLIC_APP_VARIANT`.
  - Check the toolchain without sudo: `DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer xcodebuild -version` prints Xcode 26.6, and `DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer xcrun simctl list runtimes` lists iOS 26.5. If the runtime is missing, run `DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer xcodebuild -downloadPlatform iOS`. `pod --version` prints CocoaPods 1.17.0 under the mise Ruby 3.2.2.
  - Commit `feat(tooling): build and smoke-test release simulator apps`.
- **Done when:**
  - `npx jest packages/tooling/src/build packages/tooling/src/ios packages/tooling/src/e2e --ci --selectProjects unit` passes.
  - `npm run build:ios:sim -- --help` prints the usage.
  - These print `RESULT: PASS`: `node skills/ios-simulator-build/scripts/check-sim-setup.mjs .` (including `build-prereqs`, `xcode-pin`, `sim-safety`, `maestro-device` and `gitignore`), `node skills/troubleshooting-playbook/scripts/check-known-pitfalls.mjs .` (including `build-metro-cache-variant`, `build-imported-constant-gate` and `build-xcode-27-picked`), and `node skills/typescript-and-lint-rules/scripts/check-source.mjs .`.
  - `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with only the e2e:ios, screenshots:ios and release:ios lines.
  - `npm run -s check:fast` is green.
- **Owner:** Only if Xcode 26.6 is missing or its licence is not accepted (the `xcodebuild -version` check above fails). Installing it and accepting the licence needs the owner's admin password: see the "Owner steps" in ios-simulator-build's environment reference. Claude never runs `sudo` or `xcode-select`. It sends one stop-and-ask message, finishes and commits the tooling and its tests, and T06 and T07 wait for the owner.

### E10-T06 · First Release simulator builds, test and store

- **Goal:** The pilot runs natively for the first time. A Release test build starts and draws. A store build made right after, from the same caches, carries no test-only code. Both builds carry the tracking prompt text in four languages, the id `io.applander.linesiege` (O4), the privacy manifest, the five fonts and the native cold-start module.
- **Skills:** `ios-simulator-build`, `architecture-and-boundaries`, `toybox-design-system`, `game-audio-and-haptics`, `performance-budgets`, `troubleshooting-playbook`, `tdd-workflow`.
- **Tests first:** No new test file: the checkers below are this task's tests, run against real build artefacts. Before building, write the expected results into the task notes:
  - test/off: `check-sim-app` PASS and `check-screenshot` PASS;
  - store/off: no `test-code` line, and only the two G3 `owner-placeholder` lines, then `OWNER STEPS PENDING: G3` and `RESULT: FAIL` (L14).

  Any other failure is first reproduced as a failing Jest test in the layer that owns the cause (`with-shell.test.ts`, `shell-plugins.test.ts` or `sim-build-plan.test.ts`), then fixed there. The fix never goes into `ios/`, which prebuild regenerates.
- **Build:**
  1. Resolve the configs:
     - `(cd apps/line-siege && APP_VARIANT=test ADS_MODE=off npx expo config --json)` lists, in this order, the variant marker, expo-sqlite, expo-localization, expo-font, expo-iap, react-native-google-mobile-ads, expo-tracking-transparency, react-native-audio-api and expo-splash-screen.
     - `(cd apps/line-siege && APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=off npx expo config --json)` also resolves.
  2. Build the test variant with `npm run build:ios:sim -- --app line-siege --variant test --ads off`. With ads off, no consent form or tracking prompt covers the screen. The run does a clean prebuild, runs `npm run audit:privacy -- --app line-siege` right after it, builds Release for the simulator without signing, then installs, launches, waits for the ready signal and screenshots on `e07-smoke`. It prints the app path and `reports/ios/line-siege/smoke-test-off.png`. Each step logs to `apps/line-siege/build/logs/<step>.log`. On a failure, run `node skills/troubleshooting-playbook/scripts/find-fix.mjs --log apps/line-siege/build/logs/<step>.log` and ios-simulator-build's `references/failures.md`, then fix the cause, never the check.
  3. Check the test app:
     - `node skills/ios-simulator-build/scripts/check-sim-app.mjs --app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app --variant test --ads off --game line-siege` covers Xcode 26.6, the sentinel being present, the variant in EXConstants, the Google sample app id, `att-string` in Info.plist and in en, de, fa and ckb, the id, the 120 Hz key, `PrivacyInfo.xcprivacy`, and no arbitrary loads.
     - `plutil -extract UIAppFonts json -o - apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app/Info.plist` lists the five TTFs.
     - `plutil -extract NSMicrophoneUsageDescription raw <same Info.plist>` fails with no value, and `grep DISABLE_AUDIOAPI_ apps/line-siege/ios/Podfile` shows both lines (react-native-audio-api adds no background audio or microphone).
     - `grep -c E07Shell apps/line-siege/ios/Podfile.lock` prints 1 or more.
  4. Run `node skills/ios-simulator-build/scripts/check-screenshot.mjs reports/ios/line-siege/`, then open the PNG with the Read tool and look at it. Expected: the S1 splash, or the S2 language-choice stand-in (`NotBuiltScreen` showing its route name), because S1 is the only built screen. The title must be drawn in Lilita One, not the system font, which proves the embedded fonts load. The screen must not be black, white or blank, with no alert and no notification banner (dismiss a banner and shoot again).
  5. Build the store variant right after, without clearing any cache: `npm run build:ios:sim -- --app line-siege --variant store --ads off`. Then:
     - run `node skills/ios-simulator-build/scripts/check-sim-app.mjs --app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app --variant store --ads off --game line-siege` and compare the result with the expectation written above;
     - check `grep -a -c SHELL_TEST_BUILD_ONLY apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app/main.jsbundle` prints 0;
     - run `node skills/ios-simulator-build/scripts/check-screenshot.mjs reports/ios/line-siege/` again for both PNGs.
  6. Optional look at the app icon on the Home Screen: `xcrun simctl terminate <e07-smoke udid> io.applander.linesiege`, then `xcrun simctl io <e07-smoke udid> screenshot reports/ios/line-siege/home-icon.png`. If the icon is on another page, list "the icon under iOS 26 Liquid Glass" under "Not tested or not verified" in the report.
  7. Commit only if a fix was needed (test first, as above). The build evidence lives in the gitignored `reports/` and goes into the slice report.
- **Done when:**
  - Both `npm run build:ios:sim` runs printed `ready (...)`.
  - The test-variant `check-sim-app.mjs` prints `RESULT: PASS`. The store-variant `check-sim-app.mjs` prints exactly the two G3 `owner-placeholder` lines, `OWNER STEPS PENDING: G3` and `RESULT: FAIL`, and nothing else.
  - The sentinel count in the store bundle is 0.
  - `node skills/ios-simulator-build/scripts/check-screenshot.mjs reports/ios/line-siege/` prints `RESULT: PASS`, and both screenshots were looked at.
  - `UIAppFonts` lists the five fonts, and `Podfile.lock` names `E07Shell`.
  - `git ls-files apps/line-siege/ios` prints nothing.

### E10-T07 · Kill test, privacy manifest and network audit on the built app

- **Goal:** Prove the write path on a real app: killing it during its start-up writes loses nothing (15.6), which is the kill test owed since E04 (N10). Then prove the privacy promise against the real pods: every reason a pod declares is in our manifest, only Google's pods declare tracking (4.2, O1), only the three allowed trunk pods exist, the tracking text is in every language, and the store bundle holds no first-party network code and no test-only code (N3, 15.3).
- **Skills:** `save-persistence-and-migrations`, `privacy-and-network-audit`, `ios-simulator-build`, `tdd-workflow`.
- **Tests first:** The kill test and the audits are this task's tests: run each and read its output before changing anything.
  - A kill-test or `inspect-save` failure (a slot that does not decode, a quarantined row, a wrong `journal_mode`) first becomes a failing `node:sqlite` test in `test/integration/save/` that reproduces the bad write, then gets its fix in the save layer.
  - A missing privacy reason: the audit's FAIL line is the red. Add the category and reason to `packages/shell/src/config/privacy-manifest.ts`, rebuild from a clean prebuild, and run the audit again.
- **Build:**
  1. Rebuild the test variant with `npm run build:ios:sim -- --app line-siege --variant test --ads off`, straight after T06's store build without clearing caches. Then `node skills/ios-simulator-build/scripts/check-sim-app.mjs --app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app --variant test --ads off --game line-siege` must print `RESULT: PASS`. This also proves the Metro cache key in the store-to-test direction.
  2. Run the kill test: `node skills/save-persistence-and-migrations/scripts/kill-test.mjs --create --app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app --bundle-id io.applander.linesiege --game-id line-siege --repo .`. It creates `e07-kill-test`, launches and SIGKILLs the app 12 times at 80 to 960 ms, decodes both slots with the app's own `decodeSlot`, checks that `save_quarantine` is empty, and deletes the simulator.
  3. Inspect the save the smoke launch wrote. Read the UDID from `xcrun simctl list devices | grep e07-smoke`, then run `node skills/save-persistence-and-migrations/scripts/inspect-save.mjs --udid <e07-smoke udid> --bundle-id io.applander.linesiege --game-id line-siege --deep --repo .`.
  4. Run `node skills/privacy-and-network-audit/scripts/audit-privacy-manifest.mjs .` against the latest prebuild. Keep the App Privacy input it prints (Device ID: collected, linked, used for tracking by Google Mobile Ads) for the report and the later store-pages step.
  5. Run `npm run audit:network`. The pod and config layers run now that `Podfile.lock` exists: only Google-Mobile-Ads-SDK, GoogleUserMessagingPlatform and openiap come from the trunk, `updates.enabled` is false, `expo-iap` has no options, and the tracking text exists in four languages. Then run `npm run audit:licenses`.
  6. Run `node skills/privacy-and-network-audit/scripts/audit-bundle.mjs --export dist-audit/line-siege --variant store .` on the store export that `audit:network` wrote.
  7. Run `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .` again; its pod rules read `Podfile.lock` now.
  8. Shut down `e07-smoke` by its UDID: `xcrun simctl shutdown <e07-smoke udid>`. Never use `all`.
  9. Commit only if a fix was needed.
- **Done when:**
  - The kill test and `inspect-save.mjs ... --deep --repo .` print `RESULT: PASS`.
  - `audit-privacy-manifest.mjs .`, `audit-bundle.mjs ...` and `audit-repo.mjs .` print `RESULT: PASS`.
  - `npm run audit:network` prints `audit:network: 0 failure(s)` with no `SKIPPED pods/config layers` line, and `npm run audit:licenses` passes.
  - `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .` prints `RESULT: PASS`.
- **Owner:** Only if `audit:network` reports a NEW finding, or `audit-privacy-manifest` names a tracking pod other than Google's ad pods. A baseline or allowlist change is the owner's call. A tracking pod means an analytics SDK slipped in and must be removed. Claude sends one stop-and-ask message with the finding and the proposed change, and meanwhile goes on with T08's checks that do not depend on it.

### E10-T08 · Prove Shell step 8

- **Goal:** Every "done when" of Shell step 8 holds at once on the branch, and nothing else moved: no golden changed, every test still fits the rules, and no gate was bypassed.
- **Skills:** `code-drawn-art-and-icons`, `admob-ads`, `premium-purchase`, `toybox-design-system`, `performance-budgets`, `game-audio-and-haptics`, `privacy-and-network-audit`, `ios-simulator-build`, `golden-tests`, `unit-and-component-tests`, `typescript-and-lint-rules`, `naming-conventions`, `pocket-arcade-product-spec`, `quality-gates`, `tdd-workflow`.
- **Tests first:** Nothing new. The step's checks are the tests. A red check becomes a failing test in the owning layer before its fix, as in T06.
- **Build:** Run every command below from the repo root. Fix in this order: config and plugin causes in `withShell`, `shellPlugins` or a plugin in `packages/shell/plugins/`; code causes test-first; never in `ios/` or in a gate.
- **Done when:**
  - The art: `node packages/tooling/src/art/render-art.ts --app line-siege --check` exits 0, and `node skills/code-drawn-art-and-icons/scripts/check-app-art.mjs . --app line-siege` prints `RESULT: PASS`.
  - Types and tests: `npx tsc --noEmit -p packages/shell`, `npm run -s check:fast` and `npm run test:coverage` are green.
  - These print `RESULT: PASS` with no SKIP line: `node skills/admob-ads/scripts/check-ads.mjs .`, `node skills/premium-purchase/scripts/check-premium.mjs .` and `node skills/toybox-design-system/scripts/check-design-system.mjs .`.
  - `node skills/performance-budgets/scripts/check-perf-code.mjs .` prints `RESULT: PASS` with only the Home-mark slice line, and `node skills/game-audio-and-haptics/scripts/check-audio-haptics.mjs .` with only the toggle's slice line.
  - `(cd apps/line-siege && APP_VARIANT=test ADS_MODE=off npx expo config --json)` resolves every plugin.
  - `npm run audit:network` passes, and `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .` prints `RESULT: PASS`.
  - `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with only the e2e:ios and screenshots:ios (step 10) and release:ios (step 11) script-target lines, and `node skills/quality-gates/scripts/check-bypasses.mjs .` prints `RESULT: PASS`.
  - `node skills/ios-simulator-build/scripts/check-sim-setup.mjs .` prints `RESULT: PASS`, and T06's `npm run build:ios:sim -- --app line-siege --variant test --ads off` result stands.
  - These print `RESULT: PASS`: `node skills/golden-tests/scripts/check-goldens.mjs .`, `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD` (no golden path changed on this branch), `node skills/unit-and-component-tests/scripts/check-test-setup.mjs .`, `node skills/unit-and-component-tests/scripts/check-test-code.mjs .`, `node skills/tdd-workflow/scripts/check-tests.mjs .`, `node skills/typescript-and-lint-rules/scripts/check-source.mjs .`, `node skills/typescript-and-lint-rules/scripts/check-configs.mjs .`, `node skills/naming-conventions/scripts/check-file-names.mjs .`, `node skills/naming-conventions/scripts/check-code-names.mjs .` and `node skills/pocket-arcade-product-spec/scripts/check-spec-refs.mjs .`.
  - `npm run verify` is green, ending with `verify: 11 steps passed, 1 with SKIP lines`, where the only SKIP line is knip's `[knip-exports]` while `shell-slice.json` exists.

### E10-T09 · Simplify, code review, re-run the gates and merge

- **Goal:** The branch is reviewed, simplified and merged, with its evidence report written.
- **Skills:** `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`, `golden-tests`, `privacy-and-network-audit`, `ios-simulator-build`.
- **Tests first:** Every confirmed review finding gets a failing test that shows the problem before its fix: in `with-shell.test.ts` or `shell-plugins.test.ts` for a config finding, or in the tooling's own tests for an audit or build finding. Never fix in `ios/`; the fix goes into `withShell` or a plugin.
- **Build:** Follow "Close the epic" below, steps 1 to 5. If a fix touches the composer, a plugin or the build tooling, rebuild the test and store variants back to back as in T06 (steps 2 to 5) and run `check-sim-app.mjs` on both again. Copy git-commits-and-reporting's `templates/evidence-slice.md` to `reports/evidence-<YYYY-MM-DD>-e10-native-first-build.md` and fill it in. It covers:
  - the outcome in players' words: the game now runs as a real iPhone app with its own icon and splash;
  - the Checks list, with the numbers from the `reports/` files and the files named;
  - "Please look at": the app icon and splash at 256 px in `reports/art/`;
  - "Not tested or not verified": cold-start numbers (E16), the runtime network layer F (E16), the icon under Liquid Glass if not seen;
  - "Owner steps (not blocking)": G3 and G5 (the store build's owner-placeholder lines), the fa and ckb review of the tracking prompt text, the play-test, and listening to the sound previews.
- **Done when:**
  - Every T08 "Done when" passes again after the fixes.
  - These print `RESULT: PASS`: `node skills/tdd-workflow/scripts/check-tests.mjs .`, `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD` (the swap's replaced assertions are accepted through its Spec-Change trailer), `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD`, `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD` and `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e10-native-first-build.md --kind slice`.
  - The branch is merged into `main` and deleted (`git branch -d epic/e10-native-first-build && git push origin --delete epic/e10-native-first-build`).

## Close the epic

1. Re-run every task's "Done when" and `npm run verify`; all green.
2. Run `/simplify` over the branch's changes (`git diff main...HEAD`). Apply its fixes; where behaviour changes, test first. Then run `npm run verify` again.
3. Run `/code-review` on the branch. Fix every confirmed finding test-first (a failing test that shows the problem, then the fix). Then run `npm run verify` again.
4. Write the epic's evidence report (git-commits-and-reporting, slice form) and check it with `node skills/git-commits-and-reporting/scripts/check-report.mjs <report> --kind slice`.
5. Merge: `git switch main && git merge --no-ff epic/e10-native-first-build && git push origin main`, then delete the branch. The push to `origin` needs the owner's word in this session (git-commits-and-reporting rule 5); without it, `main` stays local and the report says so.
