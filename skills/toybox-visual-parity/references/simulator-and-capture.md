# The parity simulator and the app capture

How `setup-parity-sim.mjs` and `capture-app.mjs` get a screenshot and element bounds that can be compared with the design, and the pitfalls each step avoids. Everything here was measured on 2026-09-28 (macOS 27.0, Xcode 26.6, iOS 26.5 runtime 23F77, Maestro 2.10.0 on Java 17).

## Contents

- The parity device
- The dedicated simulator
- Status bar, locale, appearance and text size
- Launching straight into a frame
- The board probe launch (S5, S6, S7)
- Taking the screenshot
- Element bounds with maestro hierarchy
- Fast iteration after a JavaScript-only change
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

## The dedicated simulator

`setup-parity-sim.mjs --appearance light|dark` creates (once) and boots a simulator named **e07-parity**. It never touches another simulator, so other tasks' devices are safe, and every capture runs on the same device. `--check` changes nothing and fails with a rule id when something is off: `sim-missing`, `sim-not-booted`, `sim-wrong-model`, `sim-duplicate`, `sim-locale`, `sim-status-bar`, `sim-appearance`, `sim-content-size`, `sim-increase-contrast`. A same-named device on the wrong model or runtime is only replaced with `--recreate` (it asks for nothing else and adds no second device next to it).

**One parity simulator serves one session at a time.** Two sessions capturing on one simulator overwrite each other's launches, and two sessions on one Mac share Maestro's default XCUITest driver port (22087), so one session's hierarchy call can be answered by the other simulator's driver (seen live: labels of another screen, `screen-not-reached` on a correct capture). A second session makes its own simulator and driver port and passes both to every script:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/setup-parity-sim.mjs --appearance light --name e07-parity-b
node ${CLAUDE_SKILL_DIR}/scripts/run-parity.mjs --screen S11 --bundle-id <id> --name e07-parity-b --driver-port 22187
```

`run-parity.mjs` forwards `--name` and `--driver-port` to every `capture-app.mjs` call; `PARITY_MAESTRO_PORT=22187` in the environment does the same as `--driver-port`. With a port, every Maestro call gets `--driver-host-port <port>`, and `run.json` records the simulator and the port. Each session installs its build on its own simulator.

If CoreSimulator is wedged (boot hangs, `simctl` errors): quit Simulator.app, run `xcrun simctl shutdown all`, then the setup script again. `shutdown all` stops every session's simulators: say so before doing it when another session may be capturing.

## Status bar, locale, appearance and text size

- **Status bar override**: `xcrun simctl status_bar <udid> override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 --operatorName '' --batteryState discharging --batteryLevel 100`. `charged` would draw a lightning bolt; `discharging` at 100 draws a plain full battery.
- **The override is cleared by every reboot.** The setup script and `capture-app.mjs` re-apply it when `status_bar list` does not show it.
- **24-hour clock.** A simulator inherits the host region (here `en_US@rg=dezzzz`), and "9:41" then renders as "09:41". The setup script writes `AppleLocale en_US`, `AppleLanguages (en)` and `AppleICUForce12HourTime` into the simulator's global defaults and reboots once.
- `--time` accepts `9:41` or an ISO date with milliseconds (`2026-09-27T09:41:00.000Z`); "9:41 AM" and ISO dates without milliseconds are rejected.
- The accessibility tree still reports the real clock, and the status bar is masked in every comparison anyway: the override keeps the sheets clean and the screenshots stable.
- `xcrun simctl ui <udid> appearance light|dark` sets the theme (no value prints it); `content_size large` is the default text size that matches the design's 17 pt body; `increase_contrast disabled`.

## Launching straight into a frame

```
xcrun simctl launch --terminate-running-process <udid> <bundle-id> \
  -AppleLanguages "(fa)" -AppleLocale fa_IR \
  -parity "frame=s4-home&theme=dark&lang=fa&game=lineSiege&date=2026-09-27&animations=off"
