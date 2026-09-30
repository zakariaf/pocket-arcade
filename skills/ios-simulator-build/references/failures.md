# Simulator build failures: symptom, cause, fix

Match the text you see (log line, checker rule or screenshot) in the first column. Each row was either seen on this Mac or is taken from a verified run. When the fix is an owner step, stop and ask; do not work around it.

## Contents

- Environment and Xcode
- Prebuild and pods
- xcodebuild
- Variants and test-only code
- Simulator, launch and screenshot
- Configuration and TypeScript

## Environment and Xcode

| Symptom | Cause | Fix |
|---|---|---|
| `Xcode 26.6 is not installed (found: ...)` from `selectXcode()` | the pinned Xcode is missing or renamed | Owner step O4: install it as `/Applications/Xcode-26.6.0.app` and accept the licence |
| `xcodebuild -version printed "Xcode 27.0"` | `DEVELOPER_DIR` not passed to the child process, or someone ran `xcode-select` | pass the env from `selectXcode()` to every step; never call `xcode-select` |
| `You have not agreed to the Xcode license agreements` | licence of the selected Xcode not accepted | Owner step O4 (`sudo .../xcodebuild -license accept`); the agent never runs sudo |
| `check-sim-app` rule `built-with-xcode`: `DTXcode is "2700"` | built with Xcode 27 (the file named `Xcode.app`) | rebuild through `npm run build:ios:sim`; if Xcode 27 is intended, follow the move-to-Xcode-27 steps first |
| Black screen at launch after building with Xcode 27 on SDK 57 | the iOS 27 SDK expects the UIScene life cycle | add `ios.enableSceneSupport: true` through `expo-build-properties` (needs expo 57.0.23+) or go back to Xcode 26.6 |
| `xcrun: error: unable to find utility "simctl"` | `DEVELOPER_DIR` points at Command Line Tools, not Xcode | use `selectXcode()`; the developer dir must end in `Xcode-26.6.0.app/Contents/Developer` |

## Prebuild and pods

| Symptom | Cause | Fix |
|---|---|---|
| `pod install` fails downloading `Google-Mobile-Ads-SDK`, `GoogleUserMessagingPlatform` or `openiap` | no network at build time, or a CDN problem | retry once after 5 minutes; pods are pinned exactly, never loosen versions |
| `Error reading Expo config ... Cannot find module ./game.config` | `app.config.ts` imports without the `.ts` extension | import `./game.config.ts` (Node type stripping needs explicit extensions; `allowImportingTsExtensions` in tsconfig) |
| `SyntaxError: Unexpected token {` while reading the config | Node runs without type stripping (`NODE_OPTIONS=--no-strip-types`, or Node older than 22.18) | use Node 26.4.0 from mise; never set `--no-strip-types` |
| `MODULE_TYPELESS_PACKAGE_JSON` warning | a package's `.ts` files load as ESM without `"type": "module"` | harmless for apps (their `metro.config.js` is CommonJS); the Shell, game-kit and tooling packages declare `"type": "module"` |
| `EXPO_PUBLIC_APP_VARIANT=test must equal APP_VARIANT=store` | only one of the two variant variables was exported | export both (and `ADS_MODE`) for the whole run; the build script does |
| `ADS_MODE=live is not allowed when APP_VARIANT=test` | a forbidden pair | use the matrix: test with off/test, store with off/live |
| `build:ios:sim: preflight failed, nothing was built: "audit:privacy" runs packages/tooling/src/audit/audit-privacy.ts, which does not exist` (exit 2), or `package.json has no "audit:privacy" script` | privacy-and-network-audit's tooling is not installed yet; the build runs `audit:privacy` after every prebuild and checks its target before it starts (older copies of the script failed only after the slow prebuild, with `step "audit-privacy" failed ... Cannot find module '.../packages/tooling/src/audit/audit-privacy.ts'`) | copy privacy-and-network-audit's `templates/packages/tooling/src/audit/` and `templates/packages/tooling/network-audit/` (+ tests) and add `"audit:privacy": "node packages/tooling/src/audit/audit-privacy.ts"`; `check-sim-setup.mjs .` rule `build-prereqs` shows the same before a build. Never delete the step or the script |
| step `audit-privacy` failed (`apps/<game>/build/logs/audit-privacy.log`) | a pod uses a required-reason API that `ios.privacyManifests` does not declare | add the category and reason in `withShell`'s `ios.privacyManifests` (the privacy-and-network-audit skill owns the list), clean prebuild, rebuild; never skip the audit |
| No `.xcworkspace` in `apps/<game>/ios` | prebuild stopped early | read `apps/<game>/build/logs/prebuild.log`, fix the config error, rerun |
| Prebuild warns `Install expo-system-ui in your project to enable this feature` | Android-only `userInterfaceStyle` support | ignore on iOS; needed only when Android starts |

## xcodebuild

