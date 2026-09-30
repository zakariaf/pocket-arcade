# Build environment and Xcode selection

What the Mac needs before any iOS build, how the one pinned Xcode is selected for every child process, and which steps only the owner can do.

## Contents

- The toolchain (verified versions)
- Owner steps (password, sudo or Apple login)
- Selecting Xcode without xcode-select
- The environment of every tooling process
- Moving to Xcode 27 while on Expo SDK 57
- .gitignore lines for generated folders
- Disk space and cleanup

## The toolchain (verified versions)

Verified on 2026-09-26 on macOS 27.0 (Apple silicon). Re-check with `xcodebuild -version; xcrun simctl list runtimes; pod --version; node --version; npm --version` when a date is more than a few weeks old.

| Tool | Version | How it is pinned | Notes |
|---|---|---|---|
| macOS | Tahoe 26.2 or later (verified on 27.0) | none | Xcode 26.6's minimum is macOS 26.2 |
| Xcode | 26.6 (17F113) | `XCODE_VERSION = '26.6'` in `packages/tooling/src/ios/toolchain.ts` | Installed as `/Applications/Xcode-26.6.0.app`. Xcode 27.0 (27A266a) is also installed at `/Applications/Xcode.app` with its licence not accepted: never pick an Xcode by its file name |
| iOS simulator runtime | iOS 26.5 (23F77) | `IOS_RUNTIME = 'com.apple.CoreSimulator.SimRuntime.iOS-26-5'` | The iPhone 17 family and iPad (M5) models exist on 26.5; the iPhone 16 family exists only on the iOS 18 runtimes |
| altool | 26.40.1 | ships with Xcode | used by the release pipeline, not here |
| Node.js | 26.4.0 | `.mise.toml`, `.nvmrc` | runs the tooling `.ts` files directly (type stripping) |
| npm | 11.17.0 | bundled with Node 26.4.0 | |
| Ruby | 3.2.2 | `.mise.toml` | runs CocoaPods only |
| CocoaPods | 1.17.0 (1.15.2 also verified) | `gem install cocoapods -v 1.17.0` under the mise Ruby | Watchman is not needed |
| Expo SDK | 57.0.25 (React Native 0.86.3, React 19.2.3) | the app's `package.json` | Release builds embed the Hermes bytecode bundle; no Metro at run time |

`.mise.toml` at the repo root:

```toml
[tools]
node = "26.4.0"
ruby = "3.2.2"
```

`.nvmrc` holds `26.4.0`. Run `mise trust && mise install` at the repo root, then `npm ci`.

## Owner steps (password, sudo or Apple login)

The agent never types a password, runs `sudo` or signs in to an Apple account. These are the owner's, once per Mac (step IDs match the release pipeline's list):

- **O4 Install Xcode 26.6 and accept its licence.** Install from the Mac App Store or developer.apple.com/download/all. When several Xcodes coexist, keep the version in the file name: `/Applications/Xcode-26.6.0.app`. Then, in Terminal (admin password):

  ```sh
  # sudo drops DEVELOPER_DIR, and on a fresh Mac xcode-select does not point at a renamed Xcode,
  # so call this Xcode's own xcodebuild by its full path.
  sudo /Applications/Xcode-26.6.0.app/Contents/Developer/usr/bin/xcodebuild -license accept
  sudo /Applications/Xcode-26.6.0.app/Contents/Developer/usr/bin/xcodebuild -runFirstLaunch
  ```

  The agent may then run, without sudo:

  ```sh
  DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer xcodebuild -downloadPlatform iOS
  DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer xcrun simctl list runtimes   # expect iOS 26.5
  ```

- **Install mise** (`curl https://mise.run | sh`) if the Mac has none. Everything after that (Node, Ruby, CocoaPods, `npm ci`) the agent does.

When one of these is missing, stop and ask in one message: the step ID, the exact command or click, and what the build does meanwhile (nothing).

## Selecting Xcode without xcode-select

`xcode-select --switch` changes the Xcode of every process on the Mac, needs `sudo`, and one wrong switch silently builds every app with the iOS 27 SDK. So the tooling never calls it. Instead `selectXcode()` in `toolchain.ts`:

