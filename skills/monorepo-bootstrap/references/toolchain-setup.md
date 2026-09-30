# Toolchain setup from zero (the Mac, before the first install)

What must be on the build Mac before the monorepo can be installed and built, which steps need the owner, and how to check each one. Read this at the start of a bootstrap, or when a check reports the wrong Node, npm or Xcode.

## Contents

- The verified toolchain
- Owner steps (human)
- Agent steps
- Selecting Xcode without xcode-select
- Checks to run before installing
- Prebuild facts worth knowing early

## The verified toolchain

Checked on 2026-09-26 and re-used on 2026-09-28:

| Tool | Version | How it is pinned | Notes |
|---|---|---|---|
| macOS | 27.0, Apple silicon | none | Xcode 26.6 needs macOS Tahoe 26.2 or later |
| Xcode | 26.6 (17F113) | `XCODE_VERSION = '26.6'` in `packages/tooling/src/ios/toolchain.ts` (written by the build skills); scripts export `DEVELOPER_DIR` | Xcode 27.0 is also installed at `/Applications/Xcode.app` with its licence not accepted; it is not used |
| iOS simulator runtime | iOS 26.5 (23F77) | device and runtime names in tooling | iPhone 17 family and iPad (M5) models exist on 26.5 |
| Node.js | 26.4.0 | `.mise.toml`, `.nvmrc` | ships npm 11.17.0; Node 26 becomes LTS on 2026-10-28 |
| npm | 11.17.0 | bundled with Node 26.4.0; `engines.npm >=11.17.0` + `engine-strict=true` | first npm with `min-release-age-exclude`; `approve-scripts` since 11.16 |
| mise | any current release | | manages Node and Ruby |
| Ruby | 3.2.2 | `.mise.toml` | runs CocoaPods only |
| CocoaPods | 1.17.0 (1.15.2 also verified) | `gem install cocoapods -v 1.17.0` | matches the `macos-26` CI image |
| Java | 17 | `JAVA_HOME` | for Maestro later; on this Mac the Android Studio JBR 17.0.11 |

Keep at least 60 GB free: Xcode is about 15 GB, the iOS runtime about 8 GB, and each app's DerivedData plus Pods takes several GB.

## Owner steps (human)

These need a password, `sudo` or an Apple login. Ask for them in one message, name the step and give the default that applies until it is done; never try to work around them.

1. **Install Xcode 26.6** from the Mac App Store or developer.apple.com. With several Xcodes, keep the version in the name: `/Applications/Xcode-26.6.0.app`.
2. **Accept the licence and run the first launch** (admin password). Call that Xcode's own `xcodebuild`, because `sudo` drops `DEVELOPER_DIR`:
   ```sh
   sudo /Applications/Xcode-26.6.0.app/Contents/Developer/usr/bin/xcodebuild -license accept
   sudo /Applications/Xcode-26.6.0.app/Contents/Developer/usr/bin/xcodebuild -runFirstLaunch
   ```
3. **App Store Connect key (once, for releases later).** A team API key with the Admin role, saved as `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8` with `chmod 600`, and the IDs in `~/.zshenv` (never in the repo): `ASC_KEY_ID`, `ASC_ISSUER_ID`, `APPLE_TEAM_ID`. The agent never opens, prints, copies or commits the key; the bootstrap only needs this to exist before the first release, not before the first install.
4. **Trust the project folder in Claude Code once.** Project-scoped permission rules are dropped while a workspace is not trusted.

## Agent steps

```sh
# mise, then Node and Ruby from the repo's .mise.toml (written by the generator)
curl https://mise.run | sh            # only if mise is missing
mise trust && mise install            # at the repo root; Node 26.4.0 ships npm 11.17.0
gem install cocoapods -v 1.17.0       # under the mise Ruby
# the iOS platform for the pinned Xcode (no sudo needed)
DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer xcodebuild -downloadPlatform iOS
DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer xcrun simctl list runtimes   # expect iOS 26.5
```

