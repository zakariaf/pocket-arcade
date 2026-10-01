# Simulator build commands, step by step

The exact commands `npm run build:ios:sim` runs, why each flag is there, the simulator models, how the run knows the app is ready, and the simulator behaviours that were verified on this Mac. Read it before writing or changing the build script, or when a step fails and you need to run it by hand.

## Contents

- The run in one picture
- 1. Environment
- 2. Prebuild and the workspace name
- 3. The dedicated simulator
- 4. The Release simulator build
- 5. Boot, status bar, install, launch
- 6. Waiting until the app is ready
- 7. Screenshot and looking at it
- Simulator models and sizes
- Verified simulator behaviours (pitfalls)
- Other simulator commands you will need
- Speed

## The run in one picture

```text
selectXcode + variantEnv  ->  ensure e07-<purpose> simulator
  -> npx expo prebuild --platform ios --clean  (apps/<game>/ios/, pod install)
  -> npm run audit:privacy -- --app <game>  (reads ios/Pods; skipped with a note until the script exists)
  -> xcodebuild Release iphonesimulator arm64, no signing
  -> bootstatus -b, status_bar override  ->  simctl install, simctl launch --terminate-running-process
  -> poll every 500 ms until ready (perf log or stable screen)  ->  simctl io screenshot
  -> reports/ios/<game>/smoke-<variant>-<ads>.png  (then: check-sim-app, check-screenshot, look at it)
```

Every step writes `apps/<game>/build/logs/<step>.log`; the first failing step stops the run and prints the last 30 lines of its log.

## 1. Environment

```sh
export DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer EXPO_NO_TELEMETRY=1 CI=1
export APP_VARIANT=test EXPO_PUBLIC_APP_VARIANT=test ADS_MODE=test     # store: store/store/live
```

The script derives `DEVELOPER_DIR` from `XCODE_VERSION` (see the environment reference) and keeps all six variables for every step.

## 2. Prebuild and the workspace name

```sh
cd apps/line-siege
npx expo prebuild --platform ios --clean          # regenerates ios/ and runs pod install
WS=$(ls -d ios/*.xcworkspace | head -1)           # "Line Siege" -> ios/LineSiege.xcworkspace
SCHEME=$(basename "$WS" .xcworkspace)             # LineSiege
```

- Every build starts with a clean prebuild: `ios/` is generated and gitignored, and any hand edit there is lost. Never edit `ios/` and never open it in Xcode to "fix" something; change `app.config.ts`, `withShell` or a config plugin instead.
- The workspace and scheme names come from `expo.name` with spaces removed, not from `package.json`. Always discover them (`schemeOf()`).
- `pod install` downloads three pods from the CocoaPods trunk (Google-Mobile-Ads-SDK, GoogleUserMessagingPlatform, openiap), so prebuild needs the network. The app does not.
- Right after the prebuild the script runs `npm run -s audit:privacy -- --app <game>` from the repo root, because the privacy audit reads `ios/Pods` and `ios/Podfile.lock` and so can only run after a prebuild (the release pipeline does the same). Until the repo has an `audit:privacy` script the run prints that it skipped the audit.
- Prebuild writes from the config: `ios.buildNumber` to `CFBundleVersion`, `version` to `CFBundleShortVersionString`, `ITSAppUsesNonExemptEncryption = false`, `DEVELOPMENT_TEAM` from `ios.appleTeamId`, `IPHONEOS_DEPLOYMENT_TARGET = 16.4`, the `ios.infoPlist` keys verbatim, and `ios/<App>/PrivacyInfo.xcprivacy`.

## 3. The dedicated simulator

```sh
xcrun simctl list devices --json                  # look for "e07-smoke" on the iOS 26.5 runtime
xcrun simctl create e07-smoke "iPhone 17 Pro Max" com.apple.CoreSimulator.SimRuntime.iOS-26-5
```

- One simulator per purpose, named `e07-<purpose>` (`e07-smoke` for this skill), created once and reused, always targeted by UDID. `ensureSimulator()` looks the name up first.
- Only `e07-*` simulators are ever shut down or deleted, and never with `all`: other agents share this Mac (a booted `e07-parity` belonging to another task was present on 2026-09-28).
- On creation `ensureSimulator()` warms the device up once: boot, `defaults write -g AppleLocale -string en_US` (so the status bar shows 9:41, not 09:41, on a Mac with a 24-hour region), one throwaway screenshot (the first launch can show a one-time "Ready for Apple Intelligence" banner), then shutdown. Verified: about 29 s for create plus warm-up.

## 4. The Release simulator build

