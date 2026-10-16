# The parity simulator and the app capture

How `setup-parity-sim.mjs` and `capture-app.mjs` get a screenshot and element bounds that can be compared with the design, and the pitfalls each step avoids. Everything here was measured on 2026-09-28 (macOS 27.0, Xcode 26.6, iOS 26.5 runtime 23F77, Maestro 2.10.0 on Java 17).

## Contents

- The parity device
- Tooling in a read-only or shared skill folder
- The dedicated simulator
- Status bar, locale, appearance and text size
- Launching straight into a frame
- The board probe launch (S5, S6, S7)
- Taking the screenshot
- Element bounds with maestro hierarchy
- Fast iteration after a JavaScript-only change
- Android: the parity emulator and its capture
- Human steps

## The parity device

| Fact | Value |
|---|---|
| Model | iPhone 16 Pro (`com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro`) |
| Runtime | iOS 26.5 (`com.apple.CoreSimulator.SimRuntime.iOS-26-5`) |
| Screen | 402 x 874 pt at 3x = 1206 x 2622 px |
| Safe area | top 62, bottom 34 (status bar 54) |
| Dynamic Island | x 138.3, y 14.0, 125.3 x 36.7 pt (drawn in screenshots) |

The Toybox mockup phone is 390 x 844 with a 54 pt status bar. No simulator has that geometry with a Dynamic Island (iPhone 16e/17e are 390 x 844 but have a notch and a 47 pt top), so the references are rendered at the parity device's geometry instead: the design screen becomes 402 x 874 with a 62 pt status bar, and Toybox's flex layout reflows cleanly. Everything lives in `assets/device/iphone16pro.json`; scripts read it, never a hard-coded number.

Xcode 26.6 lists only the iPhone 17 family under iOS 26.5 by default, but `xcrun simctl create` accepts the iPhone 16 Pro type with the iOS 26.5 runtime. That is what the setup script does.

## Tooling in a read-only or shared skill folder

The scripts load pngjs, pixelmatch and playwright from a tooling folder: `--tooling <dir>`, else `$PARITY_TOOLING_DIR`, else the skill's own `scripts/` folder. When the skill folder must stay read-only, or several sessions share it, install the pinned packages into the app repo and point every script at them:

```sh
mkdir -p .parity/tooling
cp ${CLAUDE_SKILL_DIR}/scripts/package.json ${CLAUDE_SKILL_DIR}/scripts/package-lock.json .parity/tooling/
npm ci --prefix .parity/tooling
export PARITY_TOOLING_DIR="$PWD/.parity/tooling"     # or pass --tooling .parity/tooling to each script
```

`.parity/` is gitignored, so the install stays out of git. Every script writes only into the app repo (`.parity/` runs and sheets, `parity/` ledger and waivers, `reports/`), never next to itself; the one exception is `shoot-design.mjs --update-reference`, which rewrites the skill's committed reference set after a design change. A missing package stops a script with exit 2 and both install forms.

## The dedicated simulator

`setup-parity-sim.mjs --appearance light|dark --name e07-parity-<key>` creates (once) and boots this session's parity simulator (the default name is **e07-parity**; tools name their simulators `e07-<purpose>`). It prints the UDID, never touches another simulator, so other tasks' devices are safe, and every capture of the session runs on the same device. `--check` changes nothing and fails with a rule id when something is off: `sim-missing`, `sim-not-booted`, `sim-wrong-model`, `sim-duplicate`, `sim-locale`, `sim-status-bar`, `sim-appearance`, `sim-content-size`, `sim-increase-contrast`. A same-named device on the wrong model or runtime is only replaced with `--recreate` (it asks for nothing else and adds no second device next to it).

