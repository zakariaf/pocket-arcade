# E18 · Android port of the Shell and Line Siege to internal testing

| | |
|---|---|
| Branch | `epic/e18-android-port` |
| Depends on | E17 |
| Spec | Platforms ("iOS first, then Android", one React Native code base; Android follows once a game's iOS version has shipped); section 0 (every game is its own app in the App Store and Google Play); 5 (the system back button always does what Back does, and on the Game screen it opens Pause); 4.2 point 1 (Google Play's Data safety form) and point 2 (Google's consent in the EEA, UK and Switzerland); 8.6 (the Google device backup may include the save, open decision D5, default yes); 8.8 (ads on Android: test ids in test builds, consent first, no tracking prompt) and 8.9 (Premium through Google Play Billing at EUR 1.99, decision D3, owner decision O2); 11 (the Android package `io.applander.linesiege`, owner decision O4); N1-N12 on Android; 15.1-15.6 proven again on Android; lead decisions L10 (the S3 intro only before Google's form) and L14 (`requestTracking` answers `'unavailable'` off iOS; owner placeholders fail every ship gate); owner decision O6 (the owner's own checks never block) |
| Build order | Not in the iOS build orders. First the skill library (skill-maintenance, T01-T11), then the Android order that T10 writes into pocket-arcade-index as "Android steps 1-8", the Android side of Shell steps 8-12: step 1 tooling and the Android Jest project (T12), step 2 configuration and art (T13-T14), step 3 services (T15-T17), step 4 platform behaviour (T18), step 5 first builds, audits and the kill test (T19), step 6 screens on the Android profile (T20-T23), step 7 E2E and the screenshot matrix (T24-T25), step 8 the release tooling and the internal-testing release (T26, T28) |
| Tasks | 28 |

## Current state

E17 is merged: Line Siege 1.0.0 is on TestFlight, or, where the owner's key or store steps were still missing, its keyless rehearsal is reported in a slice report. Concretely, on `main`:

- The Shell is complete. Every screen S1-S15 is built and signed off on the iOS parity simulator (`parity/signoff.json`); `shell-slice.json` is gone (E16); `node skills/navigation-and-routing/scripts/check-navigation.mjs . --complete` passes.
- `npm run verify` ends `verify: 11 steps passed, 0 skipped`, and `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with no script-target SKIP line.
- The iOS tooling is in place: `build:ios:sim`, `e2e:ios`, `screenshots:ios`, `release:ios`, the StoreKit harness, the network, privacy and licence audits, and the store-artifact gate. The uploads are tagged `line-siege/v1.0.0+<n>`.
- `node skills/new-game-scaffold/scripts/check-game-app.mjs . --app line-siege --stage complete` prints `RESULT: PASS`, or ends with only the `owner-placeholder` lines of owner steps G3 and G5 that are still pending.
- Android was prepared but never built:
  - `packages/shell/src/config/with-shell.ts` sets `android.package` to `io.applander.linesiege`, `android.versionCode` to `buildNumber`, and a per-language `app_name` in `locales`.
  - `shell-plugins.ts` gives expo-localization `supportedLocales.android`. The react-native-audio-api plugin has `androidPermissions: []` and `androidForegroundService: false`. The expo-tracking-transparency plugin adds `com.google.android.gms.permission.AD_ID`.
  - `.gitignore` lists `apps/*/android/`.
  - `ads-config.ts` holds Google's Android sample app id `ca-app-pub-3940256099942544~3347511713`, and `apps/line-siege/game.config.ts` has `ads.ids.android: null`.
- A known gap (fixed in T15): `ads-config.ts` falls back to Google's Android sample app id in a live build when `ads.ids.android` is `null`, so a Play store build would carry the sample id.

Not there yet:

- No `apps/line-siege/android/` has ever been generated: no Gradle build, no APK, no AAB.
- No Android tooling, no Android npm scripts, no emulator of this project, and no Kotlin code. `packages/shell/` has `ios/` only, with the Swift `ProcessStartModule`.
- Jest has exactly two projects: `unit` (preset `jest-expo/ios`) and `golden`. No test runs with `Platform.OS === 'android'`.
- `render-art.ts` draws only the iOS icons and the splash: no adaptive icon, no monochrome icon, no Play icon.
- toybox-visual-parity captures only on the `e07-parity` iPhone 16 Pro simulator. There is no Android device profile and no Android reference set.
- On the owner's side: no Google Play developer account (owner step O10), Play Console app, upload key, service account, AdMob Android app, Play product, Data safety answers or testers.
- The skill library (45 skills) has no Android skill. Android appears only as "later" notes: ios-release-testflight's human-steps "Android later" section, premium-purchase's app-store-connect "Android later" section, the Android column of game-audio-and-haptics' haptics cue table, code-drawn-art-and-icons' "Store art and Android (later)", and admob-ads' Android SDK row. unit-and-component-tests rule 1 says "exactly two projects".

The Mac (seen on 2026-10-01; T01 checks again):

- Android Studio is installed. Its JBR is OpenJDK 17.0.11.
- The SDK is in `~/Library/Android/sdk`: platforms 34-36, build-tools 35.0.0 and 36.0.0, NDK 28.2.13676358, emulator 35.1.20, and a `licenses/` folder (the SDK licences were accepted).
- The only system image is `android-35/google_apis_playstore_ps16k/arm64-v8a`. That is a Play Store image, on which `adb root` does not work.
- Two AVDs belong to other projects: `MindForge_Android_390x844` and `Pixel_8a_API_35`. This epic never starts, changes or deletes them.

Checks at the start, all `RESULT: PASS` or green:

- `npm run verify`.
- `node skills/_library/validate-skills.mjs` and `node skills/_library/selftest-all.mjs`.
- `node skills/pocket-arcade-index/scripts/check-index.mjs --readme skills/README.md`.
- `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills`.

## What we will do

**1. The skills first (T01-T11).** The library must know Android before any Android code is written, because the owner never reads code and the skills' checks are the review.

- **T01:** a gap analysis and a plan, sent to the owner with the default "proceed".
- **T02, T03:** two new skills, `android-emulator-build` and `android-release-play`, each with scripts, self-tests and routing evals.
- **T04-T10:** Android sections, templates and checker rules in the existing service, audit, test, parity, platform, gate and routing skills. T10 also writes the Android order into pocket-arcade-index and runs the full library round.
- **T11:** one message to the owner with every Google Play step; the defaults apply meanwhile.

**2. The port, test-first (T12-T25).** Every fix lives in the Shell, so every later game inherits it (N5).

- **T12:** the tooling and the `unit-android` Jest project.
- **T13, T14:** the Android configuration through `withShell`, and the icon and splash drawn in code.
- **T15-T17:** ads and consent without a tracking prompt, Premium through Google Play Billing, then sound, vibration and the native cold-start module.
- **T18:** the system back button, the direction restart and the fonts.
- **T19:** the first Release emulator builds, the audits and the kill test.
- **T20-T23:** every screen matched to its Toybox design on an Android device profile.
- **T24, T25:** the Android E2E evidence run, the ads smoke test and the screenshot matrix.

**3. Release tooling, review, merge and release (T26-T28).** T26 copies the Google Play release tooling into the repo. T27 runs /simplify and /code-review and merges. T28 runs on `main` after the merge: a signed AAB on the Play internal testing track. Until the owner's Play steps are done, T28 runs a keyless rehearsal and ends with a slice report.

**Commands this epic creates.** These names are fixed here, and the task that creates each one makes it real:

- From T02 (android-emulator-build): `check-emu-setup.mjs`, `check-emu-app.mjs`, and `npm run build:android:emu`.
- From T03 (android-release-play): `check-release-setup-android.mjs`, `check-store-aab.mjs`, and `npm run release:android`.
- From T05: `npm run audit:privacy -- --platform android`, and the Gradle layer of `npm run audit:network`.
- From T06: `npm run e2e:android`, `npm run screenshots:android`, and `--platform android` on `check-e2e-report.mjs`.
- From T07: `setup-parity-emu.mjs`, and `--platform android` on `run-parity.mjs`, `capture-app.mjs` and `check-signoff.mjs`.
- From T08: `--platform android --serial <serial>` on `kill-test.mjs`.

Every other command in this file exists today.

Not in this epic:

- The Google Play store listing texts, screenshots and feature graphic (step 8, store web pages), and the production track with any closed test Google requires of new personal accounts (step 9, publishing).
- Android for game 2 and later. Each new game ports with the Android order T10 writes, in that game's own epic (E19 Flock Tilt to E43 Halo Drift: their "Android builds, audits and the kill test", "Android screens, E2E and the screenshot matrix" and "Release to Google Play internal testing" tasks).
- Any change to what iOS players get. iOS must still build and pass: T19 and T27 rebuild it and check it. No iOS reference, waiver or gate is loosened.
- The owner's own checks: the fa and ckb review, the play-test on Android, listening to the sound previews, the TalkBack spot check and the Play purchase test (Tier 3). They are listed under "Owner steps (not blocking)" and never waited for (O6).

## Final state

- [ ] The library knows Android:
  - `node skills/_library/validate-skills.mjs`, `node skills/_library/selftest-all.mjs`, `node skills/_library/check-staleness.mjs` and `node skills/_library/sync-shared.mjs --check` print `RESULT: PASS`.
  - `node skills/_library/link-skills.mjs --check` passes, with links for `android-emulator-build` and `android-release-play`.
- [ ] Routing sends Android work to the right skills:
  - `node skills/skill-maintenance/scripts/check-skill-set.mjs skills` and `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills` print `RESULT: PASS`, with no `--skip-missing`.
  - `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills --live --only android-emulator-build --runs 3` and the same command for `android-release-play` route every eval prompt to their skill.
- [ ] The index lists 47 skills and the Android order: `node skills/pocket-arcade-index/scripts/check-index.mjs --readme skills/README.md` prints `RESULT: PASS`.
- [ ] The repo's Android setup is complete:
  - `node skills/android-emulator-build/scripts/check-emu-setup.mjs .` prints `RESULT: PASS`.
  - `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with no script-target SKIP line. The four Android scripts have their targets.
- [ ] Android paths are tested:
  - `npx jest --ci --selectProjects unit-android` passes.
  - `npm run test:coverage` is green with three projects.
  - `node skills/unit-and-component-tests/scripts/check-test-setup.mjs .` prints `RESULT: PASS`.
- [ ] The Android configuration is right: `(cd apps/line-siege && APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=off npx expo config --json)` shows:
  - `android.package` `io.applander.linesiege` and `versionCode` equal to `buildNumber`;
  - the adaptive icon, `allowBackup` with the backup rules that keep `save.db` (D5), and the permission allowlist;
  - the expo-build-properties Kotlin entry.

  The `ios` block is unchanged against `main`.
- [ ] The test build works: `npm run build:android:emu -- --app line-siege --variant test --ads off` ran from a clean prebuild and printed `ready (...)`, and `node skills/android-emulator-build/scripts/check-emu-app.mjs --apk apps/line-siege/android/app/build/outputs/apk/release/app-release.apk --variant test --ads off --game line-siege --screenshot reports/android/line-siege/smoke-test-off.png` prints `RESULT: PASS`.
- [ ] The store build carries no test-only code:
  - Its `check-emu-app.mjs ... --variant store --ads off --game line-siege` run prints no `test-code`, `variant`, `package` or `debuggable` line. Its only FAIL lines, if any, are `owner-placeholder` lines of owner steps still pending, then `OWNER STEPS PENDING: ...`.
  - `unzip -p <store apk> assets/index.android.bundle | grep -a -c SHELL_TEST_BUILD_ONLY` prints 0.
- [ ] Saving survives a kill on Android (15.6): `node skills/save-persistence-and-migrations/scripts/kill-test.mjs --platform android --create --app <test apk> --bundle-id io.applander.linesiege --game-id line-siege --repo .` prints `RESULT: PASS`.
- [ ] N3 holds on Android (15.3):
  - `npm run audit:network` prints `audit:network: 0 failure(s)` with its Gradle layer run.
  - `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .` prints `RESULT: PASS`.
  - `npm run audit:privacy -- --app line-siege --platform android` prints the Data safety answers.
- [ ] Every screen matches its Toybox design on Android (15.1):
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --platform android --all` prints `RESULT: PASS` in light-en, light-fa, dark-en and dark-fa, S15 included.
  - Before the release, the same command passes for de and ckb (T23).
- [ ] The Android E2E evidence run passes (15.2, 15.4):
  - `npm run e2e:android -- --app line-siege` passed with no filter and an empty `network.txt`.
  - `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege --platform android` and the same command with `--screenshots` print `RESULT: PASS`.
  - The six ads-smoke flows passed by hand on an `ADS_MODE=test` Android build.
- [ ] iOS still works: `npm run build:ios:sim -- --app line-siege --variant test --ads off` succeeds, and `node skills/ios-simulator-build/scripts/check-sim-app.mjs --app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app --variant test --ads off --game line-siege` prints `RESULT: PASS`.
- [ ] `npm run verify` is green with no SKIP line, and `android/` is never committed: `git ls-files apps/line-siege/android` prints nothing.
- [ ] The slice report passes: `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e18-android-port.md --kind slice` prints `RESULT: PASS`.
- [ ] After T28, on `main`, one of two outcomes:
  - **The owner's Play steps are done:** a signed AAB passed `check-store-aab.mjs` and is on the Play internal testing track, tagged `line-siege/v1.0.0+<n>`, and `node skills/git-commits-and-reporting/scripts/check-tags.mjs .` and `check-report.mjs <release report> --kind release` print `RESULT: PASS`.
  - **They are not done yet:** the keyless rehearsal printed `REHEARSAL: not a release gate`, and a slice report lists the pending Play steps under "Owner steps (not blocking)".

## Skills to load

Always: `pocket-arcade-index`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`.

For this epic:

- `skill-maintenance`: the new skills and every Android section, from scaffold to `RESULT: PASS`; the validator, the self-tests, the routing evals and the library round (T01-T10).
- `android-emulator-build` (from T02 on): the Android build tooling, `npm run build:android:emu`, `check-emu-setup` and `check-emu-app`, and the `e07-android-*` AVD rules.
- `android-release-play` (from T03 on): AAB signing, versionCode, the internal track, the Play API upload, `check-release-setup-android`, `check-store-aab`, and the Play owner steps.
- `pocket-arcade-product-spec`: quotes the spec lines (Platforms, 0, 5, 4.2, 8.6, 8.8, 8.9, 11, N1-N12, 15) with `spec-lookup.mjs` for commit bodies and reports, and checks spec citations.
- `architecture-and-boundaries`: the Android block of `withShell`, the backup-rules plugin, the variant marker in the Android manifest, and the layout and boundary checks.
- `typescript-and-lint-rules`: new TypeScript stays within the strict config and the size limits (`check-source`, `check-configs`).
- `naming-conventions`: `*.android.test.ts(x)` file names, `e07-android-<purpose>` AVD names, and the new files (`check-file-names`, `check-code-names`).
- `unit-and-component-tests`: the third Jest project, `unit-android` (`jest-expo/android`), and `check-test-setup` and `check-test-code`.
- `dependency-management`: `expo-build-properties` (and `expo-system-ui` if missing) under the pinning policy; the Android toolchain facts in the versions table.
- `admob-ads`: AdMob on Android, consent without a tracking prompt, the AD_ID permission, the live Android ids, and the ads smoke test on Android.
- `premium-purchase`: Google Play Billing through expo-iap: acknowledge after the save, pending, restore, refunds, the EUR 1.99 Play product, license testers.
- `privacy-and-network-audit`: the Gradle network layer, the merged-manifest permissions, the Android bundle audit, the Data safety answers, and key safety for the keystore and the service-account file.
- `e2e-maestro`: the Android runner, the flows on an emulator, the network check, cold start, memory, large text, and the Android screenshot matrix.
- `toybox-visual-parity`: the Android device profile and reference set, captures on an emulator, the sheets, Android waivers, and `check-signoff --platform android`.
- `toybox-screens`: every screen's spec and testIDs while fixing an Android parity failure (`check-screens`).
- `rtl-and-direction`: `supportsRtl`, the direction restart on Android, Persian digits on Hermes for Android, Vazirmatn by file name.
- `i18n-strings-and-catalogs`: the per-language Android app name, no new text without all four catalogs (`check-catalogs`, `npm run i18n:verify`).
- `game-audio-and-haptics`: the Android haptics cue column, VIBRATE, and audio that mixes with the player's music and suspends on interruptions.
- `settings-and-preferences`: the Vibration row's visibility on Android (`check-settings`).
- `navigation-and-routing`: the system back button and gesture: Back everywhere, Pause on the Game screen, closing an S14 dialog.
- `performance-budgets`: the Kotlin process-start module, the emulator cold-start baseline, the Android memory reading, and `check-perf-code` and `check-budgets`.
- `accessibility`: TalkBack roles and labels, 200 % text on Android, contrast unchanged, and the a11y flows on the emulator.
- `code-drawn-art-and-icons`: the adaptive icon, the monochrome icon, the Android 12 splash icon and the Play icon, drawn by `render-art.ts`.
- `save-persistence-and-migrations`: the Android save path, the kill test and `inspect-save` on the emulator, and the D5 backup rules.
- `board-gestures-and-input`: the Android gesture navigation note (an edge swipe is the system back and opens Pause), and `check-board-input`.
- `board-rendering-skia`: Skia boards on Android (NDK, frame clock), and the board checks staying green.
- `toybox-design-system`: font families resolved by file name on Android (`check-design-system`).
- `golden-tests`: proves no golden changed on this branch (`check-goldens`, `check-golden-changes`).
- `new-game-scaffold`: the new-game checklist's Android order; `check-game-app --stage complete` stays the iOS completeness check.
- `ios-simulator-build`: the model android-emulator-build mirrors, and the iOS regression build (`check-sim-app`).
- `ios-release-testflight`: the model android-release-play mirrors, the shared placeholder list, and its "Android later" notes, which become pointers.
- `troubleshooting-playbook`: the Android failure entries and pitfall rules, `check-known-pitfalls` before the first Android build, and `find-fix` on every failing log.

## How we work in this epic

1. Branch: `git switch main && git pull && git switch -c epic/e18-android-port`. Push the branch after each task (`git push -u origin epic/e18-android-port`), but only once the owner has given the word to push in this session (git-commits-and-reporting rule 5). Without it, the commits stay local and the report says so. Never bypass the pre-push hook.
2. Test first, always. Write each task's "Tests first" items, run them and watch them fail for the right reason, write the minimum code to pass, then refactor. Never weaken or edit a test to make it pass.
3. Commit each task in Conventional Commits form, with the trailers the skills ask for (Gate-Change:, Spec-Change:). `npm run -s check:fast` must be green before every commit.
4. Screens: a task that builds or changes a screen is not done until toybox-visual-parity's capture matches the Toybox design screenshot for every frame it names, in light-en, light-fa, dark-en and dark-fa at every scroll offset, and check-signoff passes for those frames.
5. Stop and ask the owner only at a step marked **Owner**.

## Tasks

### E18-T01 · Android gap analysis and the skill plan

- **Goal:** List exactly which rules, templates and checkers of the 45 skills assume iOS, then agree the shape of the Android library work before writing any of it. That way the new skills and sections are built once, in the right place, with routing that sends every Android task to them.
- **Skills:** `skill-maintenance`, `pocket-arcade-index`, `pocket-arcade-product-spec`, `git-commits-and-reporting`.
- **Tests first:** The routing check is this task's red test. For each Android task prompt below, run `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills --prompt "<prompt>"` and note which skill wins today: an iOS skill, or none. The prompts:
  - "build Line Siege as a Release Android app and start it on the emulator";
  - "upload the Line Siege AAB to the Google Play internal testing track";
  - "acknowledge the Google Play purchase only after Premium is saved";
  - "fill in Google Play's Data safety form for Line Siege";
  - "compare the Android Settings screen with its Toybox design screenshot";
  - "run the Maestro flows on the Android emulator with no network".

  These prompts become T02-T10's routing evals, which fail until the skills and sections exist.
- **Build:**
  1. Check the Mac again: `ls ~/Library/Android/sdk/platforms ~/Library/Android/sdk/build-tools ~/Library/Android/sdk/ndk ~/Library/Android/sdk/system-images/*`, `"/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java" -version` and `ls ~/.android/avd`. Update "Current state" in the plan if anything changed.
  2. Read every SKILL.md and find the iOS-only content: `grep -rln -i -e simctl -e xcodebuild -e xcrun -e testflight -e storekit -e "privacy manifest" -e Info.plist -e Podfile -e VoiceOver -e DEVELOPER_DIR skills`. For each skill, list:
     - the rules that hold only on iOS;
     - the templates that have no Android path;
     - the checker rules that cannot see Android files.
  3. Write `reports/android/skill-plan.md` (gitignored). It holds:
     - **The two new skills.** Draft descriptions (at most 300 characters, verb first, "Use when", and "Not for <work> (<neighbour>)"), their files, and their scripts with rule ids.
     - **The Android changes per existing skill.** The section, template, checker rule and planted-bad fixture, grouped by task: T04 store services, T05 audits, T06 E2E, T07 parity, T08 config, art, test setup and save, T09 platform behaviour, T10 gates, records and routing.
     - **The routing evals.** Two prompts per new skill, and one per changed skill whose boundary moves.
     - **"Android steps 1-8"** for pocket-arcade-index, each with its skills, its copy manifest and its done-when commands.
     - **The gate additions**, none of them a loosening, each landing with a `Gate-Change:` trailer: the four npm scripts `build:android:emu`, `e2e:android`, `screenshots:android` and `release:android`; the `unit-android` Jest project; the emulator cold-start baseline.
     - **The decisions, each with its default:**
       - (a) A Play refund leaves no dated evidence on the phone, so absence never revokes Premium (premium-purchase rule 2).
       - (b) Both platforms share one `buildNumber` sequence, which is Android's `versionCode`. Tags keep the form `line-siege/vX.Y.Z+<n>`, so a tag never repeats.
       - (c) Claude generates the upload key with `keytool` outside the repo (`~/.android-keys/line-siege-upload.jks`, chmod 600), with its passwords in `~/.gradle/gradle.properties`, and never prints them.
       - (d) The parity AVD has the iPhone 16 Pro's logical size (402 × 874 dp at density 3.0), so text wraps as in the iOS references.
       - (e) Android memory is measured as `dumpsys meminfo` total PSS, against the same 150 MB budget.
       - (f) The Play owner steps get the ids GP1-GP7 (O10 stays the developer account).
     - **Findings** to raise, for example the live-Android sample-id fallback in `ads-config.ts`.
  4. Copy git-commits-and-reporting's `templates/owner-request.md` to `reports/android/skill-plan-request.md` and fill it in: one request ("Proceed with this Android plan?"), the default "proceed", what continues meanwhile (everything), and the plan's six decisions in one short list. Check it, send it, and go straight on with T02.
- **Done when:**
  - Every skill folder appears in the plan: `for s in $(ls skills | grep -v -e _library -e README); do grep -q -- "$s" reports/android/skill-plan.md || echo "missing $s"; done` prints nothing.
  - `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/android/skill-plan-request.md --kind request` prints `RESULT: PASS`.
  - `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills` still prints `RESULT: PASS`, because nothing in the library has changed yet.
  - There is no commit: the plan lives in the gitignored `reports/`.
- **Owner:** The owner reads the plan and the six decisions. The default (proceed) applies meanwhile, so nothing waits. If the owner changes a decision, the task that owns it applies the change.

### E18-T02 · New skill: android-emulator-build

- **Goal:** One skill turns `apps/<game>` into a Release Android app on an emulator and proves what was built, mirroring ios-simulator-build:
  - a clean prebuild and Gradle on JDK 17;
  - the test and store variants, with test-only code present in one and absent in the other;
  - `e07-android-*` AVDs targeted by serial;
  - a screenshot that is looked at.
- **Skills:** `skill-maintenance`, `pocket-arcade-index`, `ios-simulator-build` (read only, as the model), `architecture-and-boundaries` (variants and the test-only gate), `troubleshooting-playbook` (Android build failures), `git-commits-and-reporting`.
- **Tests first:**
  - Before the skill exists, `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills --prompt "build Line Siege as a Release Android app and start it on the emulator" --expect android-emulator-build` fails with `eval-unknown-skill`.
  - Write the self-test fixtures before the checkers (skill-maintenance rule 5). Each planted-bad case gets an `EXPECT.txt` that names its rule id.
    - **`check-emu-setup.mjs`.** One good repo tree, and one planted-bad tree for each of: the `build:android:emu` script missing or pointing at a missing file; `apps/*/android/` missing from `.gitignore`; a `metro.config.js` whose `cacheVersion` ignores the variant; an `adb` spawn without `-s <serial>`; an AVD name outside `e07-android-`; a JDK other than 17 picked; nothing to check (exit 2).
    - **`check-emu-app.mjs`.** A good `aapt2 dump badging` and manifest dump with a bundle, and one planted-bad case for each of: a wrong package; the test sentinel in a store bundle or missing from a test bundle; Google's sample AdMob id in a live build; a permission outside the allowlist; `debuggable` true; `supportsRtl` false; `allowBackup` false (D5); the wrong `E07AppVariant` meta-data; a scaffold placeholder, which must print `owner-placeholder` and `OWNER STEPS PENDING: ...`; a blank or one-colour screenshot.
  - `node skills/android-emulator-build/scripts/selftest.mjs` stays red until the checkers catch every planted bug.
  - Write the template tests before the template modules, and prove them in a scratch copy of the verified repo against typed stubs (skill-maintenance workflow step 3): `templates/packages/tooling/src/build/emu-build-plan.test.ts`, `templates/packages/tooling/src/android/toolchain.test.ts` and `templates/packages/tooling/src/android/emulators.test.ts`.
- **Build:**
  1. Run `node skills/skill-maintenance/scripts/new-skill.mjs android-emulator-build --skills-root skills`, then `node skills/_library/sync-shared.mjs android-emulator-build`.
  2. Fill in `SKILL.md`: at most 300 lines, with the rules and the definition of done at the top. Each rule carries its why:
     - Build only through `npm run build:android:emu -- --app <game> [--variant test|store] [--ads off|test|live]`, from `npx expo prebuild --platform android --clean`. Never edit or commit `android/`.
     - Use JDK 17 through `JAVA_HOME` (Android Studio's JBR), with `ANDROID_HOME` and the pinned SDK platform, build-tools, NDK and system image. Verify the pins against Expo SDK 57's Android template and write them in the references.
     - Export `APP_VARIANT`, `EXPO_PUBLIC_APP_VARIANT` and `ADS_MODE` once for the whole run, and key Metro's `cacheVersion` on the variant.
     - Use `assembleRelease` for emulator APKs. `bundleRelease` is only for Play (android-release-play).
     - Name AVDs `e07-android-<purpose>` and give them a `google_apis` arm64 image, which allows `adb root`. Never use a Play Store image for checks.
     - Start each AVD on a free console port, target it as `emulator-<port>`, and pass `adb -s` in every call. Never `adb kill-server`. Never touch another project's AVD.
     - Wait on `sys.boot_completed` and the app's ready marker, never a fixed sleep. Take the screenshot with `adb -s <serial> exec-out screencap -p`, then look at it.
     - Set `EXPO_NO_TELEMETRY=1` and `CI=1` in every tooling process.
     - Owner steps (the JDK, SDK licences) are asked for, never worked around.
  3. Write the references:
     - `references/environment-and-sdk.md`: paths, pins, the image to download with `sdkmanager "system-images;android-<api>;google_apis;arm64-v8a"`, licences, owner steps.
     - `references/build-variants.md`: the variant matrix on Android, the Metro cache key, and the test-only gate in `index.android.bundle`.
     - `references/emulator-commands.md`: `avdmanager`; `emulator -avd <name> -port <port> -no-snapshot -no-boot-anim`; install, launch and screenshot; the demo-mode status bar.
     - `references/failures.md`: Gradle, NDK, Kotlin, Hermes and adb failures, with their fixes.
  4. Write the templates, each with its test:
     - `templates/packages/tooling/src/build/emu-build-plan.ts` and `build-android-emu.ts`;
     - `templates/packages/tooling/src/android/toolchain.ts` and `emulators.ts`;
     - the canonical script line `"build:android:emu": "node packages/tooling/src/build/build-android-emu.ts"`.
  5. Write the scripts on the synced `check-lib.mjs`. Both print `--help`, exit 2 when there is nothing to check, and end with a RESULT line.
     - `scripts/check-emu-setup.mjs [repo-root]`.
     - `scripts/check-emu-app.mjs --apk <apk> --variant test|store --ads off|test|live --game <id> [--screenshot <png>]`.

     Declare the shared `scripts/lib/ship-placeholders.mjs` in `assets/shared.json`, so the placeholder list is the one the iOS gates use.
  6. Write the description (for example: "Builds and runs a Pocket Arcade game as a Release Android app on the emulator - clean prebuild, Gradle on JDK 17, test/store variants, e07- AVDs by serial, screenshot. Use when building, running or smoke-testing on Android. Not for Play uploads (android-release-play)."). Then:
     - add two prompts to `skills/skill-maintenance/assets/routing-evals.json`;
     - add the skill to `skills/pocket-arcade-index/assets/index.json`, in the "Build and release" category and in a new task row "Build, run or smoke-test on the Android emulator";
     - add one line to the `skills/README.md` catalogue.
  7. Record the sources: `node skills/_library/record-sources.mjs android-emulator-build references/environment-and-sdk.md docs/14-ios-build-and-release.md docs/01-stack-and-versions.md`. Knowledge taken from Google's and Expo's web pages cannot be recorded; the report says so.
  8. Commit `feat(skills): add android-emulator-build`.
- **Done when:**
  - These print `RESULT: PASS`:
    - `node skills/_library/validate-skills.mjs android-emulator-build`;
    - `node skills/android-emulator-build/scripts/selftest.mjs`;
    - `node skills/skill-maintenance/scripts/check-skill.mjs skills/android-emulator-build`;
    - `node skills/_library/check-staleness.mjs android-emulator-build`.
  - `node skills/skill-maintenance/scripts/check-skill-set.mjs skills` and `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills --skip-missing` print `RESULT: PASS`. `--skip-missing` is used only while android-release-play's evals wait for T03.
  - `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills --live --only android-emulator-build --runs 3` routes both prompts to the skill.
  - After `node skills/pocket-arcade-index/scripts/build-index.mjs --write`, `node skills/pocket-arcade-index/scripts/check-index.mjs --readme skills/README.md` prints `RESULT: PASS`.
  - After `node skills/_library/link-skills.mjs`, `node skills/_library/link-skills.mjs --check` passes.
- **Owner:** Approve the write of `.claude/skills/android-emulator-build` when `link-skills.mjs` asks: every write under `.claude/` needs the owner's approval. Meanwhile Claude goes on with T03.

### E18-T03 · New skill: android-release-play

- **Goal:** One skill takes a commit of `apps/<game>` to a signed AAB on the Google Play internal testing track, mirroring ios-release-testflight:
  - Play App Signing, with the upload key never read or printed;
  - the shared build number as `versionCode`, never reused;
  - the store-AAB gate before any upload;
  - the upload through the owner's service account;
  - stop-and-ask rules, tags and the release report.
- **Skills:** `skill-maintenance`, `pocket-arcade-index`, `ios-release-testflight` (read only, as the model, and the shared placeholder list), `premium-purchase` (the Play product), `privacy-and-network-audit` (key safety), `git-commits-and-reporting`.
- **Tests first:**
  - Before the skill exists, `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills --prompt "upload the Line Siege AAB to the Google Play internal testing track" --expect android-release-play` fails with `eval-unknown-skill`.
  - Write the fixtures before the checkers, each `EXPECT.txt` naming its rule id.
    - **`check-release-setup-android.mjs`.** One case for each of: the `release:android` target missing; the keystore path inside the repo; a `.gitignore` or deny rule missing for `*.jks`, `*.keystore` and the service-account file; `ads.ids.android: null`, or the scaffold links, which must print `owner-placeholder` lines and `OWNER STEPS PENDING: G3, GP5`; `shell-slice.json` present.
    - **`check-store-aab.mjs`.** One case for each of: an AAB signed with the debug key; a `versionCode` not above the last tag; the test sentinel in a store bundle; Google's sample AdMob id; a permission outside the allowlist; `debuggable` true; a `targetSdk` below the pinned level; `--unsigned`, which must print `REHEARSAL: not a release gate` first.
  - Write the template tests in a scratch copy, against typed stubs:
    - `release-android-plan.test.ts`: refuses a dirty tree, a branch other than `main`, a red `verify`, and an owner placeholder.
    - `version-code.test.ts`: the next number is the last one plus 1, never reused.
    - `play-client.test.ts`: the request shapes for `edits.insert`, `edits.bundles.upload`, `edits.tracks.update` (internal) and `edits.commit`, against a fake server, never a real call.
    - `play-credentials.test.ts`: the key never appears in a log or an error text.
- **Build:**
  1. Run `node skills/skill-maintenance/scripts/new-skill.mjs android-release-play --skills-root skills`, then `node skills/_library/sync-shared.mjs android-release-play`.
  2. Write the rules into `SKILL.md`, each with its why:
     - Nothing leaves the Mac without the owner's word in this session.
     - The upload key lives outside the repo (`~/.android-keys/<game>-upload.jks`, chmod 600), with its passwords in `~/.gradle/gradle.properties`. It is never opened, printed, copied, committed or logged. Google holds the app-signing key (Play App Signing).
     - The service-account JSON is treated exactly like the `.p8`: only `play-credentials.ts` reads it, and only into memory.
     - Build only with `bundleRelease`, through `npm run release:android -- --app <game> --track internal`, from a clean `main` after `npm run verify`, with green Android E2E and screenshots of the same commit.
     - The build number is shared with iOS and equals `versionCode`. It is never reused or rolled back.
     - `check-store-aab.mjs` passes before any upload. Uploads go only to the internal track; promotion is the owner's.
     - The first upload of a new app is done by the owner in the Play Console. The API cannot create an app; whether it can upload the very first bundle is verified on the first run.
     - Stop and ask, never retry, on 401 or 403, an app that is not found, the API not enabled, missing policy declarations, or a used version code.
     - Owner steps never block (O6). A keyless rehearsal is never release evidence.
  3. Write the references:
     - `references/human-steps.md`: O10, and the per-game Play steps GP1-GP7 with exact click paths.
     - `references/release-pipeline.md`: every step, how to run one by hand, and "Rehearsal without the owner's key", which builds an unsigned store/off AAB and runs `check-store-aab.mjs --unsigned`.
     - `references/signing-and-keys.md`.
     - `references/play-api.md`: the REST calls with node's `fetch` and a JWT signed with `node:crypto`. No new npm package.
     - `references/failure-playbook.md`.
  4. Write the templates, each with its test, under `templates/packages/tooling/src/release-android/`: `release-android.ts` (the CLI), `release-android-plan.ts`, `aab-signing.ts`, `version-code.ts`, `play-credentials.ts` and `play-client.ts`. Add the canonical script line `"release:android": "node packages/tooling/src/release-android/release-android.ts"`.
  5. Write the scripts: `scripts/check-release-setup-android.mjs [repo-root]`, and `scripts/check-store-aab.mjs --aab <path> --variant store|test --ads live|test|off --version <X.Y.Z> --build <n> --game <id> [--unsigned] [repo-root]`. Both use the shared `ship-placeholders.mjs`, and add the Android AdMob ids (GP5) to its owner-placeholder results by field.
  6. Write the description (for example: "Ships a Pocket Arcade game to Google Play internal testing - AAB, Play App Signing, upload key, versionCode, store-AAB gate, Play API upload, owner steps. Use when releasing or uploading an Android build. Not for emulator builds (android-emulator-build)."). Add two routing prompts, the index entry ("Build and release", task row "Release a game to Google Play internal testing") and the README catalogue line.
  7. Record the sources: `node skills/_library/record-sources.mjs android-release-play references/human-steps.md docs/14-ios-build-and-release.md spec.txt`.
  8. Commit `feat(skills): add android-release-play`.
- **Done when:**
  - These print `RESULT: PASS`:
    - `node skills/_library/validate-skills.mjs android-release-play`;
    - `node skills/android-release-play/scripts/selftest.mjs`;
    - `node skills/skill-maintenance/scripts/check-skill.mjs skills/android-release-play`;
    - `node skills/_library/check-staleness.mjs android-release-play`.
  - `node skills/skill-maintenance/scripts/check-skill-set.mjs skills` and `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills` print `RESULT: PASS`, now without `--skip-missing`.
  - `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills --live --only android-release-play --runs 3` routes both prompts to the skill.
  - After `build-index.mjs --write`, `node skills/pocket-arcade-index/scripts/check-index.mjs --readme skills/README.md` prints `RESULT: PASS`, and `node skills/_library/link-skills.mjs --check` passes.
- **Owner:** Approve the write of `.claude/skills/android-release-play` when `link-skills.mjs` asks (a write under `.claude/`). Meanwhile Claude goes on with T04.

### E18-T04 · Android in admob-ads and premium-purchase

- **Goal:** The two skills that wrap the only network-capable SDKs (N3) say and check how they behave on Android:
  - **Ads:** AdMob's Android app id per `ADS_MODE`; Google's UMP form with no tracking prompt (`requestTracking` answers `'unavailable'`, L14); the AD_ID permission; and never Google's sample id in a live build.
  - **Premium:** Google Play Billing through expo-iap, with the purchase acknowledged only after Premium is saved; pending purchases; restore; refunds; license testers; the Play product at EUR 1.99.
- **Skills:** `skill-maintenance`, `admob-ads`, `premium-purchase`, `git-commits-and-reporting`.
- **Tests first:** Write each new checker rule's planted-bad fixture first, with an `EXPECT.txt` that names the rule id. Then run both self-tests and see them red. The rule ids come from T01's plan; for example:
  - **admob-ads** `check-ads.mjs`:
    - `android-ids`: a live config that falls back to Google's Android sample app id when `ads.ids.android` is `null`;
    - `ad-id-permission`: ads on, without the AD_ID permission;
    - `no-att-android`: a consent path that awaits a tracking answer on Android.

    `check-ad-behaviour.mjs` gets the case "prepareAds on Android: no tracking step".
  - **premium-purchase** `check-premium.mjs`:
    - `android-acknowledge`: `finishTransaction` before `persistPremium`, or the non-consumable consumed;
    - `android-pending`: a pending purchase acknowledged or granted;
    - `android-kotlin`: expo-iap without the Kotlin build property.

    `check-premium-behaviour.mjs` gets these cases: pending then granted; `restore-failed` versus `restore-empty` on Android; absence never revokes.
- **Build:**
  - **admob-ads:**
    - Add Android lines to rules 3, 4 and 9.
    - Update `references/setup-ids-and-modes.md`: the Android ids per mode; GMA 25.4.0, UMP 4.0.0, minSdk 24 and compile and target 36 from the package's `sdkVersions`; Google's Android test units.
    - Update `references/consent-flow.md`: UMP on Android; no tracking prompt; L10 holds, so the intro comes only before Google's form.
    - Update `references/console-privacy-troubleshooting.md`: the AdMob Android app and its 3 units (GP5).
    - Change the templates:
      - the `ads-config.ts` fix: a live config without Android ids gives no Android app id at all, never Google's sample. The iOS live config is unchanged, so iOS releases of a game that is not on Android yet still build, and the Android gates (`check-emu-app`, `check-store-aab`, `check-release-setup-android`) report the missing ids as owner step GP5;
      - the Android cases in `ads-config.test.ts`;
      - a new `admob-consent-adapter.android.test.ts`;
      - in the ads-smoke flows, the tracking-prompt steps run only on iOS (`runFlow` with `when: platform: iOS`).
  - **premium-purchase:**
    - Add Android lines to rules 1, 2, 5, 6 and 7.
    - Write a new `references/google-play-billing.md`, which replaces app-store-connect's "Android later". It covers:
      - expo-iap 5.8.0 on Play Billing 9.1.0 (openiap-google);
      - `finishTransaction({ purchase, isConsumable: false })` acknowledges, and it comes only after the save;
      - Google refunds unacknowledged purchases after three days, so the launch re-check acknowledges any purchase that is saved but not yet acknowledged;
      - a pending purchase is never granted or acknowledged;
      - restore through `getAvailablePurchases`;
      - refunds: the phone gets no dated evidence, so absence never revokes (T01 decision a);
      - the managed product `io.applander.linesiege.premium` at a EUR 1.99 default price with Google's local prices;
      - license testers, and billing only in Play-installed builds;
      - Kotlin 2.1.20 through `expo-build-properties`.
    - Add the template test `expo-iap-purchase-adapter.android.test.ts`.
  - Add one routing prompt per skill whose boundary moved, for example "acknowledge the Google Play purchase only after Premium is saved" → `premium-purchase`.
  - Record the sources: `node skills/_library/record-sources.mjs premium-purchase references/google-play-billing.md docs/12-in-app-purchase.md spec.txt`, and the same for admob-ads' changed references with `docs/11-ads-admob.md`.
  - Commit `feat(skills): teach admob-ads and premium-purchase about android`.
- **Done when:**
  - These print `RESULT: PASS`:
    - `node skills/admob-ads/scripts/selftest.mjs` and `node skills/premium-purchase/scripts/selftest.mjs`;
    - `node skills/_library/validate-skills.mjs admob-ads premium-purchase`;
    - `node skills/skill-maintenance/scripts/check-skill.mjs skills/admob-ads` and `node skills/skill-maintenance/scripts/check-skill.mjs skills/premium-purchase`;
    - `node skills/_library/check-staleness.mjs admob-ads premium-purchase`;
    - `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills`.
  - On the repo, `node skills/admob-ads/scripts/check-ads.mjs .` fails only on the new Android rules (the live sample-id fallback). That is the red T15 turns green; no other line changes.

### E18-T05 · Android in privacy-and-network-audit

- **Goal:** N3 and the privacy answers are provable on Android:
  - a Gradle dependency layer that allows only the ads and billing artifacts;
  - the merged manifest's permissions against an allowlist, with no cleartext traffic;
  - the bundle audit on an Android export;
  - the Data safety answers (4.2 point 1);
  - key safety for the upload keystore and the service-account file.
- **Skills:** `skill-maintenance`, `privacy-and-network-audit`, `git-commits-and-reporting`.
- **Tests first:**
  - Planted-bad fixtures for the new `audit-repo.mjs` rules, each `EXPECT.txt` naming its rule. For example:
    - `android-permissions`: an extra permission that is not blocked;
    - `android-cleartext`: `usesCleartextTraffic`;
    - `keystore-ignored`: no `.gitignore` or deny rule for `*.jks`, `*.keystore` and the service-account file.
  - The template tests, written first under `templates/packages/tooling/src/audit/`:
    - `network-gradle-layer.test.ts`: reads a `:app:dependencies --configuration releaseRuntimeClasspath` dump, and fails any network-capable artifact outside the allowlist (play-services-ads, user-messaging-platform, billing, openiap-google and their Google dependencies).
    - `android-manifest-audit.test.ts`: the merged permissions against the allowlist (INTERNET, ACCESS_NETWORK_STATE, AD_ID, BILLING, VIBRATE, plus what the ads SDK declares).
    - `data-safety.test.ts`: prints the answers. Device or other IDs, approximate location, app interactions and diagnostics are collected and shared by the ads SDK for advertising, and encrypted in transit. Our own code collects nothing. There is no account to delete.
- **Build:**
  - Add Android lines to rules 2, 4, 5, 7, 8 and 9.
  - Write `references/n3-layers.md`'s Android layers, a new `references/data-safety.md`, and the keystore and JSON lines in `references/secrets-and-supply-chain.md`.
  - Templates:
    - `audit-network.ts` runs the Gradle layer when `apps/<game>/android/` exists, and otherwise prints `SKIPPED gradle layer: run npx expo prebuild --platform android first`.
    - `audit-privacy.ts --platform android` prints the Data safety answers.
    - `audit-bundle.mjs` accepts an Android export (`npx expo export --platform android`).
  - Record the sources against `docs/13-privacy-network-security.md` and `spec.txt`.
  - Commit `feat(skills): add the android audits to privacy-and-network-audit`.
- **Done when:**
  - These print `RESULT: PASS`:
    - `node skills/privacy-and-network-audit/scripts/selftest.mjs`;
    - `node skills/_library/validate-skills.mjs privacy-and-network-audit`;
    - `node skills/skill-maintenance/scripts/check-skill.mjs skills/privacy-and-network-audit`;
    - `node skills/_library/check-staleness.mjs privacy-and-network-audit`.
  - On the repo, `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .` fails only on the new key-safety lines that T12 adds to the repo. That is T12's red.

### E18-T06 · Android in e2e-maestro

- **Goal:** The same flows run unchanged on an Android emulator through one runner, with the same evidence: the flows, an empty network report, cold start, memory, the win feedback, the save benchmark, 200 % text, and the screenshot matrix.
- **Skills:** `skill-maintenance`, `e2e-maestro`, `accessibility` (the a11y flows), `git-commits-and-reporting`.
- **Tests first:**
  - Planted-bad fixtures:
    - `check-e2e-setup.mjs`: an Android runner file missing; an adb or Maestro call that does not name the serial.
    - `check-flows.mjs`: an iOS-only system-UI step not guarded by `when: platform: iOS`.
    - `check-e2e-report.mjs --platform android`: a non-empty `network.txt`; a missing cold-start, memory or feedback file; a missing large-text set.
  - The template tests, written first:
    - `android-device-args.test.ts`: every Maestro and adb call names the serial and a port of its own.
    - `android-socket-sampler.test.ts`: reads `/proc/net/tcp` and `tcp6` for the app's uid, and keeps non-loopback connections only.
    - `android-cold-start.test.ts`: parses `am start -W` TotalTime and the perf log's cold-start entry.
    - `android-memory.test.ts`: `dumpsys meminfo` total PSS.
- **Build:**
  - Add Android lines to rules 2, 3, 6, 11 and 20.
  - In `references/runner-and-network.md`, add an Android section:
    - deep links through `adb -s <serial> shell am start -a android.intent.action.VIEW -d <link>`, with no "Open in" alert;
    - real airplane mode through Maestro `setAirplaneMode` for the offline journey;
    - the socket sampler;
    - `reports/e2e-android/<game>/`.
  - In `references/screenshot-matrix.md`: an Android phone AVD and a tablet AVD, the demo-mode status bar at 9:41, animations off (`settings put global window_animation_scale 0` and the two other scales), and font scale 2.0 for large text.
  - Add the runner templates `packages/tooling/src/e2e/run-e2e-android.ts` and `capture-screenshots-android.ts` with their tests, and the canonical scripts `"e2e:android"` and `"screenshots:android"` that point at them. The emulator baseline file is `perf-baselines/cold-start-emu-<game>.json`.
  - Commit `feat(skills): run the e2e flows on the android emulator`.
- **Done when:** These print `RESULT: PASS`:
  - `node skills/e2e-maestro/scripts/selftest.mjs`;
  - `node skills/_library/validate-skills.mjs e2e-maestro`;
  - `node skills/skill-maintenance/scripts/check-skill.mjs skills/e2e-maestro`;
  - `node skills/_library/check-staleness.mjs e2e-maestro`;
  - `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills`.

### E18-T07 · Android in toybox-visual-parity

- **Goal:** Every screen can be captured on an Android emulator and judged against references rendered at that device's geometry, with the same gates, sheets and sign-off ledger. The owner's rule, that every screen matches its design, then holds on Android, while the iOS path stays exactly as it is.
- **Skills:** `skill-maintenance`, `toybox-visual-parity`, `e2e-maestro` (Maestro on Android), `ios-simulator-build` (the iOS capture path must not change), `git-commits-and-reporting`.
- **Tests first:**
  - Planted-bad fixtures with a fake `adb` and a fake `emulator`, beside the existing fake `xcrun` and `maestro`:
    - an Android hierarchy dump without this run's nonce ("hierarchy from another device");
    - a capture on the wrong serial;
    - an Android run signed against the iOS reference (`wrong-reference`);
    - a narrowed Android set (`narrowed`);
    - an Android waiver without `"platform": "android"`.
  - Every existing iOS case stays as it is and must stay green.
- **Build:**
  1. **Device profile.** Write `assets/device/android-phone.json`:
     - the AVD `e07-android-parity`, with the iPhone 16 Pro's logical size (402 × 874 dp at density 3.0, 1206 × 2622 px), so text wraps as in the iOS references (T01 decision d);
     - Android's status bar and gesture navigation bar insets;
     - a demo-mode status bar (9:41, full battery, no notifications);
     - the system image from android-emulator-build.
  2. **References.** Render a new set with `shoot-design.mjs --device assets/device/android-phone.json` into `assets/reference-android/lineSiege/`: light and dark × en and fa, the 32 frames, and the derived variants. Its manifest says it is a new set for a new device, not a change to the iOS set, which stays byte for byte.
  3. **Scripts.**
     - Add `--platform ios|android`, default `ios`, to `run-parity.mjs`, `capture-app.mjs` and `check-signoff.mjs`.
     - Add a new `scripts/setup-parity-emu.mjs`. It creates, boots and pins `e07-android-parity[-<key>]` and prints its serial; `--check` changes nothing.
     - Ledger entries carry `platform`; an iOS entry without the field reads as `ios`.
  4. **Harness.** Add the Android launch path for the parity request: how `readParityLaunch()` receives `frame=...&nonce=...` on Android, for example the launch intent's extras read through the Shell's native module in test builds only. It ships as a template with its test, `templates/packages/shell/src/app/parity-startup.android.test.tsx`. `check-harness.mjs` gets a rule that proves it is wired and stays test-only.
  5. **References and waivers.** Write the Android section of `references/simulator-and-capture.md`. In `references/signoff-and-waivers.md`, Android waivers carry `"platform": "android"` and a class (`platform`, or `platform-text-shaping` with the glyphs). No gate number changes: an Android difference is fixed or waived, never tolerated by a wider number.
  6. Commit `feat(skills): capture and sign off screens on android`.
- **Done when:**
  - `node skills/toybox-visual-parity/scripts/selftest.mjs` prints `RESULT: PASS`, and every iOS case is unchanged.
  - `node skills/toybox-visual-parity/scripts/shoot-design.mjs --check` passes for the iOS set. With `--device skills/toybox-visual-parity/assets/device/android-phone.json --reference skills/toybox-visual-parity/assets/reference-android`, it passes for the Android set.
  - These print `RESULT: PASS`: `node skills/_library/validate-skills.mjs toybox-visual-parity`, `node skills/skill-maintenance/scripts/check-skill.mjs skills/toybox-visual-parity` and `node skills/_library/check-staleness.mjs toybox-visual-parity`.
  - On the repo, `node skills/toybox-visual-parity/scripts/check-harness.mjs .` fails only on the Android launch rule. That is T20's red.

### E18-T08 · Android in the config, art, test-setup, naming and save skills

- **Goal:** The skills that shape the app's native config, its drawn art, its test setup, its file names and its save file each cover Android, so the code tasks T12-T19 copy tested templates instead of inventing.
- **Skills:** `skill-maintenance`, `architecture-and-boundaries`, `code-drawn-art-and-icons`, `unit-and-component-tests`, `naming-conventions`, `save-persistence-and-migrations`, `git-commits-and-reporting`.
- **Tests first:** A planted-bad fixture, with its rule id in `EXPECT.txt`, for each new rule:
  - **architecture-and-boundaries** `check-layout.mjs`: `android/` committed; Kotlin outside `packages/shell/android/`; a native Android setting outside `withShell` and `packages/shell/plugins/`.
  - **code-drawn-art-and-icons** `check-app-art.mjs`: `art-missing` and `art-unwired` for the Android outputs.
  - **unit-and-component-tests** `check-test-setup.mjs`: the `unit-android` project missing; an `*.android.test.*` file run by the iOS project.
  - **naming-conventions** `check-file-names.mjs`: a good `*.android.test.tsx`, and a bad `*.Android.test.tsx`.
  - **save-persistence-and-migrations** `kill-test.mjs`: `--platform android --dry-run` cases with a fake `adb`.
- **Build:**
  - **architecture-and-boundaries:**
    - The `with-shell.ts` template gets an Android block:
      - the package and `versionCode`;
      - `allowBackup: true` and the path-referenced `packages/shell/plugins/with-backup-rules.ts`, a new template with its test, which keeps `SQLite/save.db` with its `-wal` and `-shm` in Android Auto Backup (D5);
      - the permission allowlist and `blockedPermissions`;
      - `userInterfaceStyle: 'automatic'` (needs `expo-system-ui`);
      - `supportsRtl`.
    - The `shell-plugins.ts` template gets `['expo-build-properties', { android: { kotlinVersion: <premium-purchase's version> } }]`.
    - `with-app-variant-marker.ts` also writes `E07AppVariant` as Android manifest meta-data.
  - **code-drawn-art-and-icons:** `render-art.ts` gets new outputs, with their tests and `references/app-icon-and-splash.md`:
    - `android-icon-foreground.png` and `android-icon-monochrome.png`, with the glyph inside the 66 dp safe zone of a 108 dp canvas and the background in the game's accent colour;
    - `android-splash-icon.png`, which fits the Android 12 splash circle;
    - `play-icon-512.png`.

    The feature graphic waits for the store pages (step 8).
  - **unit-and-component-tests:**
    - Rule 1 becomes three projects: `unit` (`jest-expo/ios`, never `*.android.test.*`), `unit-android` (`jest-expo/android`, only `*.android.test.ts(x)`) and `golden`.
    - Edit the canonical `skills/_library/shared/repo-templates/jest.config.js`, then run `node skills/_library/sync-shared.mjs`, and rerun the self-test of every skill that declares the file (`grep -l '"repo-templates/jest.config.js"' skills/*/assets/shared.json`).
  - **naming-conventions:** the `*.android.test.ts(x)` suffix and the `e07-android-<purpose>` AVD names.
  - **save-persistence-and-migrations:**
    - `kill-test.mjs` gets `--platform android --serial <serial>`, reusing `--app`, `--bundle-id`, `--create`, `--kills` and `--step-ms`. It creates and deletes `e07-android-kill-test` on a `google_apis` image, runs `adb root`, kills the process with `kill -9`, pulls the save folder and decodes both slots with the app's `decodeSlot`.
    - `references/write-path.md` gets the Android save folder (expo-sqlite's `SQLite/` in the app's files directory) and the D5 backup rules.
  - Record the sources for each changed reference, and commit one `feat(skills): ...` per skill.
- **Done when:**
  - Each of the five self-tests prints `RESULT: PASS`.
  - `node skills/_library/validate-skills.mjs architecture-and-boundaries code-drawn-art-and-icons unit-and-component-tests naming-conventions save-persistence-and-migrations` prints `RESULT: PASS`.
  - `node skills/skill-maintenance/scripts/check-skill.mjs skills/<name>` prints `RESULT: PASS` for each of the five.
  - `node skills/_library/sync-shared.mjs --check` and `node skills/_library/check-staleness.mjs` for the five print `RESULT: PASS`.

### E18-T09 · Android in the platform-behaviour skills

- **Goal:** Every behaviour that differs on Android has its rule, its template test and its checker rule: the system back, the direction restart, haptics and audio, TalkBack and large text, cold start, gestures and Skia.
- **Skills:** `skill-maintenance`, `navigation-and-routing`, `rtl-and-direction`, `game-audio-and-haptics`, `accessibility`, `performance-budgets`, `board-gestures-and-input`, `board-rendering-skia`, `git-commits-and-reporting`.
- **Tests first:** A planted-bad fixture, with its rule id, for each new rule. For example:
  - `check-navigation.mjs`: no Android back test, or a dialog that ignores the hardware back;
  - `check-rtl.mjs`: `supportsRtl` false;
  - `check-audio-haptics.mjs`: a haptics adapter without the Android cue mapping, or an audio-focus request that stops the player's music;
  - `check-perf-code.mjs` `[perf-layer]`: the Android half missing;
  - `check-a11y-code.mjs`: a target under 44 pt, or a `hitSlop`, hidden in an Android-only style branch (`Platform.select`).

  Then the self-tests run red.
- **Build:**
  - **navigation-and-routing:**
    - Rule 5 on Android: the hardware back and the gesture back go through React Navigation; `usePreventRemove` on Game turns them into Pause, and in Pause back resumes; on any other route back does what the Back control does; with an S14 dialog open, back is the dialog's cancel and the screen behind stays; on Home, Android sends the app to the background.
    - Template `game-screen-back.android.test.tsx`.
  - **rtl-and-direction:**
    - `supportsRtl` in the manifest; `forceRTL` plus `reloadAppAsync` on Android, once, after the save; Persian digits on Hermes for Android; Vazirmatn resolved by file name.
    - Template `direction.android.test.ts`.
  - **game-audio-and-haptics:**
    - The cue table's Android column becomes current: `performAndroidHapticsAsync` with the `AndroidHaptics` type of each cue. `isSupported` on Android follows `references/haptics.md`. VIBRATE is in the allowlist.
    - Audio requests no audio focus that would stop the player's music (spec 8.7), and suspends on interruptions and in the background.
    - Templates `expo-haptics-adapter.android.test.ts` and `audio-api-audio-adapter.android.test.ts`.
  - **accessibility:** TalkBack roles and labels; `accessibilityLanguage` is iOS-only; font scale 2.0; the 44 pt rule in dp is unchanged; the owner's TalkBack spot check (R2 on Android).
  - **performance-budgets:**
    - `templates/shell-native/android/`: a Kotlin `ProcessStartModule` built on `Process.getStartUptimeMillis()`, with its Gradle file. `expo-module.config.json` lists the Android module.
    - The emulator cold-start baseline, the Android memory reading, and `check-perf-report.mjs` for Android reports.
  - **board-gestures-and-input:** On Android with gesture navigation, an edge swipe is the system back, which opens Pause. No gesture exclusion, so back always works.
  - **board-rendering-skia:** Skia on Android (NDK); the same Picture renderer; the frame clock at the display's rate; pixel goldens stay CanvasKit and the same on every platform.
  - Record the sources, and commit one `feat(skills): ...` per skill.
- **Done when:**
  - The self-test of each of the seven skills prints `RESULT: PASS`.
  - `node skills/_library/validate-skills.mjs navigation-and-routing rtl-and-direction game-audio-and-haptics accessibility performance-budgets board-gestures-and-input board-rendering-skia` prints `RESULT: PASS`.
  - `node skills/skill-maintenance/scripts/check-skill.mjs skills/<name>` prints `RESULT: PASS` for each of the seven.
  - `node skills/_library/check-staleness.mjs` for the seven prints `RESULT: PASS`.
  - `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills` prints `RESULT: PASS`.

### E18-T10 · Android in the gate, dependency, failure, record and routing skills, then the library round

- **Goal:** The gates know the Android scripts, the version table knows the Android toolchain, the failure catalogue knows Android failures, and the commit and tag rules accept `release:android`. The index routes every Android task and holds the Android order for every later game. Then the whole library passes.
- **Skills:** `skill-maintenance`, `quality-gates`, `dependency-management`, `troubleshooting-playbook`, `git-commits-and-reporting`, `new-game-scaffold`, `ios-release-testflight`, `pocket-arcade-index`, `pocket-arcade-product-spec`.
- **Tests first:** Planted-bad fixtures:
  - `check-gate-wiring.mjs`: an Android script whose target is missing prints `SKIP package.json [script-target] npm run <name>: due at Android step <n>: <target> not yet created`, as the Shell steps' targets do; a missing Android script is a FAIL.
  - `check-known-pitfalls.mjs`: `android/` committed; a Play Store image used for the kill test; a Metro cache key without the variant in an Android build.
  - `check-commits.mjs` and `check-tags.mjs`: a `release:android` build commit and tag that pass, and a reused build number that fails.
  - Add the first error line of each new catalogue entry to `skills/troubleshooting-playbook/tests/fixtures/find-fix-text/good/queries.txt`, so the self-test proves that `find-fix.mjs` finds it.
- **Build:**
  - **quality-gates:**
    - `templates/package-scripts.json` gains `build:android:emu`, `e2e:android`, `screenshots:android` and `release:android`.
    - `check-gate-wiring.mjs` knows their targets and the step that brings each one.
    - `templates/quality-gates.json` gets the Android perf keys from performance-budgets.
  - **dependency-management:**
    - `references/versions.md` and `assets/versions.json` get the Android facts: JDK 17, compile and target SDK 36, minSdk 24, the NDK, and Kotlin 2.1.20 through `expo-build-properties` `~57.0.22`.
    - Add the Android banned list: Firebase, Play Integrity, Play Install Referrer, and analytics.
  - **troubleshooting-playbook:** Add `android-*` entries to `assets/known-failures.json`, then run `node skills/troubleshooting-playbook/scripts/check-catalogue.mjs --write`. Add the new pitfall rules to `scripts/lib/pitfalls.mjs`.
  - **git-commits-and-reporting:**
    - Rule 6 and `references/tags-and-releases.md` name `npm run release:android` as the second source of `chore(<game-id>): build <n>` commits and `<game-id>/vX.Y.Z+<n>` tags. The build number is shared, so a tag never repeats.
    - `references/stop-and-ask.md` lists O10 and GP1-GP7.
  - **new-game-scaffold:**
    - The new-game checklist names the Android order "once the game's iOS version has shipped".
    - `--stage complete` stays the iOS completeness check: `ads.ids.android: null` is fine there, and the Android gates own GP5.
  - **ios-release-testflight:** The "Android later" sections of `references/human-steps.md` become a short pointer to `android-release-play`. No rule changes.
  - **pocket-arcade-index:**
    - `assets/index.json` gets the build order "Android port", steps 1-8. Each step has its skills, its copy manifest (the templates T02-T09 added) and its done-when commands.
    - Add the task rows "Port a game to Android" and "Release a game to Google Play internal testing", and add the Android skills to the rows that need them (screens, E2E, ads, Premium, audits).
    - Then run `node skills/pocket-arcade-index/scripts/build-index.mjs --write`.
  - **pocket-arcade-product-spec:** Nothing to change. Use `spec-lookup.mjs` and check that each new Android section cites real spec ids.
  - **The library round:**
    1. `node skills/_library/sync-shared.mjs`
    2. `node skills/_library/validate-skills.mjs`
    3. `node skills/_library/selftest-all.mjs`
    4. `node skills/_library/check-staleness.mjs`
    5. `node skills/_library/link-skills.mjs --check`
    6. `node skills/skill-maintenance/scripts/check-skill-set.mjs skills`
    7. `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills`
    8. `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills --live --only android-release-play --runs 3`
  - Commit one `feat(skills): ...` per skill. Then check the history with `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD`.
- **Done when:**
  - Every command of the library round prints `RESULT: PASS`.
  - `node skills/pocket-arcade-index/scripts/check-index.mjs --readme skills/README.md` prints `RESULT: PASS`. This includes `step-import-closure` for the Android manifests, and the README catalogue, which now says 47 skills.
  - `node skills/pocket-arcade-product-spec/scripts/check-spec-refs.mjs .` prints `RESULT: PASS`.
  - On the repo, `node skills/quality-gates/scripts/check-gate-wiring.mjs .` reports the four Android scripts as missing from `package.json`. That is T12's red; no other line changes.

### E18-T11 · Ask the owner for the Google Play steps

- **Goal:** The owner gets every Google Play step in one message, with the defaults that apply meanwhile, so the port goes on and the release waits only for what only the owner can do.
- **Skills:** `git-commits-and-reporting`, `android-release-play`, `premium-purchase`, `admob-ads`, `privacy-and-network-audit`.
- **Tests first:** There is no code. The message is checked before it is sent: `check-report.mjs --kind request` must pass.
- **Build:** Fill in git-commits-and-reporting's `templates/owner-request.md` as `reports/android/play-steps-request.md`. Each step has its id and its exact click path from android-release-play's human-steps reference:
  - **O10:** the Google Play developer account (fee and identity verification).
  - **GP1:** the Play Console app "Line Siege": App, Free, with in-app purchases, default language en-US. The package `io.applander.linesiege` is fixed by the first upload.
  - **GP2:** Play App Signing, with Google holding the app-signing key. The default: Claude generates the upload key at `~/.android-keys/line-siege-upload.jks`; say "no" to use your own.
  - **GP3:** a service account with release rights for this app only. Its JSON key is saved at `~/.android-keys/play-service-account.json` with chmod 600, and is never pasted into the chat.
  - **GP4:** App content:
    - the privacy policy URL (the G3 value);
    - "contains ads";
    - the Data safety form, with the answers from privacy-and-network-audit's Android section (sent again after T19 only if the real build differs);
    - the content rating questionnaire;
    - target audience 13 and over (D8: not designed for children).
  - **GP5:** the AdMob Android app and its 3 units (banner, interstitial, rewarded). Send the 4 ids.
  - **GP6:** the one-time product `io.applander.linesiege.premium` at a EUR 1.99 default price with Google's local prices. Play allows it only after a build with the BILLING permission has been uploaded, so it follows GP7.
  - **GP7:** the internal testers list and the same accounts as license testers. Then the first AAB, which Claude builds, uploaded by the owner to internal testing in the Play Console.

  The default meanwhile: Claude goes on with T12-T27, and T28 ends with the keyless rehearsal and a slice report until these are done. Nothing else waits.
- **Done when:** `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/android/play-steps-request.md --kind request` prints `RESULT: PASS`, and the message has been sent.
- **Owner:** The owner does O10 and GP1-GP7 in their own time. Claude goes on with T12.

### E18-T12 · Android tooling, scripts and the Android Jest project (Android step 1)

- **Goal:** The repo can build Android emulator apps, can audit them, and can run tests where `Platform.OS === 'android'`:
  - android-emulator-build's tooling;
  - the Android audit tooling (the Gradle layer, the manifest audit, the Data safety answers), in place before the first Android build, as the iOS audits were before the first simulator build;
  - the four canonical Android npm scripts and the Android perf keys in `quality-gates.json`;
  - the `unit-android` Jest project;
  - key safety for the keystore and the service-account file.
- **Skills:** `android-emulator-build`, `privacy-and-network-audit`, `unit-and-component-tests`, `quality-gates`, `performance-budgets`, `typescript-and-lint-rules`, `naming-conventions`, `troubleshooting-playbook`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - Copy each template test before its module, against a typed stub with the same exports and wrong values. The red run must be an assertion diff, never `Cannot find module`.
    - From android-emulator-build: `packages/tooling/src/build/emu-build-plan.test.ts`, `packages/tooling/src/android/toolchain.test.ts` and `packages/tooling/src/android/emulators.test.ts`.
    - From privacy-and-network-audit: `packages/tooling/src/audit/network-gradle-layer.test.ts`, `android-manifest-audit.test.ts` and `data-safety.test.ts`.

    Run `npx jest packages/tooling/src/build packages/tooling/src/android packages/tooling/src/audit --ci --selectProjects unit` and keep the red lines.
  - Write the probe `packages/shell/src/testing/platform.android.test.ts`, which asserts `Platform.OS === 'android'`. It is red because the iOS project runs it.
  - These are red: `node skills/android-emulator-build/scripts/check-emu-setup.mjs .` (`npm-script`, tooling files), `node skills/unit-and-component-tests/scripts/check-test-setup.mjs .` (no `unit-android`), and `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .` (key lines).
- **Build:**
  - Copy the modules over the stubs: `packages/tooling/src/build/emu-build-plan.ts`, `build-android-emu.ts`, `packages/tooling/src/android/toolchain.ts` and `emulators.ts`.
  - Copy the audit modules over their stubs: `packages/tooling/src/audit/network-gradle-layer.ts`, `android-manifest-audit.ts` and `data-safety.ts`, with the updated `audit-network.ts` and `audit-privacy.ts`. Run `npx prettier --check packages/tooling`. Commit `feat(tooling): add the android network and privacy audits`.
  - Replace `jest.config.js` with the shared template's three-project version.
  - Add the four Android scripts to the root `package.json`, byte for byte as quality-gates' `templates/package-scripts.json` has them. Merge the Android perf keys of quality-gates' `templates/quality-gates.json` into `quality-gates.json`.
  - Add `*.jks`, `*.keystore` and `play-service-account.json` to `.gitignore`. Merge the matching deny rules into `.claude/settings.json`; the owner approves that write.
  - Make one commit `build(repo): add the android tooling, scripts and jest project` with `Gate-Change: android npm scripts, android perf keys and the unit-android jest project (Android step 1, owner plan of T01)`. Check it first with `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged`.
  - Download the `google_apis` system image that android-emulator-build pins: `~/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager "system-images;android-<api>;google_apis;arm64-v8a"`.
  - Run `node skills/troubleshooting-playbook/scripts/check-known-pitfalls.mjs .`.
- **Done when:**
  - `npx jest packages/tooling/src/build packages/tooling/src/android packages/tooling/src/audit --ci --selectProjects unit` passes, `npx jest --ci --selectProjects unit-android` passes (the probe), and `npm run test:coverage` is green.
  - `npm run build:android:emu -- --help` prints the usage.
  - `npm run audit:network` exits 0, printing `SKIPPED gradle layer: run npx expo prebuild --platform android first` and `audit:network: 0 failure(s)`.
  - These print `RESULT: PASS`:
    - `node skills/android-emulator-build/scripts/check-emu-setup.mjs .`;
    - `node skills/unit-and-component-tests/scripts/check-test-setup.mjs .`;
    - `node skills/naming-conventions/scripts/check-file-names.mjs .`;
    - `node skills/typescript-and-lint-rules/scripts/check-source.mjs .`;
    - `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .`;
    - `node skills/troubleshooting-playbook/scripts/check-known-pitfalls.mjs .`.
  - `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with only the not-yet-due script-target lines of `e2e:android` and `screenshots:android` (Android step 7) and `release:android` (Android step 8).
  - `npm run -s check:fast` and `npm run verify` are green.
- **Owner:** Approve the merge into `.claude/settings.json` (a write under `.claude/`). Also, only if JDK 17 or an SDK part is missing, or a licence is not accepted: ask the owner to install it or accept it. Claude never accepts a licence on the owner's behalf. Meanwhile the tooling and its tests are committed, and T13 goes on.

### E18-T13 · Android configuration through withShell (Android step 2)

- **Goal:** One composer writes every Android native setting:
  - the fixed package `io.applander.linesiege` (O4) and `versionCode` = `buildNumber`;
  - the app name in four languages;
  - `supportsRtl` (N6, N11);
  - `allowBackup` with backup rules that keep the save (8.6, D5);
  - a minimal permission set with the extras blocked (N3);
  - light and dark that follow the phone;
  - the Kotlin version expo-iap needs;
  - the variant marker in the manifest.

  Nothing changes for iOS, and `android/` is never edited.
- **Skills:** `architecture-and-boundaries`, `dependency-management`, `i18n-strings-and-catalogs`, `rtl-and-direction`, `save-persistence-and-migrations`, `premium-purchase`, `pocket-arcade-product-spec`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - In `packages/shell/src/config/with-shell.test.ts`, a new "Android" describe proves:
    - the package and `versionCode`;
    - the `app_name` per language;
    - `android.allowBackup` is true and the backup-rules plugin is listed;
    - `android.permissions` equals the allowlist, and `android.blockedPermissions` lists the extras;
    - `userInterfaceStyle` is `'automatic'`;
    - the `ios` block equals its value before this task (a snapshot taken on `main`).
  - `packages/shell/src/config/shell-plugins.test.ts` proves the `expo-build-properties` entry carries premium-purchase's Kotlin version, and that the iOS entries and their order are unchanged.
  - `packages/shell/plugins/with-backup-rules.test.ts` proves the plugin writes `backup_rules.xml` (Android 11 and lower) and `data_extraction_rules.xml` (12 and higher), both keeping `SQLite/save.db`, `save.db-wal` and `save.db-shm`, and sets both manifest attributes.
  - `packages/shell/plugins/with-app-variant-marker.test.ts` proves the `E07AppVariant` manifest meta-data is written for each variant.
  - Run them against typed stubs, so the red is an assertion diff: `npx jest packages/shell/src/config packages/shell/plugins --ci --selectProjects unit`.
- **Build:**
  1. Save the config from before the change: `(cd apps/line-siege && APP_VARIANT=test ADS_MODE=off npx expo config --json) > reports/android/config-before.json`.
  2. Install `expo-build-properties`: run `node skills/dependency-management/scripts/plan-dependency.mjs expo-build-properties --root . --online` and its printed steps. Then `npm approve-scripts --allow-scripts-pending` and `(cd apps/line-siege && npx expo install --check && npx expo-doctor)`. Confirm that `expo-system-ui` is in `apps/line-siege/package.json`; if it is missing, plan it the same way. Commit the manifests and the lockfile alone, as `build(deps): add expo-build-properties to line-siege`.
  3. Copy architecture-and-boundaries' updated `with-shell.ts`, `shell-plugins.ts`, `templates/with-backup-rules.ts` and `with-app-variant-marker.ts` over the stubs.
  4. Commit `feat(shell): configure the android app through withshell`, with the spec lines 8.6, 11 and N3 in the body (`node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs 8.6 11 N3`).
- **Done when:**
  - `npx jest packages/shell/src/config packages/shell/plugins --ci --selectProjects unit` passes, and `npx tsc --noEmit -p packages/shell` passes.
  - Run `(cd apps/line-siege && APP_VARIANT=test ADS_MODE=off npx expo config --json) > reports/android/config-after.json`. Then `node -e "const a=require('./reports/android/config-before.json').ios,b=require('./reports/android/config-after.json').ios;process.exit(JSON.stringify(a)===JSON.stringify(b)?0:1)"` exits 0: iOS is unchanged.
  - `(cd apps/line-siege && APP_VARIANT=test EXPO_PUBLIC_APP_VARIANT=test ADS_MODE=off npx expo prebuild --platform android --clean)` succeeds. Then `grep -c 'android:supportsRtl="true"' apps/line-siege/android/app/src/main/AndroidManifest.xml` and `grep -c 'dataExtractionRules' apps/line-siege/android/app/src/main/AndroidManifest.xml` each print 1, and `git ls-files apps/line-siege/android` prints nothing.
  - These print `RESULT: PASS`:
    - `node skills/architecture-and-boundaries/scripts/check-layout.mjs .`;
    - `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .`;
    - `node skills/dependency-management/scripts/check-deps-policy.mjs .`;
    - `node skills/rtl-and-direction/scripts/check-rtl.mjs .`;
    - `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .`.
  - `npm run -s check:fast` is green.

### E18-T14 · Android app icon and splash drawn in code (Android step 2)

- **Goal:** Line Siege's Android icons and Android 12 splash icon are drawn in code from `LOGO_ART` and its palette (N9), committed, and wired through `withGameArt`:
  - the adaptive icon (foreground and background), and the monochrome themed icon;
  - the Android 12 splash icon, inside its circle;
  - the 512 px Play icon, which the owner needs for the Play Console.
- **Skills:** `code-drawn-art-and-icons`, `architecture-and-boundaries`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - Android cases in `packages/tooling/src/art/art-cli.test.ts`: `--app line-siege` writes `android-icon-foreground.png`, `android-icon-monochrome.png`, `android-splash-icon.png` and `play-icon-512.png` at their sizes; `--check` exits 1 when one is missing or stale.
  - Android cases in `packages/shell/src/config/art-config.test.ts`: `android.adaptiveIcon` (foreground, monochrome, and the background from the game's accent) and the Android splash entry appear only for a game `render-art.ts` has drawn.
  - `node skills/code-drawn-art-and-icons/scripts/check-app-art.mjs . --app line-siege` is red: `art-missing` for the four Android PNGs.
  - `node packages/tooling/src/art/render-art.ts --app line-siege --check` exits 1.
- **Build:**
  1. Copy code-drawn-art-and-icons' updated `packages/tooling/src/art/` and `packages/shell/src/config/art-config.ts` templates over the old files.
  2. Run `node packages/tooling/src/art/render-art.ts --app line-siege`.
  3. Look at every new PNG before committing. Open each at full size with the Read tool. Make 256 px copies (`mkdir -p reports/art && sips -Z 256 apps/line-siege/assets/generated/android-icon-foreground.png --out reports/art/android-icon-foreground-256.png`, and the same for the others) and open those too. Check that the glyph is inside the 66 dp safe zone, that the monochrome icon is a single colour on transparency, and that the splash icon fits its circle.
  4. Commit `feat(line-siege): draw the android icons and splash icon in code`, with N9 in the body.
- **Done when:**
  - `node packages/tooling/src/art/render-art.ts --app line-siege --check` exits 0.
  - `node skills/code-drawn-art-and-icons/scripts/check-app-art.mjs . --app line-siege` and `node skills/code-drawn-art-and-icons/scripts/check-icons-and-logos.mjs .` print `RESULT: PASS`.
  - `(cd apps/line-siege && APP_VARIANT=test ADS_MODE=off npx expo config --json --type public)` shows `android.adaptiveIcon`.
  - After a clean Android prebuild, `ls apps/line-siege/android/app/src/main/res/mipmap-anydpi-v26/` lists `ic_launcher.xml`.
  - `npm run -s check:fast` is green.

### E18-T15 · Ads and consent on Android (Android step 3)

- **Goal:** Ads behave on Android exactly as spec 8.8 says:
  - Google's consent form where it is required (4.2 point 2), with the S3 intro only before it (L10);
  - no tracking prompt (`requestTracking` resolves `'unavailable'`, L14);
  - test builds only ever see Google's test ads;
  - a live build uses the game's Android ids, and is never quietly built with Google's sample id: without the owner's Android ids (GP5), the Android gates stop it, while iOS releases are unaffected.
- **Skills:** `admob-ads`, `unit-and-component-tests`, `privacy-and-network-audit`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:** All in the `unit-android` project unless the file says otherwise.
  - New cases in `packages/shell/src/config/ads-config.test.ts` (the `unit` project): the Android sample app id in `test` and `off`; the game's Android ids in `live`; a live config with `ads.ids.android: null` gives no Android app id at all (never the sample id), and its iOS values are unchanged.
  - `packages/shell/src/services/consent/admob-consent-adapter.android.test.ts`: `requestTracking()` resolves `'unavailable'` without calling expo-tracking-transparency; refresh, the form and the privacy options work as on iOS.
  - `packages/shell/src/app/consent-moment.android.test.tsx`:
    - where the form is required: the S3 intro, then Google's form, then `initialize`, with no tracking step;
    - where it is not required: `initialize` with no intro and no prompt;
    - never with ads off, with Premium, offline, before the tutorial or during a level.
  - `packages/shell/src/services/ads/admob-ads-adapter.android.test.ts`:
    - Google's Android test units in `test` mode and the game's units in `live`;
    - fullscreen ads pause and resume the game and settle on `CLOSED`, `ERROR` or a rejected `show()`;
    - the reward comes only on `EARNED_REWARD`.
  - `node skills/admob-ads/scripts/check-ads.mjs .` is red with T04's Android lines.
- **Build:** Change only what admob-ads' Android section names. `ads-config.ts` drops the sample-id fallback for live builds. `admob-consent-adapter.ts` takes its platform branch. Keep the classic create, load and show API. Commit `fix(shell): never ship google's sample ad id in a live android build` and `feat(shell): run the consent moment on android without a tracking prompt`, with 8.8, 4.2 and L10 in the bodies.
- **Done when:**
  - `npx jest packages/shell/src/config/ads-config.test.ts packages/shell/src/services/ads packages/shell/src/services/consent --ci --selectProjects unit` and `npx jest --ci --selectProjects unit-android` pass.
  - These print `RESULT: PASS`: `node skills/admob-ads/scripts/check-ads.mjs .`, `node skills/admob-ads/scripts/check-ad-behaviour.mjs .` and `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .`.
  - `npm run -s check:fast` is green.

### E18-T16 · Premium through Google Play Billing (Android step 3)

- **Goal:** The one Premium purchase works on Android with no server (8.9, N7):
  - Premium is saved before the purchase is acknowledged;
  - a pending purchase waits, and its approval turns Premium on without a tap;
  - restore tells "couldn't restore" apart from "nothing to restore";
  - the price is the store's, in the player's digits;
  - a phone with no Play Store is "store unavailable", never an error.
- **Skills:** `premium-purchase`, `unit-and-component-tests`, `rtl-and-direction` (digits in the price), `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - `packages/shell/src/services/purchase/expo-iap-purchase-adapter.android.test.ts`:
    - `finishTransaction({ purchase, isConsumable: false })`, the acknowledge, runs only after `persistPremium` has written and `premium-granted` has been dispatched, and never consumes;
    - a pending purchase is neither granted nor acknowledged, and shows "Waiting for approval";
    - pending, then purchased, grants Premium without a tap and then acknowledges;
    - restore through `getAvailablePurchases`: a sync with Premium grants it; an empty successful sync is `restore-empty`; a billing-unavailable or offline failure is `restore-failed`;
    - Premium missing from a later sync never revokes it (T01 decision a);
    - the product id is `io.applander.linesiege.premium`;
    - an unavailable billing client means "store unavailable".
  - `packages/shell/src/stores/premium/premium-flow.android.test.ts`: listening starts before `initConnection`; the launch re-check acknowledges a saved Premium purchase that is still unacknowledged; offline keeps the cached Premium.
  - `node skills/premium-purchase/scripts/check-premium.mjs .` and `node skills/premium-purchase/scripts/check-premium-behaviour.mjs .` run against the new Android rules; any red line is fixed here.
- **Build:** Add the Android mapping to `expo-iap-purchase-adapter.ts` only. The reducer, the S12 states and the catalogs stay as they are: every state already exists. Commit `feat(shell): sell premium through google play billing`, with 8.9 and N7 in the body.
- **Done when:**
  - `npx jest packages/shell/src/stores/premium packages/shell/src/services/purchase packages/shell/src/app/connect-premium-reloads.test.ts --ci --selectProjects unit` and `npx jest --ci --selectProjects unit-android` pass.
  - `node skills/premium-purchase/scripts/check-premium.mjs .` and `node skills/premium-purchase/scripts/check-premium-behaviour.mjs .` print `RESULT: PASS`.
  - `npm run -s check:fast` is green.
  - The real purchase (buy, cancel, pending with Google's slow test card, restore after a reinstall) works only in a Play-installed build. It is the owner's Tier 3 check after T28, listed and never waited for.

### E18-T17 · Sound, vibration and the cold-start module on Android (Android step 3)

- **Goal:**
  - Vibration plays each cue as its Android haptic type, only when Vibration is on and at least 40 ms after the last pulse.
  - The Vibration row shows exactly when the phone supports it.
  - Sound mixes with the player's own music and stops in the background (8.7).
  - Cold start is measured from process start on Android too, through a Kotlin module in the Shell, so every game inherits it.
- **Skills:** `game-audio-and-haptics`, `settings-and-preferences`, `performance-budgets`, `unit-and-component-tests`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - `packages/shell/src/services/haptics/expo-haptics-adapter.android.test.ts`: each `HapticCue` maps to `performAndroidHapticsAsync` with the cue table's `AndroidHaptics` type; Vibration off makes no call; the 40 ms throttle; every call ends in `.catch`; `isSupported` follows the haptics reference.
  - `packages/shell/src/services/audio/audio-api-audio-adapter.android.test.ts`: no audio-focus request that would stop other audio; suspend and resume on interruptions and on background; `dispose()` before a reload.
  - `packages/shell/src/screens/settings/settings-rows.android.test.ts`: the Vibration row is visible exactly when `haptics.isSupported`.
  - `node skills/performance-budgets/scripts/check-perf-code.mjs .` is red: `[perf-layer]` names the missing Android half under `packages/shell/android/`.
  - `npx jest packages/shell/src/app/perf --ci --selectProjects unit-android` stays green, because `process-start.ts` answers null in Jest.
- **Build:** Add the adapters' Android paths. Copy performance-budgets' `templates/shell-native/android/` into `packages/shell/android/`, and the updated `templates/shell-native/expo-module.config.json` over `packages/shell/expo-module.config.json`. Never edit `apps/line-siege/android/`. Commit `feat(shell): vibrate, play sound and mark cold start on android`, with 8.7 in the body.
- **Done when:**
  - `npx jest packages/shell/src/services/haptics packages/shell/src/services/audio --ci --selectProjects unit` and `npx jest --ci --selectProjects unit-android` pass.
  - These print `RESULT: PASS`:
    - `node skills/game-audio-and-haptics/scripts/check-audio-haptics.mjs .`;
    - `node skills/game-audio-and-haptics/scripts/check-sound-banks.mjs .`;
    - `node skills/settings-and-preferences/scripts/check-settings.mjs .`;
    - `node skills/performance-budgets/scripts/check-perf-code.mjs .`.
  - `npm run -s check:fast` is green. The Kotlin module's compile is proven by T19's build.

### E18-T18 · Back button, direction restart and fonts on Android (Android step 4)

- **Goal:**
  - The system back button and the back gesture always do what Back does (spec 5): on the Game screen they open Pause, so a stray swipe never loses a run.
  - Choosing Persian or Sorani restarts into right-to-left exactly once (N6).
  - The Toybox fonts and Vazirmatn draw from the first frame, offline (7.6).
  - All fixes are in the Shell (N5).
- **Skills:** `navigation-and-routing`, `rtl-and-direction`, `toybox-design-system`, `board-gestures-and-input`, `accessibility`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - `packages/shell/src/screens/game/game-screen-back.android.test.tsx`, from navigation-and-routing's Android template, using `BackHandler.mockPressBack()`: back while playing opens Pause; back in Pause resumes; a finished run leaves normally; only the Pause Home button leaves a live run.
  - `packages/shell/src/navigation/hardware-back.android.test.tsx`:
    - on S8, S9, S10, S11, S11a-d, S12, S13 and S15, back does what the Back control does;
    - with an S14 dialog open, back runs the dialog's cancel and the screen behind stays;
    - on Home, the press is not handled, so Android moves the app to the background.
  - `packages/shell/src/i18n/direction.android.test.ts`: on Android the restart calls `allowRTL`, `forceRTL` and `reloadAppAsync` once, after the save write; the guard turns a second attempt into `give-up`.
  - `packages/shell/src/i18n/fonts.android.test.ts`: every family the type roles name equals a bundled TTF's base name, because Android resolves families by file name; fa and ckb use Vazirmatn; no `fontWeight` with a custom family.
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs . --complete` is red on T09's Android rule.
- **Build:** Fix only where a test is red: the navigation, the dialog host's back handling, `direction.ts`, or the theme's font names. Never fix it inside a game. Commit each behaviour on its own (`fix(shell): ...` or `feat(shell): ...`), with spec 5, N6 or 7.6 in the body.
- **Done when:**
  - `npx jest packages/shell/src/navigation packages/shell/src/screens/game --ci --selectProjects unit` and `npx jest --ci --selectProjects unit-android` pass.
  - These print `RESULT: PASS`:
    - `node skills/navigation-and-routing/scripts/check-navigation.mjs . --complete`;
    - `node skills/rtl-and-direction/scripts/check-rtl.mjs .`;
    - `node skills/toybox-design-system/scripts/check-design-system.mjs .`;
    - `node skills/board-gestures-and-input/scripts/check-board-input.mjs .`;
    - `node skills/accessibility/scripts/check-a11y-code.mjs .`.
  - `npm run -s check:fast` is green. The device proof comes in T19 (fonts on screen) and T24 (`03-language-switch` and back on the emulator).

### E18-T19 · First Release emulator builds, audits and the kill test (Android step 5)

- **Goal:** Line Siege runs natively on Android for the first time.
  - A Release test build starts and draws.
  - A store build made right after, from the same caches, carries no test-only code.
  - Killing the app during its start-up writes loses nothing (15.6).
  - The Gradle, manifest and bundle audits pass (N3, 15.3), and the Data safety answers come from the real build.
  - iOS still builds and passes.
- **Skills:** `android-emulator-build`, `save-persistence-and-migrations`, `privacy-and-network-audit`, `performance-budgets`, `board-rendering-skia`, `ios-simulator-build`, `troubleshooting-playbook`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:** The checkers below are this task's tests, run against real artefacts. Write the expected results in the task notes before building:
  - **test/off:** `check-emu-app` passes and the screenshot passes.
  - **store/off:** no `test-code`, `variant`, `package` or `debuggable` line; only the `owner-placeholder` lines of steps still pending; sentinel count 0.

  Any other failure is first reproduced as a failing Jest test in the layer that owns the cause (`with-shell.test.ts`, a plugin test, `emu-build-plan.test.ts` or a save test), then fixed there. The fix never goes into `android/`.
- **Build:**
  1. Run `node skills/troubleshooting-playbook/scripts/check-known-pitfalls.mjs .`.
  2. Build the test variant: `npm run build:android:emu -- --app line-siege --variant test --ads off`. On a failure, run `node skills/troubleshooting-playbook/scripts/find-fix.mjs --log apps/line-siege/build/logs/<step>.log`.
  3. Check the test app: `node skills/android-emulator-build/scripts/check-emu-app.mjs --apk apps/line-siege/android/app/build/outputs/apk/release/app-release.apk --variant test --ads off --game line-siege --screenshot reports/android/line-siege/smoke-test-off.png`. Open the PNG and look at it. It must show S1 or S2, with the title in Lilita One (not Roboto) and the board drawn by Skia where shown. It must not be black, white or blank.
  4. Build the store variant right after, without clearing any cache: `npm run build:android:emu -- --app line-siege --variant store --ads off`. Then run `check-emu-app.mjs` with `--variant store`, and check that `unzip -p apps/line-siege/android/app/build/outputs/apk/release/app-release.apk assets/index.android.bundle | grep -a -c SHELL_TEST_BUILD_ONLY` prints 0.
  5. Rebuild the test variant, then run the kill test: `node skills/save-persistence-and-migrations/scripts/kill-test.mjs --platform android --create --app apps/line-siege/android/app/build/outputs/apk/release/app-release.apk --bundle-id io.applander.linesiege --game-id line-siege --repo .`.
  6. Inspect the smoke run's save:
     - send the app to the background (it checkpoints the WAL);
     - `adb -s <serial> root`, then pull the save folder T08 recorded (expo-sqlite's `SQLite/` in the app's files directory): `adb -s <serial> pull /data/data/io.applander.linesiege/files/SQLite/ reports/android/save/`;
     - `node skills/save-persistence-and-migrations/scripts/inspect-save.mjs reports/android/save/save.db --game-id line-siege --deep --repo .`.
  7. Run the audits against the prebuild: `npm run audit:network` (its Gradle layer runs now), `npm run audit:privacy -- --app line-siege --platform android` (keep the Data safety answers for the report and for GP4), `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .` and `node skills/privacy-and-network-audit/scripts/audit-bundle.mjs --export dist-audit/line-siege-android --variant store .`.
  8. Run `node skills/performance-budgets/scripts/check-budgets.mjs .`.
  9. Check that iOS is unchanged: `npm run build:ios:sim -- --app line-siege --variant test --ads off`, then `node skills/ios-simulator-build/scripts/check-sim-app.mjs --app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app --variant test --ads off --game line-siege`.
  10. Shut down only this task's emulators, by serial (`adb -s <serial> emu kill`). Commit only if a fix was needed.
- **Done when:**
  - Both Android builds printed `ready (...)`. The test-variant `check-emu-app.mjs` prints `RESULT: PASS`. The store-variant run prints only the expected `owner-placeholder` lines (or `RESULT: PASS` once G3 is done). The sentinel count is 0, and the screenshot was looked at.
  - The kill test and `inspect-save.mjs` print `RESULT: PASS`.
  - `npm run audit:network` prints `audit:network: 0 failure(s)` with no `SKIPPED gradle layer` line. `audit-repo.mjs .` and `audit-bundle.mjs ...` print `RESULT: PASS`.
  - `node skills/performance-budgets/scripts/check-budgets.mjs .` prints `RESULT: PASS`.
  - The iOS `check-sim-app.mjs` prints `RESULT: PASS`.
  - `git ls-files apps/line-siege/android` prints nothing.
- **Owner:** Only if `audit:network` reports a NEW Gradle finding. A baseline change needs the owner's approval (privacy-and-network-audit rule 3). Claude sends one request, checked with `check-report.mjs <request> --kind request`, and goes on with T20 meanwhile.

### E18-T20 · Screens S1 to S4 on Android: first run and Home

- **Goal:** The splash, the language choice, the consent moment with Google's form, and Home (with and without Premium) match their Toybox design screenshots on the Android profile (15.1, N6). The parity harness can also open a design frame on Android in test builds.
- **Skills:** `toybox-visual-parity`, `toybox-screens`, `rtl-and-direction`, `i18n-strings-and-catalogs`, `accessibility`, `android-emulator-build`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - `packages/shell/src/app/parity-startup.android.test.tsx`, from toybox-visual-parity's Android template, is red until the harness reads the Android launch. `node skills/toybox-visual-parity/scripts/check-harness.mjs .` is red on its Android rule.
  - Every gate failure that needs a code fix first gets a component test in a `*.android.test.tsx` beside the screen's test that shows the difference (for example an inset the row misses on Android). Then comes the fix.
- **Build:**
  1. Copy the harness's Android launch path and its test. Commit `feat(shell): open parity frames on android test builds`.
  2. Build the test variant: `npm run build:android:emu -- --app line-siege --variant test --ads off`.
  3. Set up this session's emulator: `node skills/toybox-visual-parity/scripts/setup-parity-emu.mjs --appearance light --name e07-android-parity-<key>`.
  4. Run `node skills/toybox-visual-parity/scripts/run-parity.mjs --platform android --screen S1 --screen S2 --screen S3 --screen S4 --bundle-id io.applander.linesiege --name e07-android-parity-<key>`, in the background or with the longest timeout.
  5. Fix the first failing gate of each run, in the printed order, and capture again. When a fix touches shared code, the iOS sign-off of that screen is captured again too.
  6. Read every `sheet.png`, `zoom-*.png` and `eye-*.png`. Add each run's entry from `check-signoff.mjs --platform android --draft <run-dir>` to `parity/signoff.json`, with the seven eye checks answered.
  7. Waive only true platform differences, in `parity/waivers.json`, with `"platform": "android"`, a class and the reason. That commit carries a `Gate-Change:` trailer, and the owner is told in the report.
- **Design match:** The frames are `s1-splash`, `s2-language-choice`, `s3-consent-moment`, `s4-home` and `s4-home-premium` (the mock-only `s3-google-s-form` is never captured or signed). Each is checked in light-en, light-fa, dark-en and dark-fa, at every scroll offset run-parity plans, against the Android reference set. The sign-off command is `node skills/toybox-visual-parity/scripts/check-signoff.mjs --platform android --screen S1 --screen S2 --screen S3 --screen S4`.
- **Done when:**
  - `node skills/toybox-visual-parity/scripts/check-harness.mjs .` prints `RESULT: PASS`.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S1 --screen S2 --screen S3 --screen S4` prints `RESULT: PASS`.
  - The `check-signoff.mjs --platform android` command above prints `RESULT: PASS`.
  - The iOS `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S1 --screen S2 --screen S3 --screen S4` still prints `RESULT: PASS`.
  - `npx jest --ci --selectProjects unit-android` and `npm run -s check:fast` are green.

### E18-T21 · Screens S5 to S10 on Android: play, Levels, Daily and Statistics

- **Goal:** The Game screen's chrome with its Pause and Result overlays, Levels, the Daily challenge and Statistics match their Toybox design screenshots on Android. S5 has no frame of its own: S5, S6 and S7 compare only the Shell chrome and the overlays, with the board masked by the rectangle the game reports (L6). Line Siege's facts pick the variants (no music, no hints, a score line).
- **Skills:** `toybox-visual-parity`, `toybox-screens`, `rtl-and-direction`, `accessibility`, `android-emulator-build`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:** Every gate failure that needs a code fix first gets a failing component test in an `*.android.test.tsx` beside the screen's own test. Persian digits in level numbers and scores are checked in fa there (`createNumberFormatter`).
- **Build:** The same loop as T20, on this session's `e07-android-parity-<key>`: `node skills/toybox-visual-parity/scripts/run-parity.mjs --platform android --frame s6-pause --frame s7-result-win --frame s7-result-lose --screen S8 --screen S9 --screen S10 --bundle-id io.applander.linesiege --name e07-android-parity-<key>`. Fix the first failing gate, read every sheet, add the ledger entries, and waive only platform differences (with a `Gate-Change:` trailer).
- **Design match:** The frames are:
  - `s6-pause`, with the reference `s6-pause--no-music--no-hints`;
  - `s7-result-win`, with the reference `s7-result-win--score`;
  - `s7-result-lose`, `s8-levels`, `s9-daily-challenge`, `s10-statistics` and `s10-statistics-empty`.

  Each is checked in light-en, light-fa, dark-en and dark-fa at every scroll offset. The sign-off commands are `node skills/toybox-visual-parity/scripts/check-signoff.mjs --platform android --frame s6-pause --frame s7-result-win --frame s7-result-lose` (it names the references the facts picked) and `node skills/toybox-visual-parity/scripts/check-signoff.mjs --platform android --screen S8 --screen S9 --screen S10`.
- **Done when:**
  - Both sign-off commands print `RESULT: PASS`.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S5 --screen S6 --screen S7 --screen S8 --screen S9 --screen S10` prints `RESULT: PASS`.
  - The iOS sign-off for the same frames still passes.
  - `npm run -s check:fast` is green.

### E18-T22 · Screens on Android: Settings and its pages (S11, S11a-S11d)

- **Goal:** Settings and its four pages match their Toybox design screenshots on Android: the language page, About and credits, the offline privacy policy, and the licences. Settings has no Music rows for Line Siege, and its Vibration row follows the phone (T17).
- **Skills:** `toybox-visual-parity`, `toybox-screens`, `settings-and-preferences`, `rtl-and-direction`, `i18n-strings-and-catalogs`, `accessibility`, `android-emulator-build`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:** Every code fix first gets a failing component test in a `*.android.test.tsx` beside the screen's test. A row that stacks wrongly at Android's font metrics is shown by a test at `isLargeText` first.
- **Build:** The T20 loop with `node skills/toybox-visual-parity/scripts/run-parity.mjs --platform android --screen S11 --screen S11a --screen S11b --screen S11c --screen S11d --bundle-id io.applander.linesiege --name e07-android-parity-<key>`. The pre-listed S11b chip-gap waiver applies on Android only if the sheet shows the same mockup artefact. Otherwise it is fixed.
- **Design match:** The frames are `s11-settings` (with the reference `s11-settings--no-music`), `s11a-language`, `s11b-about-and-credits`, `s11c-privacy-policy` and `s11d-licences`. Each is checked in light-en, light-fa, dark-en and dark-fa at every scroll offset (the tall licences and privacy pages at each planned offset). The sign-off command is `node skills/toybox-visual-parity/scripts/check-signoff.mjs --platform android --screen S11 --screen S11a --screen S11b --screen S11c --screen S11d`.
- **Done when:**
  - The sign-off command prints `RESULT: PASS`.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S11 --screen S11a --screen S11b --screen S11c --screen S11d` and `node skills/settings-and-preferences/scripts/check-settings.mjs .` print `RESULT: PASS`.
  - The iOS sign-off for S11-S11d still passes.
  - `npm run -s check:fast` is green.

### E18-T23 · Screens S12 to S15 on Android: Premium, How to play, Dialogs and Debug, then the full sign-off

- **Goal:** Every Premium state, How to play, the S14 dialogs and the test-only Debug menu (L12; its labels stay English, L13) match their Toybox design screenshots on Android. Then every frame is signed off at once, and de and ckb are added for the release (toybox-visual-parity rule 1).
- **Skills:** `toybox-visual-parity`, `toybox-screens`, `premium-purchase`, `i18n-strings-and-catalogs`, `rtl-and-direction`, `accessibility`, `android-emulator-build`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:** Every code fix first gets a failing component test in a `*.android.test.tsx` beside the screen's test. The Premium price text in fa digits is checked from a fake store price, never a typed price.
- **Build:**
  1. Run the T20 loop with `node skills/toybox-visual-parity/scripts/run-parity.mjs --platform android --screen S12 --screen S13 --screen S14 --screen S15 --bundle-id io.applander.linesiege --name e07-android-parity-<key>`. S12 alone is 36 runs, so run it in the background.
  2. Run the full set: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --platform android --all`.
  3. Add de and ckb for the release:
     - render the Android references in all four languages: `node skills/toybox-visual-parity/scripts/shoot-design.mjs --device skills/toybox-visual-parity/assets/device/android-phone.json --lang en --lang fa --lang de --lang ckb --out .parity/design-android`;
     - capture de and ckb with `run-parity.mjs --platform android --langs de,ckb --reference .parity/design-android` for every screen;
     - sign off with `node skills/toybox-visual-parity/scripts/check-signoff.mjs --platform android --all --langs en,fa,de,ckb --reference .parity/design-android`.
- **Design match:** The frames are:
  - `s12-premium`, `s12-loading-price`, `s12-store-unavailable-offline`, `s12-purchase-in-progress`, `s12-pending-approval`, `s12-success`, `s12-error`, `s12-already-owned` and `s12-restore-results-toasts`;
  - `s13-how-to-play`;
  - `s14-reset-all-progress` (with the reference `s14-reset-all-progress--no-music`), `s14-restart-to-apply` and `s14-progress-restored`;
  - `s15-debug-menu`.

  Each is checked in light-en, light-fa, dark-en and dark-fa at every scroll offset. The sign-off command is `node skills/toybox-visual-parity/scripts/check-signoff.mjs --platform android --screen S12 --screen S13 --screen S14 --screen S15`, then `--all` as above.
- **Done when:**
  - `check-signoff.mjs --platform android --screen S12 --screen S13 --screen S14 --screen S15`, `check-signoff.mjs --platform android --all`, and the de and ckb run above each print `RESULT: PASS`, with no frame left uncaptured.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --all` prints `RESULT: PASS`.
  - The iOS `node skills/toybox-visual-parity/scripts/check-signoff.mjs --all` still prints `RESULT: PASS`.
  - `npm run -s check:fast` is green.

### E18-T24 · Android E2E evidence run and the ads smoke test (Android step 7)

- **Goal:** The Shell and the pilot's journeys run on the Android emulator with real airplane mode where the journey is offline (15.2). They show no network traffic from our code (N3), and measure cold start, memory, the win feedback, the save benchmark and 200 % text. The ads smoke test proves on Android: consent in a simulated EU region before the first ad, no tracking prompt, test ads only where 8.8 allows, the rewarded continue, and offline silence (15.4).
- **Skills:** `e2e-maestro`, `android-emulator-build`, `admob-ads`, `accessibility`, `performance-budgets`, `privacy-and-network-audit`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - Copy e2e-maestro's Android runner tests before their modules, against typed stubs: `packages/tooling/src/e2e/android-device-args.test.ts`, `android-socket-sampler.test.ts`, `android-cold-start.test.ts` and `android-memory.test.ts`. Run `npx jest packages/tooling/src/e2e --ci --selectProjects unit` and keep the red lines.
  - `node skills/e2e-maestro/scripts/check-e2e-setup.mjs .` is red on the missing Android runner files.
  - The flows stay unchanged. `node skills/e2e-maestro/scripts/check-flows.mjs . --syntax` must pass with T06's platform-guard rule.
  - A flow that fails on Android is first reproduced as a failing Jest test where the cause is (a model hook, the link handler, an adapter). Then it is fixed, and the flow is run again. A flaky flow is a bug, never a retry.
- **Build:**
  1. Copy the runner modules over the stubs: `packages/tooling/src/e2e/run-e2e-android.ts`, `capture-screenshots-android.ts` and their helpers. Commit `feat(tooling): run the e2e flows and the screenshot matrix on android`.
  2. Build the test/off variant, then run `npm run e2e:android -- --app line-siege` with no filter:
     - the flows `01-first-launch`, `02-core-journey-offline`, `03-language-switch`, `04-debug-performance`, `10-level-1`, `11-daily`, `12-continue-premium` and `13-endless`;
     - the a11y flows at font scale 2.0;
     - cold start and memory.

     The first run writes `perf-baselines/cold-start-emu-line-siege.json`. Commit it with `Gate-Change: android emulator cold-start baseline (Android step 7)`.
  3. Open every large-text screenshot under `reports/e2e-android/line-siege/` with the Read tool. Run `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege --platform android`.
  4. Run the ads smoke test by hand:
     - build `npm run build:android:emu -- --app line-siege --variant test --ads test`;
     - for each of admob-ads' six flows `packages/shell/e2e/ads-smoke/01-consent-eea.yaml` to `06-geo-other.yaml`: install fresh, start with `adb -s <serial> shell am start -n io.applander.linesiege/.MainActivity`, then run `tools/maestro/bin/maestro <the Android device arguments e2e-maestro names> test -e APP_ID=io.applander.linesiege -e APP_SCHEME=<scheme> packages/shell/e2e/ads-smoke/<flow>.yaml`;
     - expected: S3, then Google's form, no tracking prompt, a banner; a relaunch with no prompts; the interstitial after Next; the rewarded continue with the board settled; offline shows no ad and no message; `geo=other`.
  5. Shut down only this task's emulators, by serial.
- **Done when:**
  - `npx jest packages/tooling/src/e2e --ci --selectProjects unit` passes.
  - `npm run e2e:android -- --app line-siege` passed with no tag filter and without `--flows-only`, with an empty `network.txt`, and every Maestro line names this session's serial.
  - `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with only the `release:android` script-target line (its target lands in T26).
  - These print `RESULT: PASS`: `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege --platform android`, `node skills/e2e-maestro/scripts/check-e2e-setup.mjs .` and `node skills/e2e-maestro/scripts/check-flows.mjs . --syntax`.
  - The six ads-smoke flows passed, and their logs are in `reports/`.
  - `npm run -s check:fast` is green.

### E18-T25 · Android screenshot matrix (Android step 7)

- **Goal:** Every screen is captured on Android in the four languages × light and dark × phone and tablet, against committed baselines. The pictures show nothing cut off, overlapping or wrongly mirrored (15.1), and later changes are caught by the matrix.
- **Skills:** `e2e-maestro`, `android-emulator-build`, `rtl-and-direction`, `accessibility`, `toybox-visual-parity`, `git-commits-and-reporting`.
- **Tests first:** `node skills/e2e-maestro/scripts/check-e2e-setup.mjs . --baselines` is red: the 16 Android sets are missing. This is the only matrix change, and the tolerance never changes.
- **Build:**
  1. Run `npm run screenshots:android -- --app line-siege --update` on this session's phone and tablet AVDs.
  2. Open every PNG with the Read tool, and check direction, clipping, overlap, truncation and colours. Every screen was signed off by parity in T20-T23 first.
  3. For the release, add the 200 % text matrix and check it by eye.
  4. Commit the baselines with `Gate-Change: android screenshot baselines, every screen in en, de, fa and ckb, light and dark, phone and tablet`.
- **Done when:**
  - `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege --platform android --screenshots` and `node skills/e2e-maestro/scripts/check-e2e-setup.mjs . --baselines` print `RESULT: PASS`.
  - `npm run -s check:fast` is green.

### E18-T26 · Google Play release tooling (Android step 8)

- **Goal:** `npm run release:android` has its target in the repo before the merge, so the release in T28 starts from a clean `main` with nothing left to copy. Its setup check gives the expected result: `PASS`, or only the owner-placeholder lines of the Play steps still pending.
- **Skills:** `android-release-play`, `privacy-and-network-audit`, `quality-gates`, `typescript-and-lint-rules`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - Copy android-release-play's template tests before their modules, against typed stubs, into `packages/tooling/src/release-android/`:
    - `release-android-plan.test.ts`: refuses a dirty tree, a branch other than `main`, a red `verify`, and an owner placeholder;
    - `version-code.test.ts`: the next number is the last one plus 1, never reused;
    - `play-client.test.ts`: the request shapes against a fake server, never a real call;
    - `play-credentials.test.ts`: the key never appears in a log or an error text.

    Run `npx jest packages/tooling/src/release-android --ci --selectProjects unit` and keep the red lines.
  - `node skills/quality-gates/scripts/check-gate-wiring.mjs .` still prints the `release:android` script-target line.
- **Build:**
  - Copy the modules over the stubs: `release-android.ts`, `release-android-plan.ts`, `aab-signing.ts`, `version-code.ts`, `play-credentials.ts` and `play-client.ts`.
  - The keystore and the service-account file stay outside the repo. Nothing here reads them; only a release run does, and only in memory.
  - Run `npx prettier --check packages/tooling`. Commit `feat(tooling): add the google play release pipeline`, checked with `check-commits.mjs . --message reports/commit-message.txt --staged`.
- **Done when:**
  - `npx jest packages/tooling/src/release-android --ci --selectProjects unit` passes, and `npm run release:android -- --help` prints the usage.
  - `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with no script-target SKIP line.
  - `node skills/android-release-play/scripts/check-release-setup-android.mjs .` prints `RESULT: PASS`, or ends with only `owner-placeholder` lines, then `OWNER STEPS PENDING: ...`, then `RESULT: FAIL`. That is the expected result until the owner's steps are done.
  - `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .` and `node skills/typescript-and-lint-rules/scripts/check-source.mjs .` print `RESULT: PASS`.
  - `npm run -s check:fast` and `npm run verify` are green.

### E18-T27 · Simplify, code review, re-run the gates and merge

- **Goal:** The branch, code and skills alike, is simplified, reviewed, proven again and merged into `main`, with its evidence report, so the release starts from a clean `main`.
- **Skills:** `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`, `golden-tests`, `skill-maintenance`, `pocket-arcade-index`, `android-emulator-build`, `privacy-and-network-audit`, `ios-simulator-build`.
- **Tests first:** Every confirmed review finding gets a failing test that shows it before its fix:
  - a Jest test in the layer that owns it, for code;
  - a planted-bad fixture with its `EXPECT.txt`, for a skill checker;
  - a routing eval, for a description.

  Never fix inside `android/` or `ios/`.
- **Build:**
  - Follow "Close the epic" below, steps 1 to 5. If a fix touches `withShell`, a plugin, the native module or the build tooling, rebuild the Android test and store variants back to back as in T19, run `check-emu-app.mjs` on both again, and rebuild iOS once.
  - Copy git-commits-and-reporting's `templates/evidence-slice.md` to `reports/evidence-<YYYY-MM-DD>-e18-android-port.md` and fill it in:
    - the outcome in players' words: Line Siege now runs as a real Android app with the same screens, languages, saves, ads and Premium;
    - the checks, with numbers from `reports/`;
    - "Design match", with the Android waivers and their classes;
    - "Please look at": the Android icons at 256 px and the dark-fa sheets;
    - "Not tested or not verified": the real Play purchase, a physical Android phone, and cold start on a device;
    - "Owner steps (not blocking)": O10 and GP1-GP7, the fa and ckb review, the Android play-test, the TalkBack spot check, and the sound previews.
- **Done when:**
  - Every "Done when" of T12-T26 passes again.
  - The library round of T10 passes again.
  - These print `RESULT: PASS`:
    - `node skills/tdd-workflow/scripts/check-tests.mjs .`;
    - `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD`;
    - `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD`;
    - `node skills/golden-tests/scripts/check-goldens.mjs .`;
    - `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD` (no golden changed);
    - `node skills/quality-gates/scripts/check-bypasses.mjs .`;
    - `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e18-android-port.md --kind slice`.
  - The iOS `check-sim-app.mjs ... --variant test --ads off --game line-siege` prints `RESULT: PASS`.
  - `npm run verify` is green with no SKIP line.
  - The branch is merged into `main` and deleted (`git branch -d epic/e18-android-port && git push origin --delete epic/e18-android-port`).

### E18-T28 · Release Line Siege to Google Play internal testing (Android step 8)

- **Goal:** A signed Line Siege AAB, which the owner's internal testers install from Play, so the owner can play-test it and test the real purchase. If the owner's Play steps are not done yet, an honest keyless rehearsal and a slice report that names what is pending. This task runs on `main`, right after the merge, as releases must.
- **Skills:** `android-release-play`, `premium-purchase`, `privacy-and-network-audit`, `new-game-scaffold`, `git-commits-and-reporting`, `quality-gates`.
- **Tests first:**
  - `node skills/android-release-play/scripts/check-release-setup-android.mjs .` is run first and read. Before the owner's steps, it ends with only `owner-placeholder` lines (the Android AdMob ids, GP5, and the links if G3 is still pending), then `OWNER STEPS PENDING: ...`, then `RESULT: FAIL`. That is the expected result, never fixed by editing the gate.
  - Any other FAIL line gets a failing tooling test before its fix.
- **Build:**
  1. **With the owner's Play steps done and the owner's go in this session:**
     - put the GP5 ids into `apps/line-siege/game.config.ts` (data only: `ads-config.test.ts` already proves a live build uses the game's ids) and commit `chore(line-siege): add the android admob ids` with `npm run -s check:fast` green;
     - run `npm run release:android -- --app line-siege --track internal`. It runs `npm run verify`, bumps the shared build number and commits `chore(line-siege): build <n>`, runs a clean prebuild and `bundleRelease` signed with the upload key, runs the store-AAB gate, uploads to the internal track, and tags `line-siege/v1.0.0+<n>`;
     - if the API refuses this app's first upload, the owner uploads the AAB Claude built through the Play Console (GP7), and the next release uses the API;
     - write the release report from `templates/evidence-release.md`, with "Owner steps (not blocking)": the Android play-test with the purchase test (buy, cancel, pending, restore after a reinstall), the TalkBack spot check, the fa and ckb review, and the sound previews.
  2. **Without them:**
     - run the keyless rehearsal that android-release-play's release-pipeline reference describes (an unsigned store/off AAB from a clean prebuild);
     - run `node skills/android-release-play/scripts/check-store-aab.mjs --unsigned --aab <the rehearsal AAB> --variant store --ads off --version 1.0.0 --build <n> --game line-siege .`;
     - write a slice report. It lists the rehearsal and the placeholder results under "Not tested or not verified", and O10 and GP1-GP7 (plus G3 if pending) under "Owner steps (not blocking)".
- **Done when:**
  - **With the owner's steps:**
    - `node skills/android-release-play/scripts/check-release-setup-android.mjs .` prints `RESULT: PASS`;
    - `node skills/android-release-play/scripts/check-store-aab.mjs --aab apps/line-siege/android/app/build/outputs/bundle/release/app-release.aab --variant store --ads live --version 1.0.0 --build <n> --game line-siege .` prints `RESULT: PASS`;
    - the build is on the internal track;
    - `node skills/git-commits-and-reporting/scripts/check-tags.mjs .` and `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-line-siege-android-internal.md --kind release` print `RESULT: PASS`.
  - **Without them:**
    - the rehearsal printed `REHEARSAL: not a release gate` and ended with only `owner-placeholder` lines and `OWNER STEPS PENDING: ...`;
    - `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-line-siege-android-rehearsal.md --kind slice` prints `RESULT: PASS`.
  - `node skills/new-game-scaffold/scripts/check-game-app.mjs . --app line-siege --stage complete` gives the same result as before this epic.
- **Owner:** The owner's go before any upload, tag push or `main` push (android-release-play rule 1). The first upload in the Play Console, if the API refuses it. After the upload, the owner's own checks: the play-test, the Tier 3 purchase test from the internal track, and the TalkBack spot check. They are listed, and nothing waits for them.

## Close the epic

1. Re-run every task's "Done when" and `npm run verify`; all green.
2. Run `/simplify` over the branch's changes (`git diff main...HEAD`). Apply its fixes; where behaviour changes, test first. Then run `npm run verify` again.
3. Run `/code-review` on the branch. Fix every confirmed finding test-first (a failing test that shows the problem, then the fix). Then run `npm run verify` again.
4. Write the epic's evidence report (git-commits-and-reporting, slice form) and check it with `node skills/git-commits-and-reporting/scripts/check-report.mjs <report> --kind slice`.
5. Merge: `git switch main && git merge --no-ff epic/e18-android-port && git push origin main`, then delete the branch. The push to `origin` needs the owner's word in this session (git-commits-and-reporting rule 5); without it, `main` stays local and the report says so.