```sh
xcodebuild -workspace "$WS" -scheme "$SCHEME" -configuration Release -sdk iphonesimulator \
  -destination "id=$UDID" -derivedDataPath build/dd \
  ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO build
```

| Flag | Why |
|---|---|
| `-configuration Release` | embeds the Hermes bytecode bundle (`main.jsbundle`), no Metro, no dev menu, no LogBox |
| `-sdk iphonesimulator`, `-destination id=<udid>` | builds for the simulator the run will use |
| `-derivedDataPath build/dd` | keeps DerivedData inside `apps/<game>/build/` (gitignored, easy to delete) |
| `ONLY_ACTIVE_ARCH=YES ARCHS=arm64` | skips x86_64 on Apple silicon |
| `CODE_SIGNING_ALLOWED=NO` | the simulator needs no signing; no key or certificate is touched |

The app lands in `apps/<game>/build/dd/Build/Products/Release-iphonesimulator/<Scheme>.app`. The log ends with `** BUILD SUCCEEDED **`.

## 5. Boot, status bar, install, launch

```sh
xcrun simctl bootstatus "$UDID" -b                   # boots if needed and waits
xcrun simctl status_bar "$UDID" override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 --operatorName '' --batteryState discharging --batteryLevel 100
xcrun simctl install "$UDID" "build/dd/Build/Products/Release-iphonesimulator/$SCHEME.app"
BUNDLE_ID=$(plutil -extract CFBundleIdentifier raw -o - "build/dd/Build/Products/Release-iphonesimulator/$SCHEME.app/Info.plist")
xcrun simctl launch --terminate-running-process "$UDID" "$BUNDLE_ID"   # prints "<bundle id>: <pid>"
```

- Status-bar overrides are cleared by every reboot; apply them after each boot.
- `--batteryState charged` draws a lightning bolt; `discharging` at 100 draws a plain full battery.
- `--terminate-running-process` guarantees a cold start of the freshly installed build.

## 6. Waiting until the app is ready

Never a fixed `sleep`: builds and Macs vary. The script polls every 500 ms for at most 30 s:

1. **Test builds with the perf log**: the Shell writes a `cold-start` entry to its perf log when Home is interactive. The script reads it without touching app code:

   ```sh
   DATA=$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)
   sqlite3 "$DATA/Documents/SQLite/save.db" "SELECT payload FROM perf_log WHERE id = 1"
   ```

   Ready when the payload contains `cold-start`.
2. **No perf log** (store builds never have one, and early Shells may not write it yet): ready when two screenshots in a row are byte-identical, and at least 3 s have passed since launch. Screenshots of the same screen are pixel-identical (verified, even across a reboot), so identical bytes mean the screen has settled.
3. **A perf log without the entry**: a test build makes its perf log at every launch (`createDebugParts`), but only Home marks the cold start, and a fresh install opens the first-run screens (seen 2026-09-30: the first build with the perf layer timed out on the language choice). Ready on the same still-screen rule after at least 8 s.

App code cannot log to the console (lint bans it outside tooling), which is why the ready signal is data, not a log line. If the app is not ready after 30 s, the run fails and names the last screenshot: look at it.

## 7. Screenshot and looking at it

```sh
xcrun simctl io "$UDID" screenshot reports/ios/line-siege/smoke-test-test.png
```

- `simctl io screenshot` writes a PNG of the full screen at device resolution (RGBA, sRGB) in about 0.2 s. It includes the Dynamic Island and the status bar, and never the home indicator.
- It cannot write to `/dev/null` ("Operation not permitted"); use a real file and delete it.
- Then run `check-screenshot.mjs` on the PNG (size, blank screen, a light system banner over the top), and open it with the Read tool and look. A white or black screen means the build or launch failed. Dismiss any notification before the screenshot counts: iOS draws it over the app.
- A given screen instead of the first route: `npm run build:ios:sim -- --app <game> --link 'firstRun=0&level=1&screen=game'` (test builds only; `--wait-for <testID>` when the query has no `screen=`). After the launch screenshot it runs `tools/maestro/bin/maestro --device <udid> --driver-host-port <port> test packages/shell/e2e/subflows/debug-setup.yaml` with `QUERY` and `WAIT_FOR` (the root of the link's screen; `linkSetupArgs` builds the line with `maestroGlobalArgs`, the port is a free one of this run or the session's `--driver-port <n>`): `xcrun simctl openurl` alone is not enough, because iOS answers a custom scheme opened from outside with an "Open in <app>?" prompt and the app never gets the link (seen on iOS 26.5, with the app running and when it is not), and the sub-flow taps Open. The app keeps running (the sub-flow does not launch it), so the tool then waits until the screen holds still and writes `reports/ios/<game>/smoke-<variant>-<ads>-link.png`; the Maestro log goes to `apps/<game>/build/logs/link.log`. Maestro and the sub-flow are e2e-maestro's tooling; without them `--link` stops in the preflight (exit 2) before anything is built.
- `npm run build:ios:sim -- --help` (or `-h`) prints the usage and builds nothing.

