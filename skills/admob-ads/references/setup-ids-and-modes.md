# Setup, IDs, ADS_MODE and SKAdNetwork

## Contents

- Versions and install
- The build-variant matrix (APP_VARIANT x ADS_MODE)
- Where the IDs live (game.config.ts)
- ads-config.ts: plugin options and live-ID guard
- Wiring into withShell and expo.extra
- What the config plugin writes
- Google's test IDs
- Android: ids per mode, the SDK versions, AD_ID
- Reading the mode at runtime
- SKAdNetwork identifiers and the refresh script
- Lint guards already in the repo config
- Re-verify after an upgrade

## Versions and install

| Item | Version (verified 2026-09-26) | Note |
|---|---|---|
| `react-native-google-mobile-ads` | 17.2.0 exact | peers: `expo >=47`, `react-native >=0.86.0`; rollback target 16.5.0 |
| Google Mobile Ads iOS SDK (pod) | 13.6.0 | resolved by 17.2.0 |
| GoogleUserMessagingPlatform (pod) | 3.1.0 | the UMP consent SDK |
| Google Mobile Ads Android SDK | 25.4.0 | the package's `sdkVersions.android.googleMobileAds` (checked 2026-10-12) |
| UMP Android SDK | 4.0.0 | `sdkVersions.android.googleUmp` |
| Android levels | minSdk 24, compileSdk 36, targetSdk 36 (build tools 36.0.0) | `sdkVersions.android`; the app's own levels come from the Android build (android-emulator-build) |
| `expo-network` | ~57.0.2 | the `ConnectivityPort` adapter |
| `expo-constants` | SDK 57 | reads `expo.extra` at runtime |

```sh
# inside every apps/<game> (all apps in the same change)
npm install -E react-native-google-mobile-ads@17.2.0   # npx expo install would write ^17.2.0
npx expo install expo-network expo-constants
npx expo prebuild --platform ios --clean              # after any plugin option change
```

Why exactly 17.2.0: v17 is where fixes land and it had three releases in eight days, so an exact pin turns every change into a reviewed commit.

17.2.0 was published on 2026-09-25, so until it is 7 days old the repo's `.npmrc` release-age policy (`min-release-age=7`) accepts it only through the dated `min-release-age-exclude[]=react-native-google-mobile-ads` line of the bootstrap block (which expires on 2026-10-03). An `ETARGET No matching version found` error means that line is missing; restoring it is the dependency-management work, never a looser pin. A newer version (checked 2026-09-28: 17.2.0 is still the latest) needs the re-verification below first. Never hand-edit `ios/`: the project uses Continuous Native Generation, so every native setting comes from the config plugin.

## The build-variant matrix (APP_VARIANT x ADS_MODE)

| `APP_VARIANT` | `ADS_MODE` | Debug menu, deep links | Ad app ID / units | Where it can go |
|---|---|---|---|---|
| `test` (default) | `test` (default) | compiled in | Google sample app ID (iOS `ca-app-pub-3940256099942544~1458002511`, Android `ca-app-pub-3940256099942544~3347511713`) and `TestIds.*` | simulator, emulator, internal TestFlight |
| `test` | `off` | compiled in | sample app ID, ads never initialised | screenshots, E2E, runtime network audit |
| `store` | `live` (default) | compiled out | the game's real IDs from `game.config.ts`, per platform; Android: `ads.ids.android`, and without it no Android app id at all (owner step GP5) | TestFlight and the App Store; Google Play |
| `store` | `off` | compiled out | sample app ID in Info.plist and the manifest, ads never initialised (spec 4.3 "ads off" game) | same |
| `test` | `live` | forbidden | real ads in a debug build | none |
| `store` | `test` | forbidden | test ads in a store build | none |

