---
name: android-emulator-build
description: Builds Pocket Arcade Android apps - Release APK via Gradle assembleRelease on JDK 17, clean prebuild, test/store variant proof, e07-android AVD by adb serial, screencap, APK check. Use when a game must build, run or be proven on Android or an emulator. Not for Play uploads (android-release-play).
---

# Android emulator build

Turns `apps/<game>` into a Release Android app with one command, `npm run build:android:emu`, runs it on a dedicated emulator and proves what was built: the package, the variant (test code present in test builds, absent in store builds), the permissions, the manifest flags, and a screen that actually draws. No Android Studio GUI, no Metro, no Play signing.

## Rules that must hold

1. **Build only through `npm run build:android:emu -- --app <game> [--variant test|store] [--ads off|test|live]`, from `npx expo prebuild --platform android --clean`. Never edit or commit `android/`.** Continuous Native Generation regenerates `android/` and drops hand edits; every setting goes into `app.config.ts`, `withShell` or a config plugin.
2. **Use JDK 17 through `JAVA_HOME` (Android Studio's JBR) and `ANDROID_HOME` with the pinned SDK parts; never switch the Mac's Java.** AGP 8.12 and Gradle 9 run on JDK 17, and other projects on this Mac rely on the global default.
3. **Export `APP_VARIANT`, `EXPO_PUBLIC_APP_VARIANT` (same value) and `ADS_MODE` once for the whole run, and key Metro's `cacheVersion` on the variant.** The variant enters the APK three times (prebuild, expo-constants' Gradle task, Metro), and Metro's cache ignores it: verified on iOS, a store build after a test build shipped the debug module.
4. **Use `assembleRelease` for emulator APKs, for the emulator's ABI only (`-PreactNativeArchitectures=arm64-v8a`, `gradleEmuArgs`); `bundleRelease` with every ABI belongs to the Play release only (android-release-play).** An emulator installs an APK and runs one ABI, so compiling the other three only costs time, and a second AAB path outside the release tooling would bypass the store gate.
5. **Name AVDs `e07-android-<purpose>` and give them the pinned `google_apis` arm64 image; never use a Play Store image for checks.** `adb root`, which the kill test and save inspection need, fails on Play Store images, and the prefix is what keeps other projects' AVDs untouched.
6. **Start each AVD on a free console port, target it as `emulator-<port>` and pass `adb -s <serial>` in every call. Never `adb kill-server`, and never start, change or delete another project's AVD.** Several sessions and emulators share this Mac's adb server; a call without a serial reaches whichever device answers.
7. **Wait on `sys.boot_completed` and the app's ready signal, never a fixed sleep; take the screenshot with `adb -s <serial> exec-out screencap -p` and look at it.** A build that succeeded can still launch to a blank screen or Roboto instead of Lilita One; only the picture shows it.
8. **Set `EXPO_NO_TELEMETRY=1` and `CI=1` in every tooling process.** No telemetry, and no prompt that would hang an unattended run.
9. **Owner steps are asked for, never worked around: JDK 17 (Android Studio), SDK downloads and SDK licences.** A missing NDK or system image is a large download into the owner's SDK, and a licence is the owner's to accept; the preflight stops (exit 2) before Gradle could download anything by itself.
10. **A build proves itself with `check-emu-app`: package `io.applander.<game id without hyphens>`, the test sentinel only in test builds, the variant in `assets/app.config` and the `E07AppVariant` meta-data, Google's Android sample AdMob id except in live builds, permissions on the allowlist, not debuggable, `supportsRtl` true and `allowBackup` not false.** These are what players get (N3, N6, N11, D5, owner decision O4); a live build without the owner's Android AdMob ids fails `owner-placeholder` and ends `OWNER STEPS PENDING: GP5`, the expected result until owner step GP5.

## Workflow