**One parity simulator serves one session.** Two sessions capturing on one simulator overwrite each other's launches, and a Maestro call that names no device or shares a driver port can be answered by another simulator's XCUITest driver (round 3: another session's Persian Settings screen came back, even with a separate port). So:

- each session makes its own simulator (`--name e07-parity-<key>`) and passes `--name` to every script;
- every Maestro call names the simulator's UDID and this run's own driver port before the command: `maestro --device <udid> --driver-host-port <port> hierarchy` (built by `maestroArgs()` in `scripts/lib/tools.mjs`, the same rule as the repo's `maestroGlobalArgs()`); the port is `--driver-port` (or `PARITY_MAESTRO_PORT`) when a session passes one, else a free port picked by listening on port 0, once per `run-parity.mjs` run;
- every launch carries a nonce that the parity root shows as `parity.launch.<nonce>`; a dump without it is read again (up to three dumps, 2 s apart, for the rare dump taken before the app's tree is attached) and then refused with exit 2, "hierarchy from another simulator" (parity-harness.md, "The launch nonce");
- every `simctl` call names the UDID, never `booted` or `all`.

```sh
node ${CLAUDE_SKILL_DIR}/scripts/setup-parity-sim.mjs --appearance light --name e07-parity-b
node ${CLAUDE_SKILL_DIR}/scripts/run-parity.mjs --screen S11 --bundle-id io.applander.linesiege --name e07-parity-b
```

`run.json` records the simulator's name, UDID and driver port and the launch nonces. Each session installs its build on its own simulator (`xcrun simctl install <udid> <App>.app`).

**When the session is done**, shut down its own simulator by UDID (`xcrun simctl shutdown <udid>`) and stop anything it started (Metro, Maestro drivers, log streams). Never shut down a simulator the session did not create. If this session's simulator is wedged (boot hangs, `simctl` errors on it), shut down only it by UDID, quit Simulator.app if nothing else uses it, and run the setup script again.

## Status bar, locale, appearance and text size

- **Status bar override**: `xcrun simctl status_bar <udid> override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 --operatorName '' --batteryState discharging --batteryLevel 100`. `charged` would draw a lightning bolt; `discharging` at 100 draws a plain full battery.
- **The override is cleared by every reboot.** The setup script and `capture-app.mjs` re-apply it when `status_bar list` does not show it.
- **24-hour clock.** A simulator inherits the host region (here `en_US@rg=dezzzz`), and "9:41" then renders as "09:41". The setup script writes `AppleLocale en_US`, `AppleLanguages (en)` and `AppleICUForce12HourTime` into the simulator's global defaults and reboots once.
- `--time` accepts `9:41` or an ISO date with milliseconds (`2026-09-27T09:41:00.000Z`); "9:41 AM" and ISO dates without milliseconds are rejected.
- The accessibility tree still reports the real clock, and the status bar is masked in every comparison anyway: the override keeps the sheets clean and the screenshots stable.
- `xcrun simctl ui <udid> appearance light|dark` sets the theme (no value prints it); `content_size large` is the default text size that matches the design's 17 pt body; `increase_contrast disabled`.
- **No system alert.** `capture-app.mjs` checks every dump for a system alert (Apple's tracking prompt, a permission prompt, an "Open in ...?" alert) and fails with `system-alert` when one is up; `run.json` records `systemAlert: null` otherwise. The held S3 consent moment asks neither Google's form nor Apple's prompt.

## Launching straight into a frame

```
xcrun simctl launch --terminate-running-process <udid> io.applander.linesiege \
  -AppleLanguages "(fa)" -AppleLocale fa_IR \
  -parity "frame=s4-home&theme=dark&lang=fa&game=lineSiege&date=2026-09-27&animations=off&nonce=3f9a0c1d2e4b"
```

- Launch arguments of the form `-key value` land in NSUserDefaults; React Native's `Settings.get('parity')` reads them in a Release build. The app's test-only parity harness turns the query into the frame's state (see [parity-harness.md](parity-harness.md)).
- `-AppleLanguages "(fa)" -AppleLocale fa_IR` makes the app start in Persian with right-to-left layout (`(ckb)` also gives RTL, `(de)` LTR), provided the app declares those languages (expo-localization `supportedLocales`).
- `capture-app.mjs` passes each argument as its own word. In zsh an unquoted variable holding `-AppleLanguages (fa)` arrives as one word and is ignored.
- **Never use deep links for parity.** `simctl openurl` for a custom scheme shows a SpringBoard alert "Open in ...?" (cold and warm); pending alerts queue up, dim the app and hide every testID, which fails the capture as `screen-not-reached`.
- **Nothing else in front.** Another app in front adds a "back to" breadcrumb to the status bar; `capture-app.mjs` terminates other apps first (except Maestro's driver, whose restart would cost 20 s).
- **The reference follows the app's facts.** For `s11-settings`, `s6-pause`, `s7-result-win` and `s14-reset-all-progress`, `capture-app.mjs` reads `parity/game-facts.json` (in the working directory, the app repo root; `--facts <file>` otherwise) and records the reference variant it picked in `run.json` (`variant`), printing for example `reference s6-pause--no-music--no-hints (hasMusic false, hasHints false; L1, L8)`. A missing fact or a mismatched facts file stops the capture with exit 2.
- **Release test build, not Debug**: no LogBox or dev overlays, and the test variant so `TEST_ONLY` (and with it the harness) exists. Build it with `APP_VARIANT=test EXPO_PUBLIC_APP_VARIANT=test ADS_MODE=off` exported for the whole run (screenshots never load ads and never ask for tracking; the harness draws the stand-in banner). The build itself is the `ios-simulator-build` skill's job (`xcodebuild ... -destination id=<udid>`); install it on the parity simulator with `xcrun simctl install <udid> <App>.app` (`setup-parity-sim.mjs` prints the udid). Every app's bundle id is `io.applander.<game id without hyphens>` (Line Siege: `io.applander.linesiege`); confirm it with `plutil -extract CFBundleIdentifier raw -o - <App>.app/Info.plist`.

## The board probe launch (S5, S6, S7)

A Game-route frame (`s6-pause`, `s7-result-win`, `s7-result-lose`) masks the board the game draws, and the board is where the game says it is. Before the real capture, `capture-app.mjs` launches the frame once more with `probe=board` added to the `-parity` query:

```
-parity "frame=s6-pause&theme=light&lang=en&game=lineSiege&date=2026-09-27&animations=off&probe=board&nonce=9c2e0b7a41d5"
```

That launch opens no frame state (no Pause, no Result) and turns the board-layout probe on, so the board host renders `game.board-layout`: a small text inside the board frame holding `{ "x", "y", "layout": { "width", "height", "isMirrored", "regions" } }`, the canvas origin and `BoardLayout` in window points. The script waits for a still screen, reads that text from `maestro hierarchy`, and records the rectangle `{ x, y, w: layout.width, h: layout.height }` in `run.json` as `board` (with `source: "probe=board"`). `run-parity.mjs` passes each capture a cache file, so the probe runs once per device, theme and language in a run (the board does not move between S6 and S7). A probe without a usable `game.board-layout` fails `board-probe`; a Game-route run without `board` makes `check-parity.mjs` stop with exit 2.

## Taking the screenshot

- `xcrun simctl io <udid> screenshot --type=png app.png` returns a 1206 x 2622 RGBA sRGB PNG in about 0.16 s. Corners are not masked, the Dynamic Island is drawn, the home indicator is not in the image.
- Captures are deterministic: two screenshots of the same screen had 0 differing pixels, 1 s apart and across a reboot. Flat React Native fills come out as the exact token hex values, the same as Chrome's.
- **Stable screen.** `capture-app.mjs` waits 1 s, then takes screenshots 300 ms apart until two in a row match outside the masks (within 3/255: iOS re-dithers hard shadows on a redraw), up to the frame's `settleMs` (8 s by default, 10 s for tall frames).
- **Late loads.** A launch screen or a loading state can hold still for 300 ms. After the hierarchy dump the script takes one more screenshot; if the screen changed, it settles again and dumps again, three attempts in all, then fails with `changed-during-capture`. Seen live: the first still screen of a cold start was the white launch screen.

## Element bounds with maestro hierarchy

`maestro --device <udid> --driver-host-port <port> hierarchy --no-reinstall-driver` prints a JSON tree. Each node's `attributes` has `resource-id` (the React Native `testID`), `accessibilityText` (the accessibility label; for a Text it is the text), `bounds` as `[x0,y0][x1,y1]`, and more.

- **Units are points** (screen 402 x 874), rounded to whole points: an edge at 140.67 pt was reported as 140. Treat bounds as 1 pt accurate; the 2 pt tolerance includes this.
- **Only on-screen elements are listed.** In a 90-tile ScrollView only the visible tiles appeared; a partly visible tile was listed with its full, unclipped bounds. Tall frames are therefore captured at several scroll offsets (`--scroll`, whole points; `run-parity.mjs` plans them), and coverage is the union of the elements each capture shows whole.
- **Accessible elements hide their children, and hidden parts are not listed.** An accessible Pressable is reported with its label; its inner Text does not appear at all. A view with `accessibilityElementsHidden` (the components' decorative logo, icon and art tiles, pager dots ...) is missing from the dump with everything inside it. So a testID belongs on the accessible element itself, and the map's crop-only parts (`parent` or `a11yHidden`) are checked through the crop of their `coveredBy` element.
- **System elements** (status bar clock, Wi-Fi bars, breadcrumb) appear too; the scripts ignore nodes whose `resource-id` is not a testID.
- **Device and driver port**: every call is `maestro --device <udid> --driver-host-port <port> ...`, the global options before the command (see The dedicated simulator); after each dump `capture-app.mjs` looks for the launch's `parity.launch.<nonce>` marker.
- **Speed**: about 19 s for the first call (it installs the XCUITest driver `dev.mobile.maestro-driver-iosUITests.xctrunner`), about 11 s after that.
- **Environment**: Java 17 (`$JAVA_HOME`, else Android Studio's bundled JBR, else `/usr/libexec/java_home -v 17`) and `MAESTRO_CLI_NO_ANALYTICS=true`, `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true`, `MAESTRO_DISABLE_UPDATE_CHECK=true`, all set by the scripts. Maestro is looked up in `--maestro`, `$PARITY_MAESTRO`, `$MAESTRO_BIN`, the repo's `tools/maestro/bin/maestro`, PATH, then `~/.maestro/bin/maestro`.
- `xcrun simctl` has no view-hierarchy command. If Maestro ever becomes the bottleneck, a test-build layout reporter that writes `app.layout.json` (`{ "elements": [{ "testID", "x", "y", "w", "h", "text" }] }` in points, from `measureInWindow`) is accepted by `check-parity.mjs` in its place (`capture-app.mjs --no-hierarchy`).

## Fast iteration after a JavaScript-only change

When native dependencies did not change, a new Release JS bundle can be swapped into the built app instead of rebuilding (about 5 s):

1. With the same three variables exported as for the build, `npx expo export:embed --platform ios --dev false --entry-file index.ts --bundle-output build/parity-bundle/main.jsbundle --assets-dest build/parity-bundle/assets` in the app folder (`apps/<id>/build/` is ignored by git; an `out/` folder there is not).
2. Copy `build/parity-bundle/main.jsbundle` into the built `<App>.app` (and the files under `build/parity-bundle/assets` when an image changed).
3. `codesign --force --sign - --deep <App>.app`.
4. `xcrun simctl install <udid> <App>.app`, then capture again.

Rebuild properly (the `ios-simulator-build` skill) after any native change, and always before the final sign-off captures.

## Android: the parity emulator and its capture

Every script takes `--platform ios|android` (default `ios`); the iOS path above is unchanged. On Android the same loop runs on an emulator, against a reference set of its own:

| Fact | Value |
|---|---|
| Device profile | `assets/device/android-phone.json` (`"platform": "android"`) |
| AVD | `e07-android-parity[-<key>]`, system image `system-images;android-35;google_apis;arm64-v8a` (android-emulator-build's image), base device `pixel_8` |
| Screen | 402 x 874 dp at density 3.0 (`hw.lcd.density=480`) = 1206 x 2622 px, the iPhone 16 Pro's logical size, so text wraps as in the iOS references (owner default d) |
| Insets | status bar 24 dp (masked), gesture navigation bar 24 dp; its handle (x 120, y 850, 162 x 24 dp) is masked because screencap draws it |
| Status bar | demo mode: 09:41, full battery, Wi-Fi, no notifications (`sysui_demo_allowed 1`, `com.android.systemui.demo` broadcasts) |
| References | `assets/reference-android/lineSiege/`, rendered by `shoot-design.mjs --device assets/device/android-phone.json` (no Dynamic Island, no drawn iOS clock); a new set for a new device, never a change to `assets/reference/` |
| Runs | `.parity/android/<game>/<frame>/<theme>-<lang>[-y<scroll>]/`, `run.json` `"platform": "android"` |

**The emulator.** `setup-parity-emu.mjs --appearance light|dark --name e07-android-parity-<key>` creates the AVD once (avdmanager, then the profile's `hw.lcd.*` and `hw.*` keys in its `config.ini`), boots it on a free console port with `-no-snapshot -no-boot-anim -no-audio -no-window`, and pins it: no `wm size` or `wm density` override, night mode for the appearance, `font_scale` 1.0, gesture navigation, demo mode on. It prints `serial <serial>`. It refuses any other AVD name, never downloads (a missing system image is exit 2: install it with android-emulator-build's step), never restarts the adb server, and never kills an emulator it did not start: a running one with the wrong geometry is reported (`emu-wrong-geometry`), since `config.ini` is read only at boot. `--check` changes nothing and fails with a rule id: `emu-missing`, `emu-wrong-image`, `emu-wrong-geometry`, `emu-duplicate`, `emu-not-booted`, `emu-size`, `emu-density`, `emu-night-mode`, `emu-font-scale`, `emu-navigation`, `emu-demo-mode`.

**One emulator per session, every call names it.** Every adb call is `adb -s <serial> ...`; `--serial` must run the `--name` AVD, or the capture fails `wrong-serial` (another project's or session's emulator is never captured). Maestro gets `--device <serial> --driver-host-port <port>`, and the launch nonce works as on iOS: a dump without `parity.launch.<nonce>` stops with exit 2, "hierarchy from another device".

**The launch.** `capture-app.mjs --platform android` sets night mode from `--theme`, sends demo mode again (SystemUI forgets it on a restart), sets the app's own locale (`cmd locale set-app-locales <package> --user current --locales fa-IR`, Android 13+), then cold-starts the app with `am start -S -W -n <package>/.MainActivity --es parity "<query>"`. Android has no launch arguments in NSUserDefaults: the query arrives as the launch intent's string extra `parity`, which the harness reads through the Shell's `ParityLaunch` native module in test builds only (parity-harness.md, "The contract"). An `Error:` line of `am start` (the activity or the package is missing) is exit 2, "the app did not launch".

**Screenshot and bounds.** `adb -s <serial> exec-out screencap -p` gives the 1206 x 2622 PNG (the still-screen rule is the same). Maestro's Android hierarchy gives bounds in pixels, so `run.json` records `hierarchyPxPerPt: 3` and `check-parity.mjs` divides by it (a run without it would compare pixels with points and fail `bounds`). Android's own dialogs fail `system-alert` like Apple's: a permission prompt ("Allow ... to", "While using the app"), "isn't responding", "keeps stopping", the "Open with" chooser.

**Judging.** An Android run is compared only with the Android set and the Android profile (`wrong-reference` otherwise, both ways), is signed off only by `check-signoff.mjs --platform android` with ledger entries that say `"platform": "android"`, and is waived only by Android waivers (signoff-and-waivers.md). Every gate number is the same as on iOS: an Android difference is fixed or waived, never tolerated by a wider number.

```sh
node ${CLAUDE_SKILL_DIR}/scripts/setup-parity-emu.mjs --appearance light --name e07-android-parity-b
node ${CLAUDE_SKILL_DIR}/scripts/run-parity.mjs --platform android --screen S4 --bundle-id io.applander.linesiege --name e07-android-parity-b
node ${CLAUDE_SKILL_DIR}/scripts/check-signoff.mjs --platform android --screen S4
```

**When the session is done**, stop its own emulator by serial (`adb -s <serial> emu kill`), never another one.

The insets are the AOSP values for a 480 dpi screen without a cutout under gesture navigation; no AVD had been made when the profile was written (E18-T07). `setup-parity-emu.mjs --check` proves the size and density, and the first capture proves the insets. A different measured inset is a deliberate profile change: re-render `assets/reference-android` and log it in its manifest's `referenceChanges`.

## Human steps

- Installing Xcode 26.6 and the iOS 26.5 simulator runtime (Xcode > Settings > Components, or `xcodebuild -downloadPlatform iOS -buildVersion 26.5`) is the owner's step if they are missing; the setup script says so and stops.
- Installing Maestro and Java 17 follows the `e2e-maestro` skill.
- The Android system image and the emulator come from the `android-emulator-build` skill's install step (an approved `sdkmanager` run); `setup-parity-emu.mjs` never downloads and stops with exit 2 when the image is missing.