- `app-variant.ts` (`resolveBuildVariant`) throws on an unknown value, a mismatch between `APP_VARIANT` and `EXPO_PUBLIC_APP_VARIANT`, or a forbidden pair. The template is in `templates/packages/shell/src/config/app-variant.ts`; keep the existing file if the repo already has it.
- Export `APP_VARIANT`, `EXPO_PUBLIC_APP_VARIANT` and `ADS_MODE` for the whole build run (prebuild writes `GADApplicationIdentifier`, the Xcode phase re-evaluates `app.config.ts` into `EXConstants.bundle/app.config`, and Metro inlines `EXPO_PUBLIC_APP_VARIANT`). A shell that loses them between prebuild and `xcodebuild` silently mixes variants.
- The game's master switch `ads.isEnabled: false` forces `ADS_MODE=off` for every build (spec 4.3).
- In test builds the debug menu may switch `test` to `off` ("Never show ads") at runtime; it can never switch to `live` (spec S15).

Why: spec 8.8 says development and test builds use only Google's test ads. Real ads in a test build risk invalid-traffic penalties on the owner's AdMob account.

## Where the IDs live (game.config.ts)

The game's AdMob IDs live only in `apps/<game>/game.config.ts`, in its `ads` section:

```ts
ads: {
  isEnabled: true, // spec 4.3 master switch; false => ADS_MODE=off for every build
  policy: {
    minLevelsCompletedBeforeFirst: 3,
    minMsBetweenInterstitials: 180_000,
    minLevelsCompletedBetween: 2,
  },
  ids: {
    ios: {
      appId: 'ca-app-pub-1234567890123456~1234567890', // from the owner (console step A2)
      units: {
        banner: 'ca-app-pub-1234567890123456/1111111111',
        interstitial: 'ca-app-pub-1234567890123456/2222222222',
        rewarded: 'ca-app-pub-1234567890123456/3333333333',
      },
    },
    android: null, // iOS first; the owner's Android AdMob app and its 3 units (GP5) fill it
  },
},
```

The Android entry has the same shape (`{ appId, units: { banner, interstitial, rewarded } }`) and its own ids: AdMob makes one app per platform, so the Android app id and units always differ from the iOS ones.

- The values above are placeholders in the documented format (`ca-app-pub-<16 digits>~<10 digits>` for the app, `/<10 digits>` for units). Until the owner supplies real IDs, only `APP_VARIANT=test` and `store` + `ADS_MODE=off` can build: `assertLiveIds` throws for `live`.
- Real IDs are not secrets (they ship in every store build), but app code never imports `game.config.ts`: it reads only what `withShell` embeds in `expo.extra`.
- The policy numbers are the spec 8.8 defaults. They are configuration, never hard-coded in `ad-policy.ts`.

## ads-config.ts: plugin options and live-ID guard

`templates/packages/shell/src/config/ads-config.ts` runs in Node inside `app.config.ts` (type stripping: erasable TypeScript, explicit `.ts` imports). It exports:

- `GOOGLE_SAMPLE_APP_IDS`: Google's sample app IDs (iOS `~1458002511`, Android `~3347511713`). The only place in our code where the sample publisher `3940256099942544` may appear.
- `assertLiveIds(ids)`: throws unless the app ID and all three unit IDs match the formats and none contains the sample publisher.
- `admobPluginOptions(mode, ids, skAdNetworkItems)`: `iosAppId` is the game's app ID only when `live`, otherwise the sample; `androidAppId` is the game's Android app id when `live` (validated), the Android sample in `test` and `off`, and absent in a `live` build whose `ads.ids.android` is `null`: never Google's sample in a live build (`check-ads` rule `android-ids`); `delayAppMeasurementInit: true`; the SKAdNetwork list. The SDK is linked in every variant, so Info.plist always needs an app ID (a missing `GADApplicationIdentifier` crashes at launch). It never returns `userTrackingUsageDescription`: Apple's tracking prompt text is written once, by the `expo-tracking-transparency` plugin entry and `withShell`'s locales (references/consent-flow.md, "App Tracking Transparency").
- `adUnitsExtra(mode, ids)`: the unit IDs for `expo.extra.adUnits` per platform, `{ ios: <units>, android: <units> | null }`, only when `live` (each validated); `null` otherwise. `readAdsExtra` takes the entry of `Platform.OS`, so a live Android build never shows ads from the iOS units, and gets none while `ads.ids.android` is `null` (`check-ads` rule `android-units`).