1. **First time in a repo, or when the preflight or `check-emu-setup` fails on the toolchain:** read [references/environment-and-sdk.md](references/environment-and-sdk.md) (the pins, what this Mac has and lacks, JDK selection, downloads and licences, owner steps) and [references/build-variants.md](references/build-variants.md) (the matrix, the three moments, the Metro trap, the gate and the manifest marker).
2. **Install the templates that are missing** (copy each to the same path in the repo; the first line of each names it). This is Android step 1 of pocket-arcade-index's Android order:

   | Template | Goes to |
   |---|---|
   | `templates/packages/tooling/src/android/toolchain.ts` + `toolchain.test.ts` | same paths (`JDK_MAJOR`, `ANDROID_PINS`, `selectAndroidToolchain`, `androidToolEnv`) |
   | `templates/packages/tooling/src/android/emulators.ts` + `emulators.test.ts` | same paths (`avdName`, `freeConsolePort`, `emulatorArgs`, `adbArgs`, `demoModeCommands`) |
   | `templates/packages/tooling/src/android/emulator-device.ts` | same path (the device side: create, start, boot, adb; marked device-only) |
   | `templates/packages/tooling/src/build/emu-build-plan.ts` + `emu-build-plan.test.ts` | same paths (arguments, commands, paths, `packageNameOf`) |
   | `templates/packages/tooling/src/build/build-android-emu.ts` | same path (the CLI) |

   They reuse files the iOS build already brought: `build/sim-build-plan.ts` (`variantEnv`, `readyReason`), `build/game-id.ts`, `ios/tool-step.ts`, `ios/sim-app.ts` (`readPerfLogPayload`), `clock/system-clock.ts` and the Shell's `config/app-variant.ts`. Copy each test before its module against a typed stub and see it fail on an assertion (tdd-workflow). Root `package.json` script, byte for byte as quality-gates has it: `"build:android:emu": "node packages/tooling/src/build/build-android-emu.ts"`. Then `npm run -s check:fast`.
3. **Check the setup:** `node ${CLAUDE_SKILL_DIR}/scripts/check-emu-setup.mjs .` from the repo root. Fix every `FAIL` line (file, rule, fix) and rerun until `RESULT: PASS`.
4. **Build and run:** `npm run build:android:emu -- --app <game> --variant test --ads off` (`--help` prints the options; `--avd <purpose>` picks the emulator, default `e07-android-smoke`). It stops with exit 2 before anything is touched when JDK 17, a pinned SDK part or the emulator image is missing: ask for the download (rule 9). Read [references/emulator-commands.md](references/emulator-commands.md) when a step fails, when you run a step by hand, or before changing the script. The run prints the APK path, the serial and the screenshot path.
5. **Prove the build:** `node ${CLAUDE_SKILL_DIR}/scripts/check-emu-app.mjs --apk apps/<game>/android/app/build/outputs/apk/release/app-release.apk --variant test --ads off --game <game> --screenshot reports/android/<game>/smoke-test-off.png`, then open the PNG with the Read tool and look at it: S1 or S2, the title in Lilita One, the board drawn where shown, no crash dialog, not black, white or blank.
6. **When the change touches variants, `metro.config.js`, `test-only*`, `withShell`, a plugin or the build tooling:** build the store variant right after the test variant, without clearing any cache (`--variant store --ads off`, or `--ads live` once the game has its Android AdMob ids), run `check-emu-app.mjs` on both, and check `unzip -p <apk> assets/index.android.bundle | grep -a -c SHELL_TEST_BUILD_ONLY` prints 0 for the store APK.
7. **On any failure**, match the first error line in [references/failures.md](references/failures.md), fix the cause (never the check), rerun the failing step, then the checks. A failure that is not there goes through troubleshooting-playbook's `find-fix.mjs --log <log>`.
8. **Shut down your emulators** at the end of the task, by serial: `adb -s emulator-<port> emu kill`. Delete an AVD only when it is yours and no longer needed.
9. **Report** in plain words: game, variant and ads, AVD and serial, screenshot path and what it shows, and the `RESULT` lines of both checkers.

## Definition of done

