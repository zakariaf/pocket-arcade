# The screenshot matrix

Every Pocket Arcade screen in 4 languages × light and dark × phone and tablet, captured on the simulator, compared with committed baselines and shown to the owner in one gallery.

## Contents

- What is captured
- Capturing a still, deterministic screen
- Running it
- Baselines
- Reviewing: open every changed PNG
- The gallery
- The 200% text pass
- Android: screenshots:android
- Screenshots and the Toybox design

## What is captured

4 languages (en, de, fa, ckb) × light/dark × phone/tablet × 11 screens = 176 PNGs per game. The 11 screens: `home`, `levels`, `daily`, `stats`, `settings`, `premium`, `how-to-play`, and the game's example states `game-start`, `game-middle`, `result-win`, `result-lose`. The matrix flow (`templates/packages/shell/e2e/screenshots/matrix.yaml`) clears state, applies `lang=${LANG}&theme=system&seed=42&date=2026-09-26&ads=off&premium=0&offline=0&firstRun=0&reduceMotion=1&stars=demo`, then runs `shoot-screen.yaml` once per screen with `SCREEN` (the debug-link screen value and the PNG name) and `ROOT` (the testID that proves the screen is shown: `<route>.screen`, and `game.screen` or `result.screen` for the four game states).

## Capturing a still, deterministic screen

An animating screen differed by 1.08% between two captures one second apart (verified), far above the 0.2% tolerance. So:

- status bar pinned to 9:41 with full bars and battery, no charging bolt and no carrier name (ios-simulator-build's `statusBarArgs`, the same one `build:ios:sim` pins);
- reduce motion on (`reduceMotion=1`), `waitForAnimationToEnd` before each shot;
- ads off (an `ADS_MODE=off` test build), fixed seed and date, the `demo` progress fixture;
- `theme=system`, with the simulator appearance switched between light and dark (`simctl ui <udid> appearance`);
- one device model and runtime per baseline set: `phone` = iPhone 17 Pro Max, `tablet` = iPad Pro 13-inch (M5), both iOS 26.5, on dedicated simulators `e07-shots-phone` and `e07-shots-tablet`.

## Running it

`npm run screenshots:ios -- --app <game-id> [--update] [--devices phone,tablet] [--langs en,de,fa,ckb] [--text-size <size>] [--sim <purpose>] [--app-path <.app>] [--driver-port <n>]`

`--help` prints every option; a bad command line exits 2 with the usage line (`screenshots-cli.ts`, with its test). `--sim <purpose>` captures on this session's own simulators, `e07-<purpose>` (phone) and `e07-<purpose>-tablet` (iPad), instead of the shared `e07-shots-phone` and `e07-shots-tablet`, which another session may be using: a session always passes it.

`templates/packages/tooling/src/e2e/capture-screenshots-ios.ts` first runs `install-maestro.sh` (idempotent, checksum-verified), then, for each device: ensure and prepare its simulator; for light then dark: set the appearance; for each language: run `maestro --device <udid> --driver-host-port <port> test matrix.yaml` (through `runMaestro`: the device's UDID and a free driver port of this capture, or the session's `--driver-port`) with `-e APP_ID -e APP_SCHEME -e LANG -e THEME` into `reports/screenshots/raw/<device>/<lang>-<theme>/`, then compare each PNG with its baseline through `compare-png.ts` (pixelmatch, threshold 0.1 per pixel, `MAX_DIFF_RATIO = 0.002` of pixels). Each device/language/theme combination is one job (`screenshot-matrix.ts`): a simulator that does not boot or a capture flow that fails becomes a `capture-failed` row (its error and Maestro log folder, `reports/screenshots/raw/<device>/<lang>-<theme>/`) and the next combination still runs. It always writes `reports/screenshots/summary.json` and `index.html` (failed combinations first, in red), prints `<n> screenshots, <m> changed, <k> combinations failed; gallery: reports/screenshots/index.html` and one `capture failed: <combination>: <error>` line each, and exits 1 when anything changed or failed; `check-e2e-report --screenshots` fails each such row (`screenshot-capture-failed`). A bad command line or a missing or ads-on build exits 2 with the message and no stack.

`comparePng` returns `match`, `mismatch` (with the diff PNG path), `size-changed` or `missing-baseline`.

**Verified on 2026-10-01** on the Line Siege pilot (the round-4 Shell with the round-5 templates, an `ADS_MODE=off` test build, Xcode 26.6, iOS 26.5), on the session's own simulators through `--sim r5-e2e-native`: the first run, `npm run screenshots:ios -- --app line-siege --update --sim <purpose>`, captured all 176 PNGs in 16 sets (phone and tablet, en, de, fa and ckb, light and dark) in 38 minutes and wrote them as baselines; each set was read as a contact sheet before the commit (fa and ckb right to left, the board left to right, nothing clipped). The next run without `--update` printed `176 screenshots, 0 changed` (every row `match`, 35 minutes), so the capture is still and repeatable, and `check-e2e-report.mjs . --app line-siege --screenshots` printed `Screenshots: 176 captured in 16 sets, 0 changed` with `RESULT: PASS`. In every set the Premium screen showed its note "Connect to the internet to buy or restore." without a price: the simulator build got no product from the store (the price only comes from the store), and that capture is stable from run to run. Plan for about 40 minutes per full run; while iterating narrow it with `--devices` and `--langs`.

## Baselines

- Path: `apps/<game-id>/e2e/baselines/<device>/<lang>-<theme>[-<text size>]/<screen>.png`. A gated path: every change needs a `Gate-Change:` trailer.
- First capture or an intended change: `npm run screenshots:ios -- --app <game-id> --update` (narrow it with `--devices` and `--langs`), open every new PNG with the Read tool, then commit with `Gate-Change: <which screens and why>`.
- Tolerance: 0.2% of pixels for full screens (0.1% for board goldens). Never raise it to hide a diff.
- A runtime or Xcode change regenerates all baselines in one dedicated commit, after the old baselines passed on the old runtime.
- `check-e2e-setup.mjs` checks that every set holds the same screens; with `--baselines` it also requires all 16 device/language/theme sets.

## Reviewing: open every changed PNG

Before calling UI work done, open every changed screenshot and its diff PNG with the Read tool and check direction (fa and ckb right-to-left, boards not mirrored unless the game opts in), clipping, overlap, truncated text and the right colours per theme. `node ${CLAUDE_SKILL_DIR}/scripts/check-e2e-report.mjs . --app <game-id> --screenshots` lists every changed row with its diff path and fails until each is either fixed or re-accepted.

Flaky screenshots: rerun once. A diff in a different place on each run means the screen is not still (animation, clock, random particles, a blinking caret): fix the setup, not the tolerance.

## The gallery

`write-gallery.ts` writes `reports/screenshots/index.html`: one row per screenshot with baseline | this run | diff (red pixels changed), changed rows first. For a release, open it for the owner (`open reports/screenshots/index.html`) and list at most five rows worth their look in the report.

## The 200% text pass

Spec 8.11 (text scaling): `npm run screenshots:ios -- --app <game-id> --text-size accessibility-extra-extra-extra-large` captures the same matrix at the largest accessibility size into `<lang>-<theme>-accessibility-extra-extra-extra-large/` sets. Check truncation and overlap by eye.

## Android: screenshots:android

`npm run screenshots:android -- --app <game-id>` (`capture-screenshots-android.ts`, Android step 7) runs the same `matrix.yaml`, unchanged, on Android and compares at the same tolerance:

- **Devices:** a phone AVD and a tablet AVD, `e07-android-shots-phone` (profile `pixel_8`) and `e07-android-shots-tablet` (`pixel_tablet`), or this session's own `e07-android-<purpose>` and `-tablet` (`--avd <purpose>`), on android-emulator-build's pinned `google_apis` image. The same Release APK of the test variant with ads off as `e2e:android` (`readApkApp` refuses any other).
- **Still screens:** on every start, `stillScreenCommands`: `adb -s <serial> shell settings put global window_animation_scale 0`, the same for `transition_animation_scale` and `animator_duration_scale`, then the demo-mode status bar (`settings put global sysui_demo_allowed 1` and the `com.android.systemui.demo` broadcasts from android-emulator-build's `demoModeCommands`: clock 9:41, full battery not charging, full wifi and no mobile icon, no notifications). Reduce motion, seed, date and the `demo` fixture come from the same debug link as on iOS.
- **Light and dark:** `adb -s <serial> shell cmd uimode night yes|no` with `theme=system`, then the demo status bar again (`themeCommands`, before every combination): the demo broadcasts sent right after a cold boot can reach SystemUI before it listens, and the first Android matrix run (E18-T24/T25) captured the real clock and the no-internet Wi-Fi mark until they were sent again.
- **Text size:** `settings put system font_scale 1.0` for the matrix, `--font-scale 2.0` for the 200 % pass (sets named `<lang>-<theme>-font-scale-2.0`; checked by eye).
- **Baselines:** `apps/<game-id>/e2e/baselines-android/<phone|tablet>/<lang>-<theme>/<screen>.png`, apart from the iOS baselines; `MAX_DIFF_RATIO = 0.002` and pixelmatch threshold 0.1, never raised (`check-e2e-setup` rule `screenshot-tolerance`). `--update` with `--devices` and `--langs` for the sets you mean, every PNG opened, a `Gate-Change:` trailer.
- **Reports:** `reports/screenshots-android/summary.json` and `index.html` (`writeGallery(rows, 'reports/screenshots-android')`); a combination that fails becomes a `capture-failed` row and the next one still runs. Check with `check-e2e-report.mjs . --app <game-id> --platform android --screenshots`.

Every adb call names the emulator's serial and every Maestro run its own driver port, as in `e2e:android`.

## Screenshots and the Toybox design

The matrix proves a screen did not change by accident, in every language and theme. Whether a screen matches its Toybox design screenshot in the first place is the `toybox-visual-parity` work; run it for every new or redesigned screen before accepting its baselines.