## Simulator models and sizes

Read from the simulator device-type profiles (`mainScreenWidth/Height/Scale`) and measured on iOS 26.5:

| Model (iOS 26.5 runtime) | Pixels | Scale | Points | Safe area top / bottom (measured) |
|---|---|---|---|---|
| iPhone 17 Pro Max (default here) | 1320 x 2868 | 3 | 440 x 956 | not measured |
| iPhone 17 Pro, iPhone 17 | 1206 x 2622 | 3 | 402 x 874 | 62 / 34 on the same-size iPhone 16 Pro |
| iPhone Air | 1260 x 2736 | 3 | 420 x 912 | not measured |
| iPhone 17e | 1170 x 2532 | 3 | 390 x 844 | 47 / 34 (notch) |

The iPhone 16 family exists only on the iOS 18.0 and 18.6 runtimes; `simctl create "iPhone 16 Pro" ... iOS-26-5` does work if a task needs that exact profile. Parity screenshots use their own device and simulator (another skill); the smoke build uses iPhone 17 Pro Max, which also suits 6.9-inch store screenshots.

## Verified simulator behaviours (pitfalls)

| What you see | Why | What to do |
|---|---|---|
| Screenshot right after `bootstatus -b` is black with a small spinner | SpringBoard is still starting although `bootstatus` returned | Wait for the ready signal; `check-screenshot.mjs` flags it as `blank-screen` |
| "Ready for Apple Intelligence" banner over the app | first launch after `simctl create` | the warm-up takes and discards that first capture |
| Status bar shows `09:41` | the simulator inherited the Mac's 24-hour region | `simctl spawn <udid> defaults write -g AppleLocale -string en_US`, reboot, re-apply the override (done at creation) |
| `--time "9:41 AM"` or `--time 2026-09-27T09:41:00Z` rejected | only `9:41` style or an ISO date with milliseconds (`...T09:41:00.000Z`) is accepted | use `9:41` |
| "◀ other-app" breadcrumb in the status bar | the app was launched while another app was in front | launch with `--terminate-running-process` from the home screen |
| `simctl openurl <udid> scheme://...` shows "Open in <App>?" | iOS asks before opening a custom scheme, whether the app runs or not; alerts queue and hide the app from accessibility queries (a leftover prompt makes the next flow's first wait fail) | open debug links through Maestro's `debug-setup.yaml` (it taps Open), as `--link` and `e2e:ios` do; after a stray `openurl`, restart your own simulator to clear the queued prompts |
| A launch argument in a zsh variable is ignored | zsh does not word-split `$ARGS`, so `-AppleLanguages (fa)` arrives as one argument | pass each word separately, or use a bash array |

## Other simulator commands you will need

```sh
xcrun simctl ui "$UDID" appearance dark                     # light | dark (no argument prints the current one)
xcrun simctl ui "$UDID" content_size large                  # default text size; accessibility-extra-extra-extra-large = 3.571x
xcrun simctl launch --terminate-running-process "$UDID" "$BUNDLE_ID" -AppleLanguages "(fa)" -AppleLocale fa_IR
xcrun simctl terminate "$UDID" "$BUNDLE_ID"                 # the kill part of a kill test
xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data    # the app's data folder (save.db lives in Documents/SQLite/)
xcrun simctl delete unavailable                             # monthly cleanup, safe for other agents
```

`-AppleLanguages "(fa)"` makes the app start in that language (and RTL for fa/ckb) when the app declares the language in `CFBundleLocalizations` (the expo-localization plugin's `supportedLocales` does). Launch arguments also reach React Native through `Settings.get('<name>')` (NSUserDefaults), which is how test builds receive state such as a fixed seed or date.

## Speed

Measured on 2026-09-26 on a small app: prebuild 17 s (with `pod install`), first Release simulator build 1 min 40 s, rebuild after a clean prebuild 1 min 6 s. An unsigned device archive of the same app took 66 s. Creating and warming up a new simulator takes about 30 s, once.

For a JS-only change on an unchanged native build, the bundle can be swapped instead of rebuilding (about 5 s): `npx expo export:embed --platform ios --dev false --entry-file index.ts --bundle-output out/main.jsbundle --assets-dest out/assets`, copy `main.jsbundle` into the `.app`, `codesign --force --sign - --deep <App>.app`, then install and launch. Use it only for quick iteration; the evidence build is always the full `npm run build:ios:sim`.