- [ ] `npm run build:android:emu -- --app <game> --variant <v> --ads <m>` ran from a clean prebuild and printed `ready (...)` with a screenshot path.
- [ ] The screenshot was opened and looked at, and shows the intended screen (not black, white or blank, the title in Lilita One).
- [ ] For variant or tooling changes: a test and a store build made back to back both pass `check-emu-app.mjs`, and the store APK's sentinel count is 0.
- [ ] Only `e07-android-*` AVDs were created, started or deleted, every adb call named its serial, no SDK part was downloaded or licence accepted without the owner's word, and the session's emulators are shut down.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-emu-app.mjs --apk <apk> --variant <v> --ads <m> --game <game> --screenshot <png>` prints `RESULT: PASS` (a store build may end only with `owner-placeholder` lines and `OWNER STEPS PENDING: ...` while owner steps are pending).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-emu-setup.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Opening `android/` in Android Studio to fix a Gradle setting.** The next prebuild erases it; put it in `withShell` or a config plugin.
- **`/usr/libexec/java_home -v 21` or a Homebrew JDK because Gradle complained.** Point `JAVA_HOME` at the JBR for this process only (`androidToolEnv`).
- **Letting Gradle "just download" the NDK.** That is an unasked download into the owner's SDK; the preflight stops first, ask, then `sdkmanager`.
- **`APP_VARIANT=store npx expo prebuild` and then `./gradlew assembleRelease` in a fresh shell.** expo-constants and Metro then see no variant; export once and keep it.
- **`adb shell ...` without `-s`, or `adb kill-server` to "fix" an offline device.** The first reaches a random device; the second breaks every other session's emulators.
- **Running checks on `Pixel_8a_API_35` because it is already there.** It belongs to another project and is a Play Store image without `adb root`; create `e07-android-<purpose>`.
- **`sleep 60 && adb exec-out screencap`.** Too short on a cold boot, wasted time on a warm one; poll `sys.boot_completed` and the ready signal.
- **`npx expo run:android` or `./gradlew installDebug` to "check quickly".** Debug builds load JS from Metro and differ from what players run; the smoke test is the Release APK.
- **Declaring success from `BUILD SUCCESSFUL`.** Install, launch, screenshot, check and look.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/environment-and-sdk.md](references/environment-and-sdk.md) | The pins and their sources, what this Mac has and lacks, JDK 17 per process, `ANDROID_HOME`, downloads and licences, the tool environment, first-build downloads, .gitignore, owner steps | Workflow step 1, and when the toolchain or the Mac changes |
| [references/build-variants.md](references/build-variants.md) | The variant matrix on Android, the three moments, the Metro trap, the test-only gate in `index.android.bundle`, the `E07AppVariant` meta-data, the AdMob id per mode, what check-emu-app reads | Workflow steps 1 and 6 |
| [references/emulator-commands.md](references/emulator-commands.md) | Every command of the run: avdmanager, the emulator on a free port, boot polling, demo mode, install, launch, ready, screencap, reading the save, shutting down, commands never run | Workflow step 4, and when running a step by hand |
| [references/failures.md](references/failures.md) | Symptom, cause and fix for environment, prebuild, Gradle, Kotlin, NDK, Hermes, Metro, variant, emulator and adb failures | Workflow step 7, whenever something fails |
| `templates/packages/tooling/src/android/` | `toolchain.ts` (JDK 17, SDK pins, tool env), `emulators.ts` (AVD names, ports, adb arguments, demo mode), `emulator-device.ts` (the device side, device-only) and the tests of the first two | Workflow step 2 |
| `templates/packages/tooling/src/build/` | `emu-build-plan.ts` (pure plan) and its test, `build-android-emu.ts` (the CLI) | Workflow step 2 |
| `scripts/check-emu-setup.mjs` | Checks the repo setup: the npm script and tooling files, .gitignore, the Metro cache key, adb serials, AVD names, the JDK 17 pin, no Play Store image, assembleRelease | Workflow step 3 and the definition of done |
| `scripts/check-emu-app.mjs` | Checks a built APK against its variant: package, sentinel, app.config, the variant meta-data, the AdMob id, owner placeholders by field (`OWNER STEPS PENDING`), permissions, debuggable, supportsRtl, allowBackup, SDK levels, a blank screenshot | Workflow steps 5-6 and the definition of done |
| `scripts/lib/apk.mjs` | The parsers of `aapt2 dump badging` and `dump xmltree` | Never by hand |
| `scripts/lib/zip.mjs` | Zip reader (node:zlib) for APKs and AABs (synced from the library, the same reader android-release-play uses; do not edit here) | Never by hand |
| `scripts/lib/manifest-tree.mjs` | `findElements` and `metaDataValue` over a parsed manifest tree (synced from the library; do not edit here) | Never by hand |
| `scripts/lib/png.mjs` | PNG decoder and the one-colour measure used by the screenshot rule | Never by hand |
| `scripts/lib/ship-placeholders.mjs` | The scaffold placeholders a ship gate refuses, with their owner steps (G3, G5, GP5) and the `OWNER STEPS PENDING` line (synced from the library; do not edit here) | Never by hand |
| `assets/permission-allowlist.json` | The permissions a Pocket Arcade APK may hold, each with who declares it (synced from the library, the same list android-release-play and privacy-and-network-audit check; do not edit here) | When check-emu-app reports `permission` |
| `scripts/selftest.mjs` | Proves both checkers pass good fixtures and catch every planted bug (APKs read through a fake aapt2) | After changing a checker, the allowlist or a template |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad repos (`emu-setup/`), APKs with their aapt2 dumps and screenshots (`emu-app/`, `emu-app-store/`), and `fakes/fake-aapt2.mjs` | When adding a rule to a checker |

## Related skills

- `android-release-play` - the signed AAB, the store-AAB gate and the upload to Google Play internal testing.
- `ios-simulator-build` - the iOS twin of this skill; the variant files and the test-only gate are shared.
- `architecture-and-boundaries` - `withShell`, the Android block, the variant marker plugin and where the variant files live.
- `troubleshooting-playbook` - failures outside this skill's table (`find-fix.mjs`).
- `e2e-maestro` - flows and the screenshot matrix on top of a test-variant emulator build.
- `toybox-visual-parity` - comparing Android screens with their design screenshots.