`ads-config.test.ts` proves: sample IDs and no units in `test`/`off`; the game's IDs in `live`; an iOS-only game (Android `null`) is accepted with its iOS values unchanged; sample or malformed IDs throw in `live`; and on Android: the Android sample app id in `test` and `off`, the game's Android app id in `live`, no Android app id at all in a live build without Android ids, and the units per platform.

Why no sample in a live build: a store build on Google's sample app serves no real ads and breaks AdMob's policy for published apps. The plugin then writes no `APPLICATION_ID`, so that Android build is not shippable: android-emulator-build's `check-emu-app` and android-release-play's `check-store-aab` and `check-release-setup-android` report it as owner step GP5 (`owner-placeholder`, `OWNER STEPS PENDING: GP5`), while iOS releases of the same game still build.

## Wiring into withShell and expo.extra

`withShell` (the Shell's config composer in `packages/shell/src/config/with-shell.ts`) already computes `adsMode = game.ads.isEnabled ? variant.adsMode : 'off'` and writes `extra.adsMode` and, only when `adUnitsExtra` returns units, `extra.adUnits` (the key is omitted otherwise, never `null`: a `null` in `extra` arrives as `{}` at runtime). The plugin entry lives in the Shell's one plugin list, `shellPlugins(game, adsMode)` in `packages/shell/src/config/shell-plugins.ts`, which `withShell` spreads (architecture-and-boundaries ships both files, and the template already holds this line):

```ts
import { admobPluginOptions } from './ads-config.ts';
import { SKADNETWORK_IDS } from './skadnetwork-ids.ts';

// packages/shell/src/config/shell-plugins.ts, inside shellPlugins(game, adsMode):
['react-native-google-mobile-ads', admobPluginOptions(adsMode, game.ads.ids, SKADNETWORK_IDS)],
```

Pass the options through this function only. Never add `userTrackingUsageDescription` (a second writer of the ATT text), never write the plugin entry by hand with literal IDs, and never edit `ios/`.

The same plugin list holds Apple's tracking prompt (owner decision O1), right after the ads line:

```ts
// packages/shell/src/config/shell-plugins.ts: the en text from the Shell catalog
['expo-tracking-transparency', { userTrackingPermission: TRACKING_USAGE_DESCRIPTIONS.en }],
```

`TRACKING_USAGE_DESCRIPTIONS` (exported by `shell-plugins.ts`) reads `consent.tracking.usage-description` from the four Shell catalogs, and `withShell` writes `locales.<lang>.ios.NSUserTrackingUsageDescription` for en, de, fa and ckb next to `CFBundleDisplayName`. Install the package in every app with the Expo table spec `~57.0.2` (the dependency-management skill's plan; the Shell lists it as a `*` peer and the root pins it in `overrides`).

## What the config plugin writes

Read in the 17.2.0 plugin source and seen in a prebuilt `Info.plist`:

- `GADApplicationIdentifier` (from `iosAppId`), `GADDelayAppMeasurementInit`, `SKAdNetworkItems` (it only adds IDs that are missing) and, only if given, `NSUserTrackingUsageDescription` (never given: the `expo-tracking-transparency` plugin writes it, and Expo writes each language's `InfoPlist.strings` from `withShell`'s locales; seen in a 2026-09-30 build: the base `Info.plist` holds the en text and `en.lproj`, `de.lproj`, `fa.lproj`, `ckb.lproj` hold the four texts).
- Android manifest meta-data `com.google.android.gms.ads.APPLICATION_ID` (from `androidAppId`), `DELAY_APP_MEASUREMENT_INIT`, `OPTIMIZE_INITIALIZATION`, `OPTIMIZE_AD_LOADING` (the last two default to `true`).
- The plugin only warns (does not fail) when an app ID is missing ("The native Google Mobile Ads SDK will crash on Android without it"), which is why `admobPluginOptions` always returns an iOS one, and an Android one in every build except a live build without the game's Android ids (that build must never ship; the Android gates stop it as GP5).

## Google's test IDs

Platform-aware values of the library's `TestIds` (identical to Google's demo units on 2026-09-26):

| Format | iOS test unit | Android test unit |
|---|---|---|
| Adaptive banner | `ca-app-pub-3940256099942544/2435281174` | `ca-app-pub-3940256099942544/9214589741` |
| Interstitial | `ca-app-pub-3940256099942544/4411468910` | `ca-app-pub-3940256099942544/1033173712` |
| Rewarded | `ca-app-pub-3940256099942544/1712485313` | `ca-app-pub-3940256099942544/5224354917` |

Code never types these strings: `admob-ads-adapter.ts` reads `TestIds.ADAPTIVE_BANNER`, `TestIds.INTERSTITIAL` and `TestIds.REWARDED` into `ADMOB_TEST_UNITS`, and the library picks the platform's values (`Platform.select`). Simulators and emulators are test devices automatically, and a physical device in a test build still gets test units, so no `testDeviceIdentifiers` are needed. The root Jest mock carries both sets the same way: the `unit-android` project sees the Android values.

The library's own `TestIds` module is bundled into every app (Metro does not tree-shake), so the sample publisher ID is present in every JS bundle inside `node_modules/react-native-google-mobile-ads/`. Release checks therefore attribute it by module; they never grep the raw bundle.

## Android: ids per mode, the SDK versions, AD_ID

| Build | Android app id (manifest `APPLICATION_ID`) | Units (`expo.extra.adUnits.android`) |
|---|---|---|
| `test` + `test` | Google's sample `ca-app-pub-3940256099942544~3347511713` | none: `ADMOB_TEST_UNITS` from `TestIds` (Android values) |
| `test` or `store` + `off` | the sample | none; ads never initialised |
| `store` + `live` with `ads.ids.android` | the game's Android app id | the game's three Android units |
| `store` + `live` without `ads.ids.android` | none at all (never the sample) | `null`: owner step GP5 pending, not shippable |

- Versions come from the package's own `sdkVersions.android`: GMA 25.4.0, UMP 4.0.0, minSdk 24, compile and target 36. Nothing in our config sets them; the Android build reads them.
- `com.google.android.gms.permission.AD_ID` is declared by the ads SDK and by the `expo-tracking-transparency` plugin (its Android half adds only that permission). Ads need it (the advertising id for frequency capping and, with consent, personalisation), so nothing may block or strip it: not `android.blockedPermissions`, not `withBlockedPermissions`, not a `tools:node="remove"` plugin (`check-ads` rule `ad-id-permission`). Play's Data safety form then declares "Device or other IDs" for advertising (privacy-and-network-audit owns that form).
- No SKAdNetwork on Android: the list is iOS-only (`Info.plist`), the manifest gets nothing from it.
- Real Android ids, like the iOS ones, reach the app only through `expo.extra`; the AdMob console steps for the Android app are in references/console-privacy-troubleshooting.md (GP5).

## Reading the mode at runtime

`read-ads-extra.ts` reads `Constants.expoConfig.extra` (embedded at build time) and, of `extra.adUnits`, only the entry of `Platform.OS` (`readAdsExtra(extra, os)`; tests pass `os`). Anything unexpected falls back to `off` or to no units, because a broken config must never show real ads. `ads-factory.ts` (`createAdsPort(extra, onAdError)`) then returns:

- `off`: the fake adapter with every slot empty and nothing ever requested (spec 4.3, screenshots, E2E).
- `test`: the AdMob adapter with `ADMOB_TEST_UNITS`.
- `live`: the AdMob adapter with this platform's `extra.adUnits`; it throws when they are missing (a `withShell` bug on iOS; on Android a live build without the game's Android ids, which the Android gates refuse as GP5).

