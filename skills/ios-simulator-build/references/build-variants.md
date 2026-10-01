# Build variants: test and store

Every Pocket Arcade build is either a **test** build (debug menu, test hooks, network guard, Google test ads) or a **store** build (none of that). This reference explains how the variant is chosen, the three moments it enters the binary, and the two verified traps that silently ship test code to players.

## Contents

- The matrix
- The three variables and why they stay exported for the whole run
- How app.config.ts turns them into a config
- Trap 1: Metro caches transforms across variants
- Trap 2: an imported constant does not remove code
- The test-only gate and the sentinel
- Declaring the variable for TypeScript
- Proving a variant (what check-sim-app looks at)

## The matrix

| `APP_VARIANT` | `ADS_MODE` | Debug menu, deep links, network guard | Ad app ID and units | Where it can go |
|---|---|---|---|---|
| `test` (default) | `test` (default) | compiled in | Google sample app ID `ca-app-pub-3940256099942544~1458002511` and `TestIds.*` | simulator, internal TestFlight only |
| `test` | `off` | compiled in | sample app ID, ads never initialised | screenshots, E2E, runtime network audit |
| `store` | `live` (default for store) | compiled out | the game's real IDs from `game.config.ts` | TestFlight (internal and external) and the App Store |
| `store` | `off` | compiled out | sample app ID in Info.plist, ads never initialised (an "ads off" game) | same as above |
| `test` | `live` | forbidden | real ads in a debug build | nowhere |
| `store` | `test` | forbidden | test ads in a store build | nowhere |

Both variants use the same bundle ID and the same App Store Connect app record: `io.applander.<game id without hyphens>`, all lowercase (owner decision O4, 2026-09-30; Line Siege is `io.applander.linesiege`), with Premium `<bundle id>.premium`. `withShell` refuses any other id, so `com.example.*` never builds. A separate `.test` bundle ID would need a second app record, which is an owner step, so it is not used.

Every variant also carries Apple's App Tracking Transparency text (owner decision O1): the `expo-tracking-transparency` plugin in `shell-plugins.ts` writes `NSUserTrackingUsageDescription` (the en text) into `Info.plist`, and `withShell`'s `locales.<lang>.ios.NSUserTrackingUsageDescription` puts each language's text into `<lang>.lproj/InfoPlist.strings` (en, de, fa, ckb). The prompt itself shows only when ads run (`ADS_MODE=test` or `live`), after Google's consent form; an `off` build never asks.

The Info.plist always carries a `GADApplicationIdentifier` (a missing one crashes at launch), because the AdMob SDK is linked in every variant: the sample ID unless the mode is `live`.

## The three variables and why they stay exported for the whole run

| Variable | Values | Read by |
|---|---|---|
| `APP_VARIANT` | `test`, `store` | `app.config.ts` (through `withShell`) |
| `EXPO_PUBLIC_APP_VARIANT` | the same value | Metro, which inlines it into the JS bundle |
| `ADS_MODE` | `off`, `test`, `live` | `app.config.ts` (native app ID, `extra.adsMode`) |

The variant reaches the binary at three moments, each in its own process:

1. **Prebuild** evaluates `app.config.ts` and writes `Info.plist` (for example `GADApplicationIdentifier`).
2. **Inside `xcodebuild`**, the build phase "Generate app.config for prebuilt Constants.manifest" evaluates `app.config.ts` again and writes `EXConstants.bundle/app.config`, where the runtime reads `extra.appVariant` and `extra.adsMode` through `expo-constants`.
3. **Inside `xcodebuild`**, the phase "Bundle React Native code and images" runs Metro, which inlines `process.env.EXPO_PUBLIC_APP_VARIANT` and decides which modules enter `main.jsbundle`.

A shell that loses the variables between prebuild and `xcodebuild` silently mixes variants: a store Info.plist with a test bundle, or the reverse. So `build-ios-sim.ts` builds one environment (`selectXcode()` plus `variantEnv()`) and passes it to every step. Setting `EXPO_PUBLIC_APP_VARIANT` from inside `app.config.ts` does not work either: Metro runs later, in the Xcode build phase, with its own environment.

`resolveBuildVariant()` throws when the two variant variables differ (`EXPO_PUBLIC_APP_VARIANT=test must equal APP_VARIANT=store`), on an unknown value, and on a forbidden pair. The CLI parses its flags with the same function, so `--variant store --ads test` fails before anything runs.

## How app.config.ts turns them into a config

`apps/<game>/app.config.ts` is one statement, `export default withShell(gameConfig, process.env);`, after importing `withShell` from `@e07/shell/config/with-shell.ts` and `gameConfig` from `./game.config.ts`. It is loaded by Node's type stripping, not by Metro, so every file it reaches uses explicit `.ts` import extensions and erasable syntax only (no enums, no namespaces, no parameter properties). Passing `process.env` in keeps `withShell` pure and testable.

The fields of `withShell` that builds rely on (verified with `npx expo config --json --type prebuild`):

