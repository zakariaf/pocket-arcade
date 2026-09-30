# Xcode moves and iOS scene support

How the build Mac's Xcode is chosen, when a different Xcode is allowed, and the one extra step SDK 57 needs before it may be built with Xcode 27. Read it before any Xcode change, and when `check-sdk-alignment.mjs` reports `scene-support` or `xcode`.

## Contents

- How Xcode is selected
- Moving to another Xcode 26.x
- Building SDK 57 with Xcode 27: scene support
- Verifying scene support
- After the move to SDK 58
- Human steps

## How Xcode is selected

- The build scripts find the Xcode whose `Contents/Info.plist` `CFBundleShortVersionString` equals `XCODE_VERSION` in `packages/tooling/src/ios/toolchain.ts` (`'26.6'`), then export `DEVELOPER_DIR=<that app>/Contents/Developer` for every child process and assert `xcodebuild -version` prints `Xcode 26.6`.
- Never `sudo xcode-select`: other agents and the owner share the Mac, and `sudo` is a human step.
- On the build Mac (2026-09-26): `/Applications/Xcode-26.6.0.app` is 26.6 (17F113); `/Applications/Xcode.app` is 27.0 (27A266a) with its licence not accepted. altool 26.40.1 comes with Xcode 26.6. The iOS 26.5 simulator runtime is installed.
- `check-sdk-alignment.mjs` reads the same `XCODE_VERSION` (or `--xcode <version>`) for its `xcode` and `scene-support` rules.

## Moving to another Xcode 26.x

Allowed when Apple or an SDK needs it (SDK 58 needs 26.4 or newer; 26.6 already qualifies). It is its own commit: change `XCODE_VERSION`, then run a clean prebuild, a Release simulator build and the E2E flows for every app. Installing Xcode, accepting its licence (`sudo …/xcodebuild -license accept`) and `-runFirstLaunch` are the owner's steps.

## Building SDK 57 with Xcode 27: scene support

Apps built with the iOS 27 SDK that still use the application life cycle do not launch correctly on iOS 27. Expo's answer for SDK 57 is `expo-build-properties` → `ios.enableSceneSupport: true`, which needs `expo` 57.0.23 or newer (the plugin throws on older expo). The plugin rewrites only the standard SDK 57 Swift AppDelegate and adds the scene manifest to Info.plist; it throws on a customised AppDelegate or when the app already declares `UIApplicationSceneManifest` (read in the 57.0.22 source, `build/iosSceneSupport.js`). SDK 58 handles the scene life cycle itself.

Do not wait for Xcode 27 to move SDKs, and do not select Xcode 27 while on SDK 57 without this step. When the owner decides to build with Xcode 27 on SDK 57, in one commit:

1. `npx expo install expo-build-properties` in every app (SDK 57 writes `~57.0.22`; `expo` must be 57.0.23 or newer, the verified set has 57.0.25).
2. Copy `templates/shell-config/scene-support.ts` and `scene-support.test.ts` to `packages/shell/src/config/`.
3. In `packages/shell/src/config/with-shell.ts`, import `withSceneSupport` from `./scene-support.ts` and wrap the returned plugin list: `plugins: withSceneSupport([...])`. It merges `enableSceneSupport: true` into an existing `expo-build-properties` entry (a second entry would run the plugin twice) or appends one.
4. Add `expo-build-properties` to the Shell's `peerDependencies` (`"*"`).
5. Change `XCODE_VERSION` to the Xcode 27 version.
6. Verify (next section), then the full suite: prebuild, Release simulator build and launch, E2E, screenshots for every app.

`check-sdk-alignment.mjs` fails (`scene-support`) when `XCODE_VERSION` is 27 or later on SDK 57 and no config file switches scene support on (a `withSceneSupport(...)` call, or `enableSceneSupport: true` written in `with-shell.ts`, a plugin or `app.config.ts`), and when scene support is on with an `expo` older than 57.0.23. Copying `scene-support.ts` without the call in `withShell` does not count: the helper alone changes nothing.

## Verifying scene support

Verified on 2026-09-28 in a copy of the bootstrapped skeleton (expo 57.0.25, expo-build-properties 57.0.22): with `withSceneSupport` wrapping the plugin list, `npx expo config --type introspect --json` (test variant) showed

```json
"UIApplicationSceneManifest": {
  "UIApplicationSupportsMultipleScenes": false,
  "UISceneConfigurations": {
    "UIWindowSceneSessionRoleApplication": [
      { "UISceneConfigurationName": "Default Configuration", "UISceneDelegateClassName": "EXExpoAppSceneDelegate" }
    ]
  }
}
```

and the plugin entry `["expo-build-properties", { "ios": { "enableSceneSupport": true } }]`; lint, `tsc`, knip and Jest (47 tests, 100 % coverage) stayed green. On 2026-09-26 the same option was built with Xcode 26.6 and launched on the iOS 26.5 simulator after a prebuild that wrote the scene manifest, so turning it on early is safe. Check after every prebuild:

```sh
APP_VARIANT=test EXPO_PUBLIC_APP_VARIANT=test ADS_MODE=off npx expo config --type introspect --json \
  | node -e "let s='';process.stdin.on('data',(c)=>{s+=c;}).on('end',()=>{console.log(JSON.stringify(JSON.parse(s).ios.infoPlist.UIApplicationSceneManifest));})"
```

## After the move to SDK 58

`enableSceneSupport` is a no-op on SDK 58: in the move commit remove the `withSceneSupport` call, delete `scene-support.ts` and its test, and uninstall `expo-build-properties` if nothing else uses it. `check-sdk-alignment.mjs` fails (`scene-support`) while `enableSceneSupport: true` remains on SDK 58.

## Human steps

- Installing an Xcode, accepting its licence, `-runFirstLaunch`, downloading a simulator runtime.
- Deciding to build with Xcode 27 before Apple requires it (the default is to stay on 26.6).
- Nothing in this reference needs the App Store Connect key; never read it.