```

- Launch arguments of the form `-key value` land in NSUserDefaults; React Native's `Settings.get('parity')` reads them in a Release build. The app's test-only parity harness turns the query into the frame's state (see [parity-harness.md](parity-harness.md)).
- `-AppleLanguages "(fa)" -AppleLocale fa_IR` makes the app start in Persian with right-to-left layout (`(ckb)` also gives RTL, `(de)` LTR), provided the app declares those languages (expo-localization `supportedLocales`).
- `capture-app.mjs` passes each argument as its own word. In zsh an unquoted variable holding `-AppleLanguages (fa)` arrives as one word and is ignored.
- **Never use deep links for parity.** `simctl openurl` for a custom scheme shows a SpringBoard alert "Open in ...?" (cold and warm); pending alerts queue up, dim the app and hide every testID, which fails the capture as `screen-not-reached`.
- **Nothing else in front.** Another app in front adds a "back to" breadcrumb to the status bar; `capture-app.mjs` terminates other apps first (except Maestro's driver, whose restart would cost 20 s).
- **The reference follows the app's facts.** For `s11-settings`, `s6-pause` and `s7-result-win`, `capture-app.mjs` reads `parity/game-facts.json` (in the working directory, the app repo root; `--facts <file>` otherwise) and records the reference variant it picked in `run.json` (`variant`), printing `reference s11-settings--no-music (hasMusic false; L1)`. A missing or mismatched facts file stops the capture with exit 2.
- **Release test build, not Debug**: no LogBox or dev overlays, and the test variant so `TEST_ONLY` (and with it the harness) exists. Build it with `APP_VARIANT=test EXPO_PUBLIC_APP_VARIANT=test ADS_MODE=off` exported for the whole run (screenshots never load ads; the harness draws the stand-in banner). The build itself is the `ios-simulator-build` skill's job; install it on the parity simulator with `xcrun simctl install <udid> <App>.app` (`setup-parity-sim.mjs` prints the udid). The bundle id for `--bundle-id` is `plutil -extract CFBundleIdentifier raw -o - <App>.app/Info.plist`.

## The board probe launch (S5, S6, S7)

A Game-route frame (`s6-pause`, `s7-result-win`, `s7-result-lose`) masks the board the game draws, and the board is where the game says it is. Before the real capture, `capture-app.mjs` launches the frame once more with `probe=board` added to the `-parity` query:

```
-parity "frame=s6-pause&theme=light&lang=en&game=lineSiege&date=2026-09-27&animations=off&probe=board"
```

That launch opens no frame state (no Pause, no Result) and turns the board-layout probe on, so the board host renders `game.board-layout`: a small text inside the board frame holding `{ "x", "y", "layout": { "width", "height", "isMirrored", "regions" } }`, the canvas origin and `BoardLayout` in window points. The script waits for a still screen, reads that text from `maestro hierarchy`, and records the rectangle `{ x, y, w: layout.width, h: layout.height }` in `run.json` as `board` (with `source: "probe=board"`). `run-parity.mjs` passes each capture a cache file, so the probe runs once per device, theme and language in a run (the board does not move between S6 and S7). A probe without a usable `game.board-layout` fails `board-probe`; a Game-route run without `board` makes `check-parity.mjs` stop with exit 2.

## Taking the screenshot

- `xcrun simctl io <udid> screenshot --type=png app.png` returns a 1206 x 2622 RGBA sRGB PNG in about 0.16 s. Corners are not masked, the Dynamic Island is drawn, the home indicator is not in the image.
- Captures are deterministic: two screenshots of the same screen had 0 differing pixels, 1 s apart and across a reboot. Flat React Native fills come out as the exact token hex values, the same as Chrome's.
- **Stable screen.** `capture-app.mjs` waits 1 s, then takes screenshots 300 ms apart until two in a row match outside the masks (within 3/255: iOS re-dithers hard shadows on a redraw), up to the frame's `settleMs` (8 s by default, 10 s for tall frames).
- **Late loads.** A launch screen or a loading state can hold still for 300 ms. After the hierarchy dump the script takes one more screenshot; if the screen changed, it settles again and dumps again, three attempts in all, then fails with `changed-during-capture`. Seen live: the first still screen of a cold start was the white launch screen.

## Element bounds with maestro hierarchy

`maestro --device <udid> hierarchy --no-reinstall-driver` prints a JSON tree. Each node's `attributes` has `resource-id` (the React Native `testID`), `accessibilityText` (the accessibility label; for a Text it is the text), `bounds` as `[x0,y0][x1,y1]`, and more.

- **Units are points** (screen 402 x 874), rounded to whole points: an edge at 140.67 pt was reported as 140. Treat bounds as 1 pt accurate; the 2 pt tolerance includes this.
- **Only on-screen elements are listed.** In a 90-tile ScrollView only the visible tiles appeared; a partly visible tile was listed with its full, unclipped bounds. Tall frames are therefore captured at several scroll offsets (`--scroll`, whole points; `run-parity.mjs` plans them), and coverage is the union of the elements each capture shows whole.
- **Accessible elements hide their children, and hidden parts are not listed.** An accessible Pressable is reported with its label; its inner Text does not appear at all. A view with `accessibilityElementsHidden` (the components' decorative logo, icon and art tiles, pager dots ...) is missing from the dump with everything inside it. So a testID belongs on the accessible element itself, and the map's crop-only parts (`parent` or `a11yHidden`) are checked through the crop of their `coveredBy` element.
- **System elements** (status bar clock, Wi-Fi bars, breadcrumb) appear too; the scripts ignore nodes whose `resource-id` is not a testID.
- **Driver port**: Maestro's XCUITest driver listens on 22087 unless `--driver-host-port` says otherwise; `capture-app.mjs --driver-port` (or `PARITY_MAESTRO_PORT`) passes it (see The dedicated simulator).
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

## Human steps

- Installing Xcode 26.6 and the iOS 26.5 simulator runtime (Xcode > Settings > Components, or `xcodebuild -downloadPlatform iOS -buildVersion 26.5`) is the owner's step if they are missing; the setup script says so and stops.
- Installing Maestro and Java 17 follows the `e2e-maestro` skill.