| Field | Value |
|---|---|
| `version`, `ios.buildNumber` | from `game.config.ts` (the only place they live) |
| `ios.deploymentTarget` | `'16.4'` (the built-in key) |
| `ios.appleTeamId` | from `APPLE_TEAM_ID` when set (writes `DEVELOPMENT_TEAM`) |
| `ios.config.usesNonExemptEncryption` | `false` (Info.plist `ITSAppUsesNonExemptEncryption = false`) |
| `ios.infoPlist.CADisableMinimumFrameDurationOnPhone` | `true` (120 Hz on ProMotion phones) |
| `ios.privacyManifests` | aggregated required-reason APIs (bundle gets `PrivacyInfo.xcprivacy`) |
| `updates.enabled` | `false` |
| `extra.appVariant`, `extra.adsMode` | the resolved variant (`adsMode` is `off` when the game's ads are off) |
| `experiments.reactCompiler` | `true` |

The Xcode project itself still shows `CURRENT_PROJECT_VERSION = 1` and `MARKETING_VERSION = 1.0`; that is harmless, the generated Info.plist holds the literal values and those ship.

## Trap 1: Metro caches transforms across variants

Metro inlines `EXPO_PUBLIC_*` values while transforming a file, but the values are not part of its cache key, and the cache lives in `$TMPDIR/metro-cache`, shared by every project on the Mac. Verified on 2026-09-26: a test build followed by a store build produced a store bundle that still said `variant=test` and contained the debug module, both with `expo export` and with `expo export:embed` (the Xcode bundling phase).

The fix is one line in every app's `metro.config.js` (template `templates/apps/game/metro.config.js`):

```js
config.cacheVersion = `app-variant-${process.env.EXPO_PUBLIC_APP_VARIANT ?? 'test'}`;
```

With it, back-to-back test, store and test builds were each correct. The file is JavaScript because Metro loads it directly (like `babel.config.js`); `npx expo-doctor` still passes 21/21 with it.

## Trap 2: an imported constant does not remove code

Metro inlines `process.env.EXPO_PUBLIC_*`, folds constant conditions, and only then collects `require` dependencies. A `require` in a branch that folds to false never enters the bundle, but only when the comparison is **in the same expression**. Verified with three versions of the same code: gating with an imported `IS_TEST_BUILD` constant kept the test-only module in the store bundle; the inline comparison removed it.

## The test-only gate and the sentinel

`packages/shell/src/app/test-only.ts` is the only file allowed to `require()` test-only code (it has the one ESLint file-level exemption for `@typescript-eslint/no-require-imports`):

```ts
export const TEST_ONLY: TestOnlyApi | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'store'
    ? null
    : (require('./test-only-entry.ts') as TestOnlyApi);
```

- `test-only-entry.ts` exports everything test-only (debug screens, the deep-link handler, the debug services `createDebugServices`, `createSimulatedConnectivity` and `createSimulatedClock`, the JS network guard, the debug key-value store, the parity harness of toybox-visual-parity) plus `TEST_BUILD_SENTINEL = 'SHELL_TEST_BUILD_ONLY'`. The composition root builds its one ConnectivityPort as `TEST_ONLY?.createSimulatedConnectivity(real) ?? real` and its one ClockPort as `TEST_ONLY?.createSimulatedClock(real) ?? real`, so the debug "Simulate offline" switch and the debug date reach every reader, and hands `TEST_ONLY?.createDebugServices(...)` (null in store builds) to the debug screen and the link handler.
- Callers use `TEST_ONLY?.DebugScreen` and similar. Nothing else imports `test-only-entry.ts`: one direct import would ship it in every build (`check-sim-setup.mjs` rule `test-only-import`).
- Constants such as `IS_TEST_BUILD` may drive behaviour, never inclusion.
- Hermes bytecode keeps ASCII string literals, so `grep -a -c SHELL_TEST_BUILD_ONLY main.jsbundle` finds the sentinel in a built app: once or more in a test build, zero times in a store build (verified in Release simulator builds).
- It lives in `src/app/` (app code checked by the Shell's tsconfig), not in `src/config/`, which is Node-side config.

## Declaring the variable for TypeScript

`packages/shell/src/app-env.d.ts` (template included):

```ts
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_APP_VARIANT?: 'test' | 'store';
  }
}
declare const process: { readonly env: NodeJS.ProcessEnv };
```

Without the `ProcessEnv` entry, `noPropertyAccessFromIndexSignature` rejects `process.env.EXPO_PUBLIC_APP_VARIANT` (TS4111). Without the `process` line, the Shell program (types `["jest"]`, no `expo-env.d.ts`) fails with TS2591 "Cannot find name 'process'". Use `declare const`, not `declare var` (`no-var`). Dot access matters: Expo inlines `EXPO_PUBLIC_*` only when read as `process.env.NAME`; `process.env['NAME']` inside the Shell trips `expo/no-dynamic-env-var`.

## Proving a variant (what check-sim-app looks at)

After a build, `check-sim-app.mjs --app <path.app> --variant <v> --ads <m>` reads the built app:

| Evidence | Test build | Store build |
|---|---|---|
| `main.jsbundle` sentinel count | 1 or more | 0 |
| `EXConstants.bundle/app.config` `extra.appVariant` / `extra.adsMode` | `test` / `test` or `off` | `store` / `live` or `off` |
| `Info.plist` `GADApplicationIdentifier` | the sample ID | a real `ca-app-pub-<16 digits>~<10 digits>` for `live`, the sample ID for `off` |
| Owner placeholders (`owner-placeholder`) | the AdMob app id placeholder | the AdMob app id and (live) units `ca-app-pub-1234567890123456~1234567890`, `/1111111111`, `/2222222222`, `/3333333333` (owner step G5), the links `example.com` and `support@example.com` (owner step G3); then `OWNER STEPS PENDING: G3, G5` before `RESULT: FAIL`, the expected result until the owner supplies them |
| `Info.plist` `CFBundleIdentifier` | `io.applander.<game>` (checked with `--game`) | `io.applander.<game>`, never `com.example.*` |
| `NSUserTrackingUsageDescription` in `Info.plist` and in `en`, `de`, `fa`, `ckb.lproj/InfoPlist.strings` | required | required |
| `*.storekit`, `*.xctest` in the bundle | allowed | none |
| `DTXcode` | `2660` | `2660` |

The proof that the mechanism works on this repo is a test build and a store build made back to back without clearing caches, each checked (the example in `examples/variant-proof.md`).