Java 17: on this Mac `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`. On a Mac without Android Studio, add `java = "temurin-17"` to `.mise.toml` (listed by mise, not verified end to end) and point `JAVA_HOME` at it.

Export `EXPO_NO_TELEMETRY=1` and `CI=1` in every tooling run: no Expo CLI telemetry and no interactive prompts. `npx expo install --check` and `expo-doctor` contact Expo's API; that is allowed for development tools, because the no-network rule covers the app, not the toolchain.

## Selecting Xcode without xcode-select

Never run `sudo xcode-select`. The build scripts find the Xcode whose `Contents/Info.plist` `CFBundleShortVersionString` equals `XCODE_VERSION`, export `DEVELOPER_DIR=<app>/Contents/Developer` for every child process, and assert:

```sh
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" /Applications/Xcode-26.6.0.app/Contents/Info.plist   # 26.6
xcodebuild -version | head -1        # must print: Xcode 26.6
xcrun altool --version               # 26.40.1 with Xcode 26.6
```

Why: Xcode 27.0 sits at `/Applications/Xcode.app`. Building Expo SDK 57 with Xcode 27 needs `ios.enableSceneSupport` first (apps built with the iOS 27 SDK that still use the application life cycle do not launch correctly on iOS 27); the `expo-sdk-upgrade` skill owns that move. Any tool that picks "Xcode.app", or a future `xcode-select` change, would silently switch every build.

## Checks to run before installing

```sh
node --version          # v26.4.0
npm --version           # 11.17.0 (engine-strict refuses older)
git rev-parse --is-inside-work-tree   # true; lefthook installs through "prepare" and needs git
DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer xcodebuild -version
pod --version           # 1.17.0 (only needed for prebuild)
```

The bootstrap itself (files, install, gates, `npx expo config`, `expo export`) needs neither Xcode nor CocoaPods; they matter from the first prebuild on.

## Prebuild facts worth knowing early

The build skills own prebuild, but these facts shape the bootstrap files:

```sh
export DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer EXPO_NO_TELEMETRY=1 CI=1
export APP_VARIANT=test EXPO_PUBLIC_APP_VARIANT=test ADS_MODE=test
cd apps/<pilot>
npx expo prebuild --platform ios --clean     # regenerates ios/ and runs pod install
WS=$(ls -d ios/*.xcworkspace | head -1)      # "Line Siege" -> ios/LineSiege.xcworkspace
SCHEME=$(basename "$WS" .xcworkspace)
```

- `ios/` and `android/` are generated (Continuous Native Generation) and gitignored; every native setting goes through `app.config.ts` and config plugins, never a hand edit.
- The workspace and scheme names come from `expo.name` without spaces, not from `package.json`.
- Prebuild writes `ios.buildNumber` to `CFBundleVersion`, `version` to `CFBundleShortVersionString`, `usesNonExemptEncryption: false` to `ITSAppUsesNonExemptEncryption`, `ios.appleTeamId` (from `APPLE_TEAM_ID`, only when set) to `DEVELOPMENT_TEAM`, `deploymentTarget: '16.4'` to `IPHONEOS_DEPLOYMENT_TARGET`, and the `infoPlist` keys verbatim. The `pbxproj` still shows `CURRENT_PROJECT_VERSION = 1`; the generated Info.plist holds the real values.
- `pod install` downloads the vendor pods (AdMob, UMP, openiap) once those packages are installed, so prebuild needs the network; the app does not.
- Export `APP_VARIANT`, `EXPO_PUBLIC_APP_VARIANT` (same value) and `ADS_MODE` for the whole run: prebuild writes Info.plist, and inside `xcodebuild` the app config is evaluated again and Metro inlines `EXPO_PUBLIC_APP_VARIANT`. `app.config.ts` throws on an unknown value, a mismatch, or a forbidden pair (`test`+`live`, `store`+`test`).