The consent port follows the same mode: `createConsentPort(adsMode, { onError })` (`consent-factory.ts`) returns a port that never calls Google UMP and never shows Apple's tracking prompt when `adsMode` is `off`, and the AdMob consent adapter otherwise.

The ports reach screens through React Context, created once when the Shell app is created: `createAdsPort(readAdsExtra(), (error) => { errorLog.record('ads', error); })` and `createConsentPort(readAdsExtra().adsMode, { onError })`.

## SKAdNetwork identifiers and the refresh script

Google publishes the SKAdNetwork IDs of itself and its third-party buyers; the plugin copies whatever list it gets into `Info.plist`. The list is a generated TypeScript module, `packages/shell/src/config/skadnetwork-ids.ts` (TypeScript, not JSON, so `app.config.ts` can import it under Node type stripping without import attributes).

- Every entry is the full identifier, `^[a-z0-9]{10}\.skadnetwork$` (for example `cstr6suwn9.skadnetwork`). A list without the `.skadnetwork` suffix produces an `Info.plist` Apple does not recognise; the checker rejects it.
- On 2026-09-26 Google's AdMob iOS quick-start page listed 50 unique IDs, `cstr6suwn9.skadnetwork` first; the third-party list page had the same 50. The template holds that list.
- No separate `AdNetworkIdentifiers` (AdAttributionKit) key is needed: Apple states that `.skadnetwork` IDs work for both.
- `templates/packages/tooling/src/ads/refresh-skadnetwork.ts` rewrites the file from `https://developers.google.com/admob/ios/quick-start`; `--check` exits 1 when the committed list is stale. It refuses to overwrite when the page yields fewer than 40 IDs or does not start with `cstr6suwn9.skadnetwork`. Developer tooling may use the network; the app never does (spec N3 covers the app bundle, not `packages/tooling`).
- Run `node packages/tooling/src/ads/refresh-skadnetwork.ts --check` before every release (wire it into the release script). After a refresh: `npx expo prebuild --platform ios --clean`, rebuild, and commit the generated file with the release.

