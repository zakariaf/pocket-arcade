# Build variants on Android

Every Android build is a **test** build (debug menu, test hooks, network guard, Google's test ads) or a **store** build (none of it), exactly as on iOS. This reference says where the variant enters an APK, the trap that silently ships test code, and what `check-emu-app` reads to prove a variant.

## Contents

- The matrix
- The three variables and the three moments
- The Metro cache trap
- The test-only gate and the sentinel
- The variant marker in the manifest
- The AdMob app id per mode
- Proving a variant (what check-emu-app reads)

## The matrix

| `APP_VARIANT` | `ADS_MODE` | Test-only code | AdMob app id in the manifest | Where it can go |
|---|---|---|---|---|
| `test` (default) | `test` (default) | compiled in | Google's Android sample `ca-app-pub-3940256099942544~3347511713`, Google's test units | emulator, Play internal testing for test builds |
| `test` | `off` | compiled in | the sample id, ads never initialised | screenshots, E2E, audits, the kill test |
| `store` | `live` | compiled out | the game's own Android id from `game.config.ts` `ads.ids.android` (owner step GP5) | Google Play |
| `store` | `off` | compiled out | the sample id, ads never initialised | Google Play (an ads-off game) and the store-variant proof |
| `test` | `live` | forbidden | | nowhere |
| `store` | `test` | forbidden | | nowhere |

The package is the same in every variant: `io.applander.<game id without hyphens>` (owner decision O4; Line Siege `io.applander.linesiege`), written by `withShell` as `android.package`, with `versionCode` equal to `game.config.ts` `buildNumber` (one build number shared with iOS). Android has no tracking prompt: `requestTracking` answers `'unavailable'` off iOS (lead decision L14), and Google's consent form is the only consent step (L10).

## The three variables and the three moments

| Variable | Values | Read by |
|---|---|---|
| `APP_VARIANT` | `test`, `store` | `app.config.ts` through `withShell` |
| `EXPO_PUBLIC_APP_VARIANT` | the same value | Metro, which inlines it into the bundle |
| `ADS_MODE` | `off`, `test`, `live` | `app.config.ts` (the manifest's AdMob id, `extra.adsMode`) |

The variant reaches the APK three times, each in its own process:

1. **Prebuild** evaluates `app.config.ts` and writes `android/app/src/main/AndroidManifest.xml` (the AdMob `APPLICATION_ID` meta-data, the `E07AppVariant` meta-data, the permissions).
2. **Inside Gradle**, expo-constants' task evaluates `app.config.ts` again and writes `app.config` into the generated assets; it ships as `assets/app.config`, which the runtime reads through `expo-constants` (`extra.appVariant`, `extra.adsMode`, `extra.game`).
3. **Inside Gradle**, `createBundleReleaseJsAndAssets` runs Metro, which inlines `process.env.EXPO_PUBLIC_APP_VARIANT`, folds the gate and writes `assets/index.android.bundle` (Hermes bytecode).

A shell that loses the variables between prebuild and Gradle mixes variants. `build-android-emu.ts` builds one environment (`selectAndroidToolchain()` plus `variantEnv()`) and passes it to every step; `parseEmuBuildArgs` uses the same `resolveBuildVariant` as `app.config.ts`, so `--variant store --ads test` fails before anything runs.

## The Metro cache trap

Metro's transform cache ignores `EXPO_PUBLIC_*` values and lives in `$TMPDIR/metro-cache`, shared by every project and both platforms. Verified on iOS: a store build made after a test build shipped the debug module. The same `metro.config.js` line fixes it for Android, because Gradle's bundling task runs the same Metro:

```js
config.cacheVersion = `app-variant-${process.env.EXPO_PUBLIC_APP_VARIANT ?? 'test'}`;
```

`check-emu-setup` rule `metro-cache-key` fails an app without it. The proof is a test build and a store build made back to back without clearing anything, both checked with `check-emu-app`.

## The test-only gate and the sentinel

The gate is the platform-neutral `packages/shell/src/app/test-only.ts` (ios-simulator-build and architecture-and-boundaries own it):

```ts
export const TEST_ONLY: TestOnlyApi | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'store'
    ? null
    : (require('./test-only-entry.ts') as TestOnlyApi);
```

Only the literal comparison in the same expression strips the module; an imported `IS_TEST_BUILD` constant keeps it. `test-only-entry.ts` exports `TEST_BUILD_SENTINEL = 'SHELL_TEST_BUILD_ONLY'`. Hermes keeps ASCII string literals in its bytecode, so:

```sh
unzip -p apps/line-siege/android/app/build/outputs/apk/release/app-release.apk assets/index.android.bundle | grep -a -c SHELL_TEST_BUILD_ONLY
```

prints 1 or more for a test build and 0 for a store build. `check-emu-app` rule `test-code` reads the same entry with its own zip reader.

## The variant marker in the manifest

`packages/shell/plugins/with-app-variant-marker.ts` writes the variant into the native project at prebuild: `E07AppVariant` in `Info.plist` on iOS and, for Android, a `<meta-data android:name="E07AppVariant" android:value="test|store">` under `<application>` (architecture-and-boundaries owns the plugin). It shows which variant the native side was generated for, independent of the bundle. `check-emu-app` rule `variant` fails a missing or different value.

## The AdMob app id per mode

`ads-config.ts` (admob-ads) gives the manifest's `com.google.android.gms.ads.APPLICATION_ID`:

- `off` and `test`: Google's Android sample id (the SDK crashes at launch without an id);
- `live`: the game's own Android id. Without `ads.ids.android` a live Android build gets no app id at all, never the sample (the sample in a live build would serve no ads and break Google's policy). `check-emu-app` then prints `owner-placeholder` for owner step GP5 and `OWNER STEPS PENDING: GP5`: the expected result until the owner's AdMob Android app exists. iOS releases are unaffected.

## Proving a variant (what check-emu-app reads)

`check-emu-app.mjs --apk <apk> --variant <v> --ads <m> --game <id> [--screenshot <png>]` reads the APK through aapt2 (build-tools 36.0.0) and its own zip reader:

| Evidence | Test build | Store build |
|---|---|---|
| `assets/index.android.bundle` sentinel count (`test-code`) | 1 or more | 0 |
| `assets/app.config` `extra.appVariant` / `extra.adsMode` (`constants-variant`) | `test` / `test` or `off` | `store` / `live` or `off` |
| `E07AppVariant` meta-data (`variant`) | `test` | `store` |
| AdMob `APPLICATION_ID` (`ad-app-id`, `owner-placeholder`) | the sample id | the sample id for `off`; the game's own id for `live`, or GP5 pending |
| Links `example.com`, `support@example.com` (`owner-placeholder`) | not checked | owner step G3 until supplied |
| package (`package`) | `io.applander.<game>` | `io.applander.<game>` |
| permissions (`permission`) | the allowlist | the allowlist |
| debuggable, supportsRtl, allowBackup, SDK levels | not debuggable, RTL on, backup on (D5), min 24 / target 36 | the same |