1. lists `/Applications/Xcode*.app`;
2. reads each one's version: `/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" <app>/Contents/Info.plist`;
3. picks the one equal to `XCODE_VERSION` (never "the one named Xcode.app");
4. sets `DEVELOPER_DIR=<app>/Contents/Developer` in the environment of every child process;
5. asserts that `xcodebuild -version` now prints `Xcode 26.6` on its first line.

Verified on this Mac on 2026-09-28: the function picks `/Applications/Xcode-26.6.0.app` (26.6) over `/Applications/Xcode.app` (27.0), and `xcodebuild -version` prints `Xcode 26.6 / Build version 17F113`.

The built app proves which Xcode made it: its `Info.plist` carries `DTXcode = 2660` for Xcode 26.6 (`2700` for 27.0). `check-sim-app.mjs` checks this.

## The environment of every tooling process

`toolEnv()` adds three variables on top of the caller's environment:

| Variable | Value | Why |
|---|---|---|
| `DEVELOPER_DIR` | the pinned Xcode's `Contents/Developer` | selects Xcode per process |
| `EXPO_NO_TELEMETRY` | `1` | no Expo CLI telemetry |
| `CI` | `1` | no interactive prompts (a prompt would hang an unattended run) |

The build then adds the three variant variables (see the build-variants reference) for the whole run.

## Moving to Xcode 27 while on Expo SDK 57

Switching Xcode is a deliberate commit, never a side effect:

1. Add the scene-support plugin to the `plugins` array that `withShell` returns (needs `expo` 57.0.23 or newer; if `expo-build-properties` is already listed, merge `enableSceneSupport: true` into its `ios` options instead of adding a second entry):

   ```ts
   // packages/shell/src/config/with-shell.ts (plugins excerpt: only when building SDK 57 with Xcode 27)
   import type { ExpoConfig } from 'expo/config';

   type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

   export const SCENE_SUPPORT_PLUGIN: PluginEntry = [
     'expo-build-properties',
     { ios: { enableSceneSupport: true } },
   ];
   ```

   Without it, an app built with the iOS 27 SDK on SDK 57 still uses the application life cycle and launches to a black screen on iOS 27. Verified: with the plugin, prebuild writes `UIApplicationSceneManifest` with `EXExpoAppSceneDelegate`, and the app still builds with Xcode 26.6 and launches on iOS 26.5. The plugin throws on a customised AppDelegate or an existing scene manifest.
2. Change `XCODE_VERSION` (and `IOS_RUNTIME` to the runtime that Xcode ships) in one commit.
3. The owner accepts the new licence (step O4).
4. Rerun the full suite: `npm run verify`, a test and a store simulator build back to back, the E2E flows and the screenshot matrix.

`check-sim-setup.mjs` fails (`scene-support`) when `XCODE_VERSION` is 27 or newer, an app is on Expo SDK 57, and `with-shell.ts` does not mention `enableSceneSupport`. On SDK 58 the setting is a no-op; remove it after that upgrade.

## .gitignore lines for generated folders

`ios/` and `android/` are generated by every `npx expo prebuild --clean` (Continuous Native Generation) and hand edits there are silently lost, so they are never committed. `build/` holds DerivedData, logs and archives. The root `.gitignore` needs at least:

```gitignore
apps/*/ios/
apps/*/android/
apps/*/build/
reports/
tools/
*.p8
AuthKey_*
ApiKey_*
*.p12
*.mobileprovision
*.xcarchive
*.ipa
```

`check-sim-setup.mjs` checks the first four; the release checker checks the signing lines.

## Disk space and cleanup

- Keep at least 60 GB free: Xcode is about 15 GB, the iOS runtime about 8 GB, and each app's DerivedData plus Pods takes several GB.
- Delete `apps/<game>/build/` after release runs.
- Run `xcrun simctl delete unavailable` monthly (it only removes simulators whose runtime is gone).
- Never `xcrun simctl shutdown all`, `erase all` or `delete all`: other agents use other simulators on the same Mac.