## Lint guards already in the repo config

The repo's `eslint.config.mjs` already holds the import rules; do not add copies:

- `VENDOR_SDK_PATHS` bans `react-native-google-mobile-ads` (message: use AdsPort/ConsentPort), `expo-network` and `expo-tracking-transparency` (ConsentPort) in all runtime code (`no-restricted-imports`).
- The `ADAPTERS` block (files matching `packages/shell/src/services/*/*-adapter.ts`) lifts that ban, which covers `admob-ads-adapter.ts`, `admob-consent-adapter.ts`, the test-only `admob-consent-debug-adapter.ts` and `expo-network-connectivity-adapter.ts`.
- `expo-tracking-transparency` is no longer a banned package (owner decision O1 reversed the old "no ATT prompt in v1"); `check-ads.mjs` rule `att-adapter-only` allows it in `admob-consent-adapter.ts` alone.
- The `__mocks__/**` block exempts the root mock from `import/no-default-export`.

The lint rule allows any `*-adapter.ts` to import the SDK; `check-ads.mjs` is stricter and allows only the three named files and only the SDK names each one needs, and only the consent adapter with only the permission calls for `expo-tracking-transparency`.

## Re-verify after an upgrade

1. `npm view react-native-google-mobile-ads version time --json` (a new version must be at least 7 days old), read its release notes and its shipped `AGENTS.md`.
2. Rerun the Jest suites listed in `references/ad-policy.md` and `references/consent-flow.md`, and the simulator smoke test in `references/console-privacy-troubleshooting.md`.
3. Update the root mock `__mocks__/react-native-google-mobile-ads.ts` and this skill's stand-in `scripts/lib/stubs/react-native-google-mobile-ads.mjs` when the library's surface, event names or `TestIds` change. Re-read how `show()` and a failed presentation are reported (the adapter relies on `ERROR` with phase `show` settling the show).
4. Rerun the privacy-manifest audit (the pod manifests change with the SDK).
5. On an `expo-tracking-transparency` upgrade (it follows the Expo SDK): re-read how its `TrackingTransparencyPermissionRequester.swift` maps restricted and denied, update the root mock and `scripts/lib/stubs/expo-tracking-transparency.mjs`, and rerun the ATT smoke test.
