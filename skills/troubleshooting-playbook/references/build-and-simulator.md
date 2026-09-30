# Build, Xcode, Expo config and the simulator

Failures while selecting Xcode, loading app.config.ts, prebuilding, building for the simulator, and running or screenshotting the app there. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Xcode
- Expo config
- Variants
- Prebuild
- xcodebuild
- Simulator
- Repo setup
- Build prerequisites
- Dependencies

## Xcode

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `build-xcode-27-picked` | xcodebuild -version prints Xcode 27.0, or a built app has DTXcode 2700 | /Applications/Xcode.app is Xcode 27.0 on this Mac; a tool used it because DEVELOPER_DIR was not set, or someone ran xcode-select | Select Xcode 26.6 per process with DEVELOPER_DIR from selectXcode(); never run xcode-select | verified | `ios-simulator-build` |
| `build-xcode27-black-screen` | Black screen at launch after building with Xcode 27 on Expo SDK 57 | The iOS 27 SDK expects the UIScene life cycle; SDK 57 still uses the application life cycle | Add ['expo-build-properties', { ios: { enableSceneSupport: true } }] (expo 57.0.23+) before switching Xcode, or stay on Xcode 26.6 | documented | `ios-simulator-build` |
| `build-xcode-licence` | You have not agreed to the Xcode license agreements | The selected Xcode was installed but its licence was never accepted | Owner step O4: sudo <Xcode>/Contents/Developer/usr/bin/xcodebuild -license accept (the agent never runs sudo) | verified, owner | `ios-simulator-build` |
| `build-simctl-clt` | xcrun: error: unable to find utility "simctl" | DEVELOPER_DIR points at the Command Line Tools, not at an Xcode app | Use selectXcode(); the developer dir must end in Xcode-26.6.0.app/Contents/Developer | verified | `ios-simulator-build` |
| `build-scene-support-not-called` | The Xcode 27 readiness scan passes but the app still opens to a black screen | scene-support.ts was copied into the repo but withShell never calls it | Call the scene-support helper from withShell; the readiness scan no longer counts the helper or its test on their own | verified | `expo-sdk-upgrade` |
| `build-derived-data-module-cache` | npm run build:ios:sim fails with ** BUILD FAILED ** in a pod (Google-Mobile-Ads-SDK, openiap): a precompiled .pcm under apps/<game>/build/dd/ModuleCache.noindex "was compiled with module cache path" of another folder, then "missing required module 'SwiftShims'" | The repo was copied or moved: the build script cleans ios/ but keeps apps/<game>/build/dd, and that DerivedData module cache still names the old repo path | Delete apps/<game>/build/dd (rm -rf apps/<game>/build/dd), then rerun the same build; after copying or moving a repo, delete build/dd and ios/ of each app before its first simulator build | verified | `ios-simulator-build` |