| Symptom | Cause | Fix |
|---|---|---|
| `** BUILD FAILED **` with a Swift or C++ error in a pod | a native module and the SDK disagree (usually after a manual version change) | `npx expo install --check` in the app, restore Expo's pinned versions, clean prebuild |
| `Signing for "<App>" requires a development team` on a simulator build | `CODE_SIGNING_ALLOWED=NO` missing | use `xcodebuildSimArgs()`; simulator builds never sign |
| Build takes minutes although only JS changed | clean prebuild plus full build is the default | for quick iteration only, swap the JS bundle (simulator-commands reference, Speed); the evidence build is always the full run |
| `** BUILD FAILED **` in Google-Mobile-Ads-SDK or openiap with `precompiled file .../build/dd/ModuleCache.noindex/.../SwiftShims-*.pcm was compiled with module cache path '<another folder>/apps/<game>/build/dd/...'` and `missing required module 'SwiftShims'` | the repo was copied or moved: `apps/<game>/build/dd` (DerivedData, kept across builds) still names the old folder | `build-ios-sim.ts` deletes `build/dd` itself when its `info.plist` WorkspacePath or a `.pcm`'s module cache path names another repo root (it prints `removed apps/<game>/build/dd: it was built in another folder`); by hand: `rm -rf apps/<game>/build/dd`, then build again (seen 2026-09-30) |
| Disk full, or the simulator will not boot | old DerivedData, runtimes, simulators | `rm -rf apps/*/build`, `xcrun simctl delete unavailable`; never erase simulators the tooling did not create |

## Variants and test-only code

| Symptom | Cause | Fix |
|---|---|---|
| `check-sim-app` rule `test-code`: store build contains `SHELL_TEST_BUILD_ONLY` | Metro reused test-build transforms (no `cacheVersion`), test code gated by an imported constant, or a file imports `test-only-entry` directly | `check-sim-setup.mjs` names which; fix it and rebuild the store variant |
| `check-sim-app` rule `test-code`: test build lacks the sentinel | the build ran as store (variables not exported) or the entry no longer exports the sentinel | export the three variables for the whole run; keep `TEST_BUILD_SENTINEL` |
| `check-sim-app` rule `constants-variant` (`extra.adsMode` differs) | the variables changed between prebuild and xcodebuild (two shells, or an `export` inside one step) | build one env object and pass it to every step |
| The store screenshot shows the debug menu | same as the first row | same fix; then prove it with a back-to-back test and store build |
| `ad-app-id`: `GADApplicationIdentifier is "missing"` | GMA plugin missing or no `iosAppId` | `withShell` always passes an app ID; clean prebuild. A missing ID crashes the app at launch |

## Simulator, launch and screenshot

| Symptom | Cause | Fix |
|---|---|---|
| `check-screenshot` rule `blank-screen`, black with a small spinner | the screenshot was taken while SpringBoard was still starting | wait for the ready signal; rerun the launch and screenshot |
| `blank-screen`, `#F2F2F2 (React Navigation's default background...)` | the navigator rendered a screen whose component draws nothing (a stub, `null`, or content outside the safe area) | seen on 2026-09-28 with stub screens: the save was written, no JS error; build the screen, rebuild, screenshot again |
| `blank-screen`, white or one colour | the app crashed at launch or drew nothing | read `xcrun simctl spawn <udid> log show --last 2m --predicate 'process == "<Executable>"'`; check `GADApplicationIdentifier`, the Metro bundle and JS errors |
| `check-screenshot` rule `system-banner`, or a light card with an app icon over the top of the screenshot ("Ready for Apple Intelligence") | an iOS notification slid over the app while it was captured (seen 2026-09-30 on a smoke screenshot that still passed the older checks) | dismiss it (wait until it slides away, or swipe it up), screenshot again and look; `--no-banner-check` only when the light band is really the app's own |
| `simctl boot` fails: `Unable to boot device due to insufficient system resources ... maxUserProcs` | other sessions' simulators fill the Mac's process budget | shut down this session's own `e07-*` simulators (`xcrun simctl list devices booted`, then `xcrun simctl shutdown <udid>` for yours), never another session's; or reuse one of yours with `--sim <purpose>` |
| `unexpected argument "--help"` | an older `build-ios-sim.ts` | copy the template again: `--help` and `-h` print the usage and exit 0 |
| `the app was not ready after 30 s` | JS error before Home, or the perf log exists but never gets `cold-start` | open the last screenshot; relaunch; in a test build check the debug menu's error log |
| `Operation not permitted` from `simctl io ... screenshot /dev/null` | simctl cannot write there | write to a temporary file and delete it |
| `check-screenshot` rule `png-size` | the screenshot came from another simulator model | use the `e07-<purpose>` simulator of the expected model, or pass `--device` |
| "Open in <App>?" alert over the app | `simctl openurl` with a custom scheme | use launch arguments (`-key value`, read with `Settings.get`) instead of deep links |
| Status bar shows `09:41` or a charging bolt | host 24-hour region; `--batteryState charged` | the warm-up sets `AppleLocale en_US`; use `--batteryState discharging --batteryLevel 100` |
| `Unable to boot device in current state: Booted` | harmless when booting twice | use `simctl bootstatus <udid> -b`, which boots only if needed |
| Unhandled JS exception `AppRegistryBinding::startSurface failed. Global was not installed` in a Release build | `reloadAppAsync()` was called during bundle evaluation | call it from the mounted splash screen's effect (the direction switch does) |

## Configuration and TypeScript

| Symptom | Cause | Fix |
|---|---|---|
| TS4111 on `process.env.EXPO_PUBLIC_APP_VARIANT` | `noPropertyAccessFromIndexSignature` and no declaration | declare it in `packages/shell/src/app-env.d.ts` |
| TS2591 `Cannot find name 'process'` in the Shell program | the Shell program has no Node types | `declare const process: { readonly env: NodeJS.ProcessEnv };` in `app-env.d.ts` |
| `expo/no-dynamic-env-var` lint error | `process.env['X']` inside `packages/shell/src` | pass `process.env` into `withShell` from `app.config.ts` and read the variable there |
| `@typescript-eslint/no-require-imports` in `test-only.ts` | the lint exemption is missing | the ESLint config exempts exactly `packages/shell/src/app/test-only.ts`; nothing else may `require()` |
