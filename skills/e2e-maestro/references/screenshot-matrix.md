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
- Screenshots and the Toybox design

## What is captured

4 languages (en, de, fa, ckb) × light/dark × phone/tablet × 11 screens = 176 PNGs per game. The 11 screens: `home`, `levels`, `daily`, `stats`, `settings`, `premium`, `how-to-play`, and the game's example states `game-start`, `game-middle`, `result-win`, `result-lose`. The matrix flow (`templates/packages/shell/e2e/screenshots/matrix.yaml`) clears state, applies `lang=${LANG}&theme=system&seed=42&date=2026-09-26&ads=off&premium=0&offline=0&firstRun=0&reduceMotion=1&stars=demo`, then runs `shoot-screen.yaml` once per screen with `SCREEN` (the debug-link screen value and the PNG name) and `ROOT` (the testID that proves the screen is shown: `<route>.screen`, and `game.screen` or `result.screen` for the four game states).

## Capturing a still, deterministic screen

An animating screen differed by 1.08% between two captures one second apart (verified), far above the 0.2% tolerance. So:

- status bar pinned to 9:41 with full bars and battery (`simctl status_bar override`);
- reduce motion on (`reduceMotion=1`), `waitForAnimationToEnd` before each shot;
- ads off (an `ADS_MODE=off` test build), fixed seed and date, the `demo` progress fixture;
- `theme=system`, with the simulator appearance switched between light and dark (`simctl ui <udid> appearance`);
- one device model and runtime per baseline set: `phone` = iPhone 17 Pro Max, `tablet` = iPad Pro 13-inch (M5), both iOS 26.5, on dedicated simulators `e07-shots-phone` and `e07-shots-tablet`.

## Running it

`npm run screenshots:ios -- --app <game-id> [--update] [--devices phone,tablet] [--langs en,de,fa,ckb] [--text-size <size>] [--sim <purpose>] [--app-path <.app>] [--driver-port <n>]`

`--help` prints every option; a bad command line exits 2 with the usage line (`screenshots-cli.ts`, with its test). `--sim <purpose>` captures on this session's own simulators, `e07-<purpose>` (phone) and `e07-<purpose>-tablet` (iPad), instead of the shared `e07-shots-phone` and `e07-shots-tablet`, which another session may be using: a session always passes it.

`templates/packages/tooling/src/e2e/capture-screenshots-ios.ts` first runs `install-maestro.sh` (idempotent, checksum-verified), then, for each device: ensure and prepare its simulator; for light then dark: set the appearance; for each language: run `maestro --device <udid> --driver-host-port <port> test matrix.yaml` (through `runMaestro`: the device's UDID and a free driver port of this capture, or the session's `--driver-port`) with `-e APP_ID -e APP_SCHEME -e LANG -e THEME` into `reports/screenshots/raw/<device>/<lang>-<theme>/`, then compare each PNG with its baseline through `compare-png.ts` (pixelmatch, threshold 0.1 per pixel, `MAX_DIFF_RATIO = 0.002` of pixels). It writes `reports/screenshots/summary.json` and `index.html`, prints `<n> screenshots, <m> changed; gallery: reports/screenshots/index.html`, and exits 1 when anything changed. A capture flow that fails stops the run; its Maestro log is under `reports/screenshots/raw/<device>/<lang>-<theme>/`.

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

## Screenshots and the Toybox design

The matrix proves a screen did not change by accident, in every language and theme. Whether a screen matches its Toybox design screenshot in the first place is the `toybox-visual-parity` work; run it for every new or redesigned screen before accepting its baselines.