## Expo config

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `build-config-missing-ts-extension` | Error reading Expo config ... Cannot find module './game.config' | app.config.ts is loaded by Node type stripping, which needs explicit .ts extensions | Import './game.config.ts' and '@e07/shell/config/with-shell.ts'; tsconfig needs allowImportingTsExtensions and erasableSyntaxOnly | verified | `architecture-and-boundaries` |
| `build-config-no-type-stripping` | SyntaxError: Unexpected token { while reading app.config.ts | Node runs without type stripping (NODE_OPTIONS=--no-strip-types, or Node older than 22.18) | Use Node 26.4.0 from mise (engines >=22.18); never set --no-strip-types | verified | `monorepo-bootstrap` |
| `build-module-typeless-warning` | Warning MODULE_TYPELESS_PACKAGE_JSON when Node loads .ts files | A package's ESM .ts files load without "type": "module" in its package.json | Shell, game-kit and tooling declare "type": "module"; apps cannot while metro.config.js is CommonJS, so scripts importing app files pass --disable-warning=MODULE_TYPELESS_PACKAGE_JSON (harmless; verified alternative: "type": "module" in the app plus metro.config.cjs) | verified | `monorepo-bootstrap` |
| `build-splash-plugin-missing` | npx expo config or prebuild fails to resolve the expo-splash-screen plugin | withGameArt adds the expo-splash-screen plugin and points the icon and splash at PNGs that exist only after the art render, but the app does not depend on the package yet (seen on the first Shell build, when withGameArt landed before the art step) | Before the first expo config or prebuild that includes withGameArt: node packages/tooling/src/art/render-art.ts --app <id>, then npx expo install expo-splash-screen in every apps/<game> (lockstep) and add "expo-splash-screen": "*" to the Shell peerDependencies (Shell build step 8 in pocket-arcade-index) | verified | `code-drawn-art-and-icons` |

## Variants

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `build-variant-mismatch` | EXPO_PUBLIC_APP_VARIANT=test must equal APP_VARIANT=store | Only one of the two variant variables was exported | Export APP_VARIANT, EXPO_PUBLIC_APP_VARIANT (same value) and ADS_MODE once for the whole run | verified | `ios-simulator-build` |
| `build-forbidden-ads-pair` | ADS_MODE=live is not allowed when APP_VARIANT=test (or store with test ads) | Real ads in a test build and test ads in a store build are forbidden pairs | Test builds use ADS_MODE off\|test, store builds off\|live | verified | `ios-simulator-build` |
| `build-metro-cache-variant` | A store build still contains the debug module or shows variant=test (sentinel SHELL_TEST_BUILD_ONLY in main.jsbundle) | Metro inlines EXPO_PUBLIC_* at transform time but does not key its cache on them; the cache in $TMPDIR/metro-cache is shared by every project | config.cacheVersion = `app-variant-${process.env.EXPO_PUBLIC_APP_VARIANT ?? 'test'}` in every app's metro.config.js; prove with a back-to-back test and store build | verified | `ios-simulator-build` |
| `build-imported-constant-gate` | Test-only module still in the store bundle although gated by IS_TEST_BUILD | Metro strips a require only when the literal EXPO_PUBLIC_APP_VARIANT comparison is in the same expression; an imported constant does not fold | Reach test-only code only through packages/shell/src/app/test-only.ts with process.env.EXPO_PUBLIC_APP_VARIANT === 'store' ? null : require(...) | verified | `ios-simulator-build` |
| `build-variables-lost-mid-build` | EXConstants.bundle/app.config extra.adsMode or extra.appVariant differs from the requested variant | The variables were set for prebuild but not for xcodebuild, whose Constants and Metro phases evaluate the config again | Build one environment and pass it to every step (build-ios-sim.ts does) | verified | `ios-simulator-build` |
| `build-variant-from-app-config` | Setting EXPO_PUBLIC_APP_VARIANT inside app.config.ts has no effect on the bundle | Metro runs later, in the Xcode build phase, with its own environment | Export the variable in the build script for the whole run; resolveBuildVariant only checks it | documented | `ios-simulator-build` |
| `build-gad-app-id-missing` | Crash at launch mentioning GADApplicationIdentifier | The AdMob plugin is missing or got no iosAppId, so Info.plist lacks the app ID the linked SDK requires | withShell always passes an app ID (the Google sample ID unless ADS_MODE=live); clean prebuild | verified | `admob-ads` |

## Prebuild

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `build-pod-download` | pod install fails downloading Google-Mobile-Ads-SDK, GoogleUserMessagingPlatform or openiap | The three trunk pods are downloaded at prebuild time; no network or a CDN problem | Retry once after 5 minutes; never loosen pod versions | verified | `ios-simulator-build` |
| `build-no-privacy-manifest` | The prebuilt app has no PrivacyInfo.xcprivacy | Expo prebuild generates none unless the config declares ios.privacyManifests | withShell declares ios.privacyManifests (NSPrivacyTracking false plus the aggregated required-reason APIs) | verified | `privacy-and-network-audit` |
| `build-ipad-rotates` | The app rotates to landscape on iPad although orientation is portrait | With supportsTablet, prebuild writes all four iPad orientations; iOS 27-SDK builds also make iPhone apps resizable | Never assume the screen size: lay out from useWindowDimensions and safe-area insets; screenshot iPad landscape | documented | `react-components-and-hooks` |
| `build-expo-system-ui-warning` | Prebuild warns: Install expo-system-ui in your project to enable this feature | Android-only: userInterfaceStyle 'automatic' needs expo-system-ui | Ignore on iOS; add expo-system-ui when Android starts (knip then needs it listed) | verified | `dependency-management` |
| `build-no-workspace` | No .xcworkspace in apps/<game>/ios after prebuild | Prebuild stopped early on a config error | Read apps/<game>/build/logs/prebuild.log, fix the config error, rerun the clean prebuild | verified | `ios-simulator-build` |

## xcodebuild

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `build-workspace-name` | xcodebuild cannot find the workspace or scheme named after package.json | The workspace and scheme come from expo.name with spaces removed (Line Siege -> LineSiege) | Discover ios/*.xcworkspace after prebuild and derive the scheme from it | verified | `ios-simulator-build` |
| `build-sim-signing` | Signing for "<App>" requires a development team on a simulator build | CODE_SIGNING_ALLOWED=NO is missing from the simulator build | Simulator builds never sign: Release, -sdk iphonesimulator, ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO | verified | `ios-simulator-build` |
| `build-pod-native-error` | ** BUILD FAILED ** with a Swift or C++ error inside a pod | A native module and the SDK disagree, usually after a hand-made version change | npx expo install --check in the app, restore the pinned versions, clean prebuild | verified | `ios-simulator-build` |
| `build-expo-run-ios` | npx expo run:ios made a Debug build with the wrong Xcode | expo run:ios builds Debug with whatever xcode-select points at (Xcode 27 on this Mac) | Build with npm run build:ios:sim (Release, iphonesimulator, CODE_SIGNING_ALLOWED=NO, DEVELOPER_DIR for Xcode 26.6) | documented | `ios-simulator-build` |

## Simulator

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `build-screenshot-dev-null` | simctl io <udid> screenshot /dev/null fails: Operation not permitted | simctl cannot write its PNG to /dev/null | Write to a temporary file and delete it | verified | `ios-simulator-build` |
| `build-black-spinner-after-boot` | A screenshot right after simctl bootstatus -b is black with a small spinner | bootstatus returns while SpringBoard is still starting | Wait for the app ready signal (perf log or two identical screenshots after 3 s) before the screenshot that counts | verified | `ios-simulator-build` |
| `build-first-boot-banner` | A "Ready for Apple Intelligence" banner covers the app on a new simulator | One-time system banner on the first launch after simctl create | Warm a new simulator up once and discard its first capture | verified | `ios-simulator-build` |
| `build-status-bar-0941` | Status bar shows 09:41 (or a charging bolt) after simctl status_bar override --time 9:41 | The simulator inherited the Mac's 24-hour region; --batteryState charged draws a bolt | simctl spawn <udid> defaults write -g AppleLocale -string en_US, reboot, re-apply; use --batteryState discharging --batteryLevel 100; overrides reset on every reboot | verified | `ios-simulator-build` |
| `build-status-bar-time-format` | simctl status_bar rejects --time "9:41 AM" or 2026-09-27T09:41:00Z (Invalid, non-ISO date/time string) | Only 9:41 style or an ISO date with milliseconds is accepted | Use --time 9:41 (or ...T09:41:00.000Z) | verified | `ios-simulator-build` |
| `build-openurl-alert` | "Open in <App>?" alert after simctl openurl; testIDs vanish from maestro hierarchy | iOS asks before opening a custom scheme (iOS 26.5 always asks after simctl openurl and nothing accepts the prompt); pending alerts queue and dim the app | Never send a debug link with simctl openurl: open it through Maestro's debug-setup.yaml sub-flow (run-e2e-ios's cold-start setup does this through debugSetupArgs, and build-ios-sim's --link uses the same sub-flow); check-e2e-setup's openurl-prompt rule catches a runner that still calls simctl openurl; on a fresh simulator iOS asks once per app, and a tap while the alert is still sliding in is lost, so the sub-flow waits for the animation to end before it taps Open and taps once more if the alert is still there | verified | `e2e-maestro` |
| `build-zsh-word-splitting` | A launch argument such as -AppleLanguages "(fa)" stored in a variable is ignored | zsh does not word-split $ARGS, so the words arrive as one argument | Pass each word separately or use a bash array | verified | `ios-simulator-build` |
| `build-iphone16-runtime` | simctl create "iPhone 16 Pro" on iOS 26.5 is not in the default device list | The iOS 26.5 runtime ships the iPhone 17 family and iPad (M5) models; iPhone 16 exists on iOS 18 runtimes | Use iPhone 17 Pro Max / iPhone 17 Pro on iOS 26.5 (create by name; creating an iPhone 16 Pro on 26.5 also works when a profile needs it) | verified | `ios-simulator-build` |
| `build-other-agents-simulators` | Another task's simulator was shut down or erased | simctl shutdown all / erase all touch every simulator on the Mac | Name simulators e07-<purpose>, target them by UDID, delete only your own | verified | `ios-simulator-build` |
| `build-blank-nav-background` | Screenshot is one flat light grey (#F2F2F2) | React Navigation's default screen background with no content: the screen component rendered nothing (a stub or null) | Build the screen; check-screenshot.mjs flags it as blank-screen | verified | `ios-simulator-build` |
| `build-reload-during-bundle-eval` | Release app terminates: Unhandled JS Exception ... AppRegistryBinding::startSurface failed. Global was not installed | reloadAppAsync() was called during bundle evaluation, before the runtime was ready | Run the direction check and reload from the mounted splash screen's effect | verified | `rtl-and-direction` |
| `build-disk-full` | The disk is full, or a simulator will not boot | Old DerivedData, build folders, runtimes and unavailable simulators | rm -rf apps/*/build and xcrun simctl delete unavailable; never erase simulators the tooling did not create | verified | `ios-simulator-build` |
| `build-already-booted` | Unable to boot device in current state: Booted | The simulator was booted twice | Harmless; use simctl bootstatus <udid> -b, which boots only when needed | verified | `ios-simulator-build` |
| `build-app-not-ready` | the app was not ready after 30 s | A JS error before Home, or a test build whose perf log never got cold-start (a first-run install never reaches Home, so its launch has a perf log but no cold-start entry) | Copy ios-simulator-build's current packages/tooling/src/build/build-ios-sim.ts (after 8 s without a cold-start entry it falls back to a still screen, which a first-run install needs); otherwise open the last screenshot, relaunch, and read the debug menu error log (test builds) or simctl spawn <udid> log show --last 2m --predicate 'process == "<Executable>"' | verified | `ios-simulator-build` |
| `build-white-screen` | The screenshot is white or one flat colour (not the React Navigation grey) | The app crashed at launch or drew nothing | Read the process log with simctl spawn ... log show; check GADApplicationIdentifier, the embedded main.jsbundle and JS errors | verified | `ios-simulator-build` |
| `build-apple-languages-ignored` | simctl launch ... -AppleLanguages "(fa)" still shows the app in English or LTR | The app does not declare the language in CFBundleLocalizations, or the argument arrived as one word | Configure expo-localization supportedLocales (en, de, fa, ckb) so prebuild writes CFBundleLocalizations; pass each launch argument as its own word | verified | `rtl-and-direction` |
| `build-js-bundle-swap` | An app whose main.jsbundle was swapped for fast iteration fails to install or launch | The bundle changed after the app was signed | After copying the new bundle run codesign --force --sign - --deep <App>.app, then simctl install and launch; the evidence build is always the full Release run | documented | `toybox-visual-parity` |
| `build-simulator-insufficient-resources` | simctl boot (npm run e2e:ios, build:ios:sim or setup-parity-sim) exits with "Unable to boot device due to insufficient system resources" and maxUserProcs / runningUserProcs numbers | Too many simulators are booted on this Mac, other sessions' included, so the per-user process limit is reached | Shut down only this session's own e07-* simulators that are not needed now (xcrun simctl shutdown <its name or udid>), then rerun the command; never shutdown all, never touch another session's simulator, never erase | verified | `ios-simulator-build` |

## Repo setup

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `build-expo-claude-plugin` | The Expo SDK 57 template ships .claude/settings.json enabling expo@claude-plugins-official, and AGENTS.md says npx expo lint | Template defaults: the plugin adds a remote MCP server and EAS skills that pull toward cloud services the spec forbids | Merge the project settings into that file (never overwrite it); rewrite AGENTS.md to name the npm scripts; the owner decides whether the plugin stays (if kept, forbid EAS Update, Observe and Hosting) | documented | `monorepo-bootstrap` |
| `build-expo-router-template` | The create-expo-app template brings Expo Router and src/app routes | The project uses React Navigation 7 static API; in SDK 56+ Expo Router no longer supports importing @react-navigation/* in app code | Remove Expo Router from the template; one native stack in the Shell | documented | `navigation-and-routing` |
| `build-test-only-entry-debug-screen` | tsc fails in a fresh repo: test-only-entry.ts (or test-only-api.ts) cannot find './debug-screen.tsx', a debug-kit file or an app/parity/ harness file | The shared test-only entry re-exports the S15 debug screen (toybox-screens), e2e-maestro's debug kit and the parity harness (toybox-visual-parity), which later build steps ship | Until a file exists, drop its export from test-only-entry.ts and its member from test-only-api.ts; never drop the SHELL_TEST_BUILD_ONLY sentinel. Copy the shared pair again once the files exist | verified | `ios-simulator-build` |

## Build prerequisites

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `build-sim-preflight-audit-missing` | npm run build:ios:sim stops with 'preflight failed, nothing was built: "audit:privacy" runs packages/tooling/src/audit/audit-privacy.ts, which does not exist' (older copies failed after the prebuild with Cannot find module ... audit-privacy.ts) | The simulator build runs audit:privacy right after every prebuild, and the privacy and network audit tooling is not in the repo yet | Copy privacy-and-network-audit's tooling (packages/tooling/src/audit/, packages/tooling/network-audit/) and its npm scripts before the first simulator build, then build again | verified | `ios-simulator-build` |

## Dependencies

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `build-fast-check-missing` | tsc and eslint fail with TS2307 "Cannot find module 'fast-check'" on the game-kit tests right after copying the kit (or check-rules-engine fails [kit-test-dependency]) | The kit's property tests import fast-check, which the bootstrap leaves out | Run npm install -D -E fast-check@4.10.2 at the repo root, then npm approve-scripts --allow-scripts-pending and approve fsevents if it is listed (Shell step 2 of game-rules-engine and level-generation-and-solvers) | verified | `game-rules-engine` |
