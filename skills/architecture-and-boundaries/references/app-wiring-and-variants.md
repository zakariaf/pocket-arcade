# Wiring a game app: game.config.ts, withShell, the entry, build variants

How one game becomes one Expo app: every per-game value in `game.config.ts`, `app.config.ts` as one `withShell` statement, the 3-line `index.ts`, how runtime configuration reaches the app through `expo.extra`, local config plugins, and the build variants that decide what a build contains. Read this when creating or changing an app's wiring files, the config composer, or anything variant-dependent.

## Contents

- The wiring rules
- game.config.ts and the GameConfig type
- app.config.ts
- index.ts and src/index.ts
- What withShell does
- The Android block
- Runtime configuration: expo.extra.game
- Local config plugins
- Build variants
- Stripping test-only code from store bundles
- metro.config.js

## The wiring rules

1. Every per-game value lives in `apps/<game-id>/game.config.ts` (typed `GameConfig`, spec 11). App code never imports it: `withShell` embeds the runtime subset as `expo.extra.game`, read by `read-game-extra.ts` (`check-layout.mjs` rule `game-config-use`).
2. Never put `null` into `expo.extra`; omit the key instead. Verified: `null` values arrived as `{}` both in `npx expo config --json` and in the embedded app config read by `expo-constants` on the simulator, which made a strict parser throw at launch.
3. `app.config.ts` is one statement: `export default withShell(gameConfig, process.env);`. Every native setting comes from `withShell` and config plugins; local plugins live in `packages/shell/plugins/`, are referenced by path string and default-export the plugin. Expo applies path-referenced plugins with its own internals (a function plugin applied inside `withShell` failed: "`_internal.projectRoot` isn't defined", verified) (`app-config`).
4. `apps/<game-id>/index.ts` is the 3-line entry: import `startShell`, import the module, call `startShell(module)`. The polyfills and the direction check run before anything else, inside the Shell (`app-entry`).
5. Build variants: `APP_VARIANT` (`test|store`) with `EXPO_PUBLIC_APP_VARIANT`, `ADS_MODE` (`off|test|live`); test-only code is reachable only through `packages/shell/src/app/test-only.ts`; each app's `metro.config.js` keys Metro's cache on the variant (`metro-cache`, `test-only-gate`).
6. `npx expo config --json`, `npx expo install --check` and `npx expo-doctor` pass for every app and variant.

## game.config.ts and the GameConfig type

`templates/game.config.ts` is the starting point; `examples/game-config.ts` is a complete one. The type lives in the neutral file `packages/shell/src/config/game-config.ts` (Node reads it through `app.config.ts`, the app program reads it for types):

```ts
// packages/shell/src/config/game-config.ts
// Neutral file: read by Node (app.config.ts) and by the app program; types only.
import type { AdmobGameIds } from './ads-config.ts';

export type LanguageCode = 'en' | 'de' | 'fa' | 'ckb';

/** An ASC `ageRatingDeclarations` value; the API lists both the old and the new scale. */
export type AgeRatingLevel =
  'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE' | 'INFREQUENT' | 'FREQUENT';

/** App Store Connect age-rating answers, keyed by ASC attribute name (store step). */
export type AgeRatingAnswers = Readonly<Record<string, AgeRatingLevel | boolean>>;

/** Spec section 11: ONE file per game, apps/<game>/game.config.ts. */
export type GameConfig = {
  /** kebab-case; equals GameModule.identity.id and the apps/<id> folder. */
  readonly id: string;
  readonly appName: Readonly<Record<LanguageCode, string>>;
  /** Same id on iOS and Android: ^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$ */
  readonly bundleId: string;
  /** Numeric Apple ID of the App Store Connect record (rate link); null until created. */
  readonly appStoreId: string | null;
  /** Marketing version, semver. */
  readonly version: string;
  /** Monotonic integer; CFBundleVersion and versionCode. Bumped by release:ios. */
  readonly buildNumber: number;
  readonly premium: {
    readonly productId: string;
    /** Human note only; prices live in the store consoles. */
    readonly priceNote: string;
  };
  /** Spec 8.8 + 4.3; field meanings in the admob-ads skill. */
  readonly ads: {
    readonly isEnabled: boolean;
    readonly policy: {
      readonly minLevelsCompletedBeforeFirst: number;
      readonly minMsBetweenInterstitials: number;
      readonly minLevelsCompletedBetween: number;
    };
    readonly ids: AdmobGameIds;
  };
  readonly modes: { readonly daily: boolean; readonly endless: boolean };
  /** Must match GameModule.levels.packs (a contract test checks it). */
  readonly levels: { readonly packCount: number; readonly levelsPerPack: number };
  readonly hints: { readonly freePerDay: number };
  readonly isContinueAllowed: boolean;
  /** No URL literals in app code (N3 lint): external-links.ts builds https://<host><path>. */
  readonly links: {
    readonly privacyPolicy: { readonly host: string; readonly path: string };
    readonly supportEmail: string;
  };
  readonly store: {
    readonly audience: 'general' | 'children';
    readonly ageRating: AgeRatingAnswers;
  };
};
```

Spec 11 → field: app name per language → `appName`; store id / bundle id → `bundleId` (always `io.applander.<game id without hyphens>`, all lowercase: owner decision O4, 2026-09-30; Line Siege is `io.applander.linesiege`, and the same id is the Android package), `appStoreId`; version → `version`, `buildNumber`; Premium product id and price note → `premium` (`productId` is `<bundleId>.premium`, for example `io.applander.linesiege.premium`; the price is the EUR 1.99 App Store price point, owner decision O2, and the app always shows the store's localised price, never the note); AdMob app and unit IDs per platform → `ads.ids` (test IDs are chosen by `ADS_MODE`, never written here); frequency numbers and the master switch → `ads.policy`, `ads.isEnabled`; modes, packs and level counts → `modes`, `levels`; free hints per day → `hints.freePerDay`; continue allowed → `isContinueAllowed`; privacy policy link and support email → `links`; age rating answers and target audience → `store`.

The privacy link is stored as host + path because app-bundle files may not contain `https://` literals; the one allowlisted file `packages/shell/src/config/external-links.ts` composes the URL. `ageRating` uses App Store Connect's `ageRatingDeclarations` attribute names (`advertising` is `true` for every game with ads). The `fa` and `ckb` display names need the native-speaker review.

## app.config.ts

```ts
// apps/line-siege/app.config.ts
import { withShell } from '@e07/shell/config/with-shell.ts';

import { gameConfig } from './game.config.ts';

export default withShell(gameConfig, process.env);
```

- The explicit `.ts` extensions are required: Expo loads this file and Node type-strips everything it imports (`./game.config` without the extension fails with "Cannot find module"; with `NODE_OPTIONS=--no-strip-types` it fails with "Unexpected token '{'", both verified). Hence `engines.node >=22.18`.
- `export default` is the tool-demanded exception to the named-exports rule.
- `process.env` is passed in so `withShell` is a pure function a test can call with a plain object.

## index.ts and src/index.ts

```ts
// apps/line-siege/index.ts
import { startShell } from '@e07/shell/app/start-shell.ts';

import { lineSiegeGame } from './src/index.ts';
startShell(lineSiegeGame);
```

Three statements; the blank line is required by `import/order` (verified: without it ESLint fails). `startShell` runs the Intl polyfills first, the direction check second, then `createShellApp`. The "3 lines" hold only because `startShell` takes the module alone and the runtime config arrives through `extra`: any future need to pass `game.config.ts` values at runtime goes through `extra`, not another statement.

`src/index.ts` exports the module: `examples/line-siege-module.ts` is the shape (assembly only, no logic). The game's type bag is `src/<game-id>-types.ts` (`templates/game-types.ts`).

## What withShell does

`withShell(gameConfig, env)` turns one game's config and the build environment into the complete Expo config. It runs in Node (type stripping), so every file it reaches uses relative `.ts` imports, erasable syntax and no React Native.

It comes in two versions at the same path. The bootstrap's phase-0 composer (monorepo-bootstrap) has no privacy manifest, no native plugin list and no art, so the pilot app configures and prebuilds before any native module is installed. This skill's final pair, `templates/with-shell.ts` and `templates/with-shell.test.ts`, replaces it at the Shell's native step, together with `templates/shell-plugins.ts` and its test (all four go to `packages/shell/src/config/`): once every package on the plugin list is installed in every app (each skill installs its own with dependency-management), and before any `expo config`, prebuild or simulator build that needs them. Until then, `expo config` fails with "Failed to resolve plugin for module ..." for any line whose package is missing.

The swap is directed history, not a test edited to pass: the final `with-shell.test.ts` replaces the phase-0 test's probe-game assertions (the bundle id, the Android package and the `com.example.*` and hyphenated-id refusals), so `check-test-edits` reports each one as `assertion-changed` unless the commit names the change. Commit the four files (Shell step 8) with this exact trailer line in the commit's trailer paragraph, the same text monorepo-bootstrap and tdd-workflow give:

```text
Spec-Change: with-shell final composer (phase 0 placeholder replaced)
```

| Field or check | Value and why |
|---|---|
| app id check | throws unless `bundleId` is `appIdOf(game.id)` = `io.applander.<game id without hyphens>` and `premium.productId` is `<bundleId>.premium` (owner decision O4): `com.example.*` and every other placeholder fail at `expo config`, prebuild and every build |
| `resolveBuildVariant(env)` | throws on an unknown value, a mismatch between `APP_VARIANT` and `EXPO_PUBLIC_APP_VARIANT`, or a forbidden pair |
| `name`, `slug`, `version` | `appName.en`, the game id, `version` |
| `orientation: 'portrait'`, `supportsTablet: true` | portrait-first; iPad still rotates and iOS 27 makes iPhone windows resizable, so layouts never assume a size |
| `userInterfaceStyle: 'automatic'` | the blank template's `light` stops dark mode from following the phone |
| `scheme` only in test builds | debug deep links (Maestro setup) exist only where the debug handler exists |
| `ios.deploymentTarget: '16.4'` | built-in key since SDK 56 |
| `ios.appleTeamId` from `APPLE_TEAM_ID` | writes `DEVELOPMENT_TEAM`; absent for simulator builds |
| `ios.buildNumber`, `android.versionCode` | from `buildNumber` (one shared sequence for both stores) |
| `android: androidConfig(game)` | the Android block (next section): package, `versionCode`, `allowBackup: true`, the permission allowlist and `blockedPermissions`, `userInterfaceStyle: 'automatic'` |
| `ios.config.usesNonExemptEncryption: false` | skips the export-compliance question |
| `infoPlist.CADisableMinimumFrameDurationOnPhone: true` | 120 Hz on ProMotion |
| `CFBundleAllowMixedLocalizations` + `locales` | per language: the home-screen name (`CFBundleDisplayName`) and Apple's tracking prompt text (`NSUserTrackingUsageDescription`, from the Shell catalogs' `consent.tracking.usage-description` through `TRACKING_USAGE_DESCRIPTIONS`); Expo writes them into each language's `InfoPlist.strings` at prebuild |
| `privacyManifests` | aggregated required-reason APIs (`npm run audit:privacy`) |
| `updates.enabled: false` | no OTA network traffic (N3) |
| `experiments.reactCompiler: true` | the React Compiler |
| `extra.appVariant`, `extra.adsMode`, `extra.adUnits` | runtime inputs; `adsMode` is `off` when the game's ads master switch is off; `adUnits` only in live builds (absent, not `null`), per platform: `{ ios, android }`, `android` `null` until the game has Android ids (admob-ads' `adUnitsExtra`) |
| `extra.game` | the runtime subset of `GameConfig` |
| `plugins` | `['@e07/shell/plugins/with-app-variant-marker.ts', { appVariant }]`, then `...shellPlugins(game, adsMode)`, then `...androidPlugins(game)` (the backup rules, RTL support, the upload-key signing) |
| the icon and the splash | `withGameArt(config, game.id)` last: the generated icons and the `expo-splash-screen` plugin, only once `render-art.ts` has drawn the game (its grounds are in `splash-grounds.ts`, which ships empty) |

`shell-plugins.ts` is the ONE native-module plugin list; each line names the skill that owns the module:

| Line | Owner |
|---|---|
| `'expo-sqlite'` | save-persistence-and-migrations |
| `['expo-localization', { supportedLocales: { ios, android } }]` (the four languages only; never `supportsRTL`/`forcesRTL`) | i18n-strings-and-catalogs |
| `['expo-font', { fonts: FONT_FILES }]` (Lilita One, Rubik Regular and Bold, Vazirmatn Regular and Bold, from `./assets/fonts/`) | toybox-design-system |
| `'expo-iap'` (the bare string: every option adds a server or an SDK) | premium-purchase |
| `['expo-build-properties', { android: { kotlinVersion: '2.1.20' } }]` (expo-iap's Play Billing half needs React Native's Kotlin; `expo-build-properties` `~57.0.22` is installed at Android step 2) | premium-purchase |
| `['react-native-google-mobile-ads', admobPluginOptions(adsMode, game.ads.ids, SKADNETWORK_IDS)]` | admob-ads |
| `['expo-tracking-transparency', { userTrackingPermission: TRACKING_USAGE_DESCRIPTIONS.en }]` (Apple's ATT prompt, owner decision O1; in every variant, and never asked with `ADS_MODE=off`) | admob-ads |
| `AUDIO_API_PLUGIN` (no background audio, microphone, permissions or downloads) | game-audio-and-haptics |

Outside the list, `withShell` adds `ios.privacyManifests: PRIVACY_MANIFESTS` (privacy-and-network-audit) and ends with `withGameArt(config, game.id)` (code-drawn-art-and-icons). Paths in plugin options are relative to the app folder (Expo's project root): each app carries its own `assets/fonts/`, copied by the new-game scaffold. A new native module with a config plugin gets one line in `shellPlugins`, never a second list and never an edit in `ios/`; the Xcode-27 scene-support wrapper (expo-sdk-upgrade) wraps this list when it is due. `with-shell.test.ts` proves the order (marker first, then every Shell plugin, then the Android plugins), the Android block, the backup-rules and upload-signing entries, the privacy manifest, the app ids (a `com.example.*` or hyphenated bundle id and a Premium id other than `<bundleId>.premium` throw), the tracking text in all four locales, and that the icon and splash join only for a game `render-art.ts` has drawn; `shell-plugins.test.ts` proves each line and its options, the tracking entry with the catalog's en text in every ads mode included. `shell-plugins.ts` reads the four Shell catalogs with `import ... with { type: 'json' }` through `@e07/shell/i18n/catalogs/<lang>.json` (Node, Jest and Expo's config loader all accept it; verified with `npx expo config` on 2026-09-30).

## The Android block

`packages/shell/src/config/android-config.ts` (Node world, with its test) is the Android part of the composer, as `ads-config.ts` and `art-config.ts` are theirs. `withShell` sets `android: androidConfig(game)` and appends `...androidPlugins(game)` after `shellPlugins`. Nothing Android is set anywhere else: the generated `apps/<id>/android/` is never edited or committed (`check-layout` `android-committed`, `android-setting`), and Kotlin lives only in `packages/shell/android/` (`kotlin-placement`).

| Field or plugin | Value and why |
|---|---|
| `package` | `game.bundleId`, the same `io.applander.<game id without hyphens>` as iOS (owner decision O4; `appIdOf` already refused any other) |
| `versionCode` | `game.buildNumber`: one build-number sequence for both stores, so a tag `<game-id>/vX.Y.Z+<n>` never repeats |
| `allowBackup: true` | the save follows the player through Google's device backup (spec 8.6, decision D5); Expo's template default is `false` |
| `permissions` | `ANDROID_PERMISSIONS`: `INTERNET` (AdMob and Play Billing, the only network users, N3) and `VIBRATE` (haptics). The SDKs add theirs; every permission of a built APK must be on android-emulator-build's allowlist (`check-emu-app` `permission`) |
| `blockedPermissions` | `BLOCKED_ANDROID_PERMISSIONS`: the Expo template's extras (`SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`) and the ones no app may hold (microphone, camera, location, media, contacts, notifications, and the Wi-Fi details expo-network declares for `getIpAddressAsync`, which the Shell never calls), removed from the merged manifest with `tools:node="remove"` whoever adds them |
| `userInterfaceStyle: 'automatic'` | dark mode follows the phone; on Android it needs `expo-system-ui` in every app |
| `'@e07/shell/plugins/with-backup-rules.ts'` | writes `res/xml/backup_rules.xml` (`android:fullBackupContent`, Android 11 and lower) and `res/xml/data_extraction_rules.xml` (`android:dataExtractionRules`, Android 12 and later, cloud backup and device transfer), each including only `SQLite/save.db`, `SQLite/save.db-wal` and `SQLite/save.db-shm` in domain `file` (expo-sqlite 57 keeps databases in `<filesDir>/SQLite/`), and sets the three attributes on `<application>`. Everything else (consent and ad SDK state) stays out of the backup. The XML and the attributes come from `backup-rules.ts` (tested); the plugin only writes them |
| `'@e07/shell/plugins/with-rtl-support.ts'` | `android:supportsRtl="true"` on `<application>` (`rtl-support.ts`, tested): Expo's template sets it today, this keeps fa and ckb right to left if the template changes. Never expo-localization's `supportsRTL` option (rtl-and-direction) |
| `'@e07/shell/plugins/with-prepared-text-layout.ts'` | Turns on React Native's `enablePreparedTextLayout` in `MainApplication.kt` (`prepared-text-layout.ts`, tested): right after `loadReactNative(this)`, whose `DefaultNewArchitectureEntryPoint.load()` already set the stable flags (they can be set once), `ReactNativeFeatureFlags.dangerouslyForceOverride` installs `ReactNativeNewArchitectureFeatureFlagsDefaults` (what the stable set is) with this one flag on. Why: an app targeting SDK 35+ gets Android 15's compat change `USE_BOUNDS_FOR_WIDTH` (63938206), so a TextView wraps by glyph bounds while React Native 0.86 measures by advances; a Persian line whose ink overhangs its advance fits the measured box and then wraps when drawn, its last word clipped (E18-T22: S11d's software tab laid out one line, drew two; `adb -s <serial> shell am compat disable USE_BOUNDS_FOR_WIDTH <package>` drew one). The prepared layout draws the very layout React Native measured |
| `['@e07/shell/plugins/with-upload-signing.ts', { game: game.id }]` | android-release-play's plugin (it ships the plugin and `upload-signing.ts`): release builds use the game's upload key when its Gradle properties exist. Without this entry every Play bundle stays debug-signed and the store-AAB gate's `signing` rule refuses it |

Plugin paths are package paths (`@e07/shell/plugins/<file>.ts`), never `./plugins/...`: Expo resolves a plugin string from the app folder (its project root), where `./plugins/` does not exist.

The composer files change together at Android step 2 (the repo's `with-shell.ts`, `shell-plugins.ts` and their tests are replaced, and `android-config.ts`, `backup-rules.ts`, `rtl-support.ts`, `prepared-text-layout.ts` with their tests and the three plugins are added; `expo-build-properties` is installed first, or `expo config` fails to resolve its line). Two existing expectations grow by the Android lines: the plugin order in `with-shell.test.ts` and the module list in `shell-plugins.test.ts`, so `check-test-edits` reports them as `assertion-changed` unless the commit carries the directed trailer git-commits-and-reporting names for Android step 2. Proven on Expo's mod compiler (introspect mode on the template manifest, and a real run on a throwaway project): the application gets `allowBackup="true"`, `supportsRtl="true"`, `fullBackupContent="@xml/backup_rules"`, `dataExtractionRules="@xml/data_extraction_rules"` and the `E07AppVariant` meta-data, and both XML files are written.

## Runtime configuration: expo.extra.game

`packages/shell/src/config/game-extra.ts` (Node side, neutral) defines `GameExtra` and `toGameExtra(game)`: `id`, `appStoreId` (only when set), `premiumProductId`, `adPolicy` (`isAdsEnabled` + the policy numbers), `modes`, `levels`, `hints`, `isContinueAllowed`, `links`. JSON only, and no nulls: an absent value is an absent key.

`packages/shell/src/app/read-game-extra.ts` parses it with valibot from `Constants.expoConfig?.extra` and **throws** on a mismatch on purpose: it runs once at startup (`createDeviceAdapters()` in game-host-integration's composition root), so a composer bug fails the first simulator launch and the E2E smoke run, never silently in the field. It imports only the `GameExtra` type from the neutral file.

## Local config plugins

A local plugin is an ESM TypeScript file in `packages/shell/plugins/`, named `with-<capability>.ts`, with a default export, referenced from `withShell` by its package path (`templates/with-app-variant-marker.ts` is the shape to copy). Runtime imports from Expo use `expo/config-plugins.js`: the `expo` package has no `exports` map, so the bare `expo/config-plugins` does not resolve from ESM (`ERR_MODULE_NOT_FOUND`, verified). Tag the default export `/** @public ... */` so knip keeps it.

`with-app-variant-marker.ts` writes `E07AppVariant` into Info.plist and, on Android, as `<meta-data android:name="E07AppVariant" android:value="test|store">` under `<application>`: a second, native-side signal for the store-artifact gates. On iOS `plutil -extract E07AppVariant raw <App>.app/Info.plist` must print `store`; on Android android-emulator-build's `check-emu-app` rule `variant` reads the meta-data from the APK.

The Android plugins follow the same shape: `with-backup-rules.ts` and `with-rtl-support.ts` (this skill) and `with-upload-signing.ts` (android-release-play). Each keeps its logic in a tested module under `packages/shell/src/config/` (`backup-rules.ts`, `rtl-support.ts`, `upload-signing.ts`), because Jest runs only `src/` tests and a `../` import from a test into `plugins/` breaks the import rules; the plugin only applies it with `withAndroidManifest` (and `withDangerousMod` to write `res/xml/` files).

## Build variants

| `APP_VARIANT` | `ADS_MODE` | Debug menu, deep links, network guard | Ad app ID / units | Where it can go |
|---|---|---|---|---|
| `test` (default) | `test` (default) | compiled in | Google sample app ID and `TestIds.*` | simulator, internal TestFlight only |
| `test` | `off` | compiled in | sample app ID, ads never initialised | screenshots, E2E, runtime network audit |
| `store` | `live` (default) | **compiled out** | the game's real IDs from `game.config.ts` | TestFlight and the App Store |
| `store` | `off` | compiled out | sample app ID in Info.plist, ads never initialised | same as above |
| `test` | `live` | — | **forbidden** (real ads in a debug build) | — |
| `store` | `test` | — | **forbidden** (test ads in a store build) | — |

- `packages/shell/src/config/app-variant.ts` (`templates/app-variant.ts`, with `templates/app-variant.test.ts`) resolves the variant from an environment snapshot and throws on an unknown value, a mismatch or a forbidden pair.
- JS reads the ads mode at runtime from `Constants.expoConfig.extra.adsMode` and the variant from the inlined `process.env.EXPO_PUBLIC_APP_VARIANT` (declared in `packages/shell/src/app-env.d.ts`; read only with dot access).
- Export `APP_VARIANT`, `EXPO_PUBLIC_APP_VARIANT` (same value) and `ADS_MODE` for the whole build run, not just for prebuild: prebuild writes Info.plist, the Xcode phase re-evaluates `app.config.ts` into `EXConstants.bundle/app.config`, and Metro inlines `EXPO_PUBLIC_APP_VARIANT` later. `app.config.ts` cannot set `EXPO_PUBLIC_APP_VARIANT` for Metro, so the scripts export both and `resolveBuildVariant` throws when they differ. The ios-simulator-build and ios-release-testflight skills own the build commands.

## Stripping test-only code from store bundles

Metro inlines `process.env.EXPO_PUBLIC_*` during the transform, folds constant conditions, and only then collects `require` dependencies, so a `require` in a branch that folds to false never enters the bundle. That happens only when the comparison is **in the same expression**. Verified: the store bundle kept the test-only module when the gate was an imported constant, and dropped it with the inline comparison.

```ts
// packages/shell/src/app/test-only.ts
// The ONLY file allowed to require() test-only code (ESLint file-level exemption).
// The gate must be this literal comparison: an imported constant does not strip code.
import type { TestOnlyApi } from './test-only-api.ts';

export const TEST_ONLY: TestOnlyApi | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'store'
    ? null
    : (require('./test-only-entry.ts') as TestOnlyApi);
```

- `test-only-entry.ts` exports everything test-only (debug screens, the deep-link handler, the JS network guard, the StoreKit harness hooks, the parity harness, the performance tools) plus the sentinel `TEST_BUILD_SENTINEL = 'SHELL_TEST_BUILD_ONLY'` that the store-artifact gate greps for; `test-only-api.ts` is its type, `TestOnlyApi`, with one member per export.
- The pair is one shared file set (this skill's `templates/test-only-api.ts` and `templates/test-only-entry.ts`, the same bytes the simulator-build and parity skills ship). A member joins when the file behind it exists: the gate and the pair arrive at Shell step 6, where the pair holds only `TEST_BUILD_SENTINEL` (the Shell core's members join at step 7, where `hydrate-save.ts` is the first save file that imports the gate), so `test-only.ts` compiles without the debug kit, the parity harness or the perf log, and the save layer of step 4 needs none of them; `DebugScreen` stays out while S15 is outside `shell-slice.json`. Trim the copied pair to those members; never remove the sentinel. The members are `DebugScreen`, the simulated clock and connectivity, the debug store, services, link handler and network guard (e2e-maestro), the parity harness (`readParityRequest` ... `parityFrameState`, `isParityMotionFrozen`, `isParityBoardProbeOn`, `parityGameFixture`; toybox-visual-parity) and `createPerfLog` (performance-budgets).
- Callers use `TEST_ONLY?.parityFrameState()` and similar. `IS_TEST_BUILD`-style constants may drive *behaviour*, never *inclusion*.
- Code that `test-only-entry.ts` reaches (the debug screen and its model, the parity harness, the perf tools) is test-only itself and never sits in a store bundle, so it imports a member straight from that member's own file (`parityFrameState` from `app/parity/parity-session.ts`) and never `app/test-only.ts` or a helper that imports it (`use-parity-opener.ts`, `use-reduce-motion.ts`): the gate's `require()` of the entry would close an import loop, which `check-boundaries.mjs` reports as `import-cycle` ("import cycle through the test-only gate"). `use-reduce-motion-setting.ts` (the saved choice, without the parity freeze) exists apart from `use-reduce-motion.ts` for this reason. The S15 debug model's parity opener for `'debug-ads-always-test'` therefore reads `parityFrameState()` from the parity session file and opens the state once on mount through the switch's own handler; screens outside the entry keep `useParityOpener`.
- It lives in `src/app/` (app code), not in the Node-world `src/config/`. The ESLint config carries its one exemption (`@typescript-eslint/no-require-imports`).
- `check-boundaries.mjs` (`test-only-gate`) reports `require()` anywhere else in app code, a direct import of `test-only-entry.ts`, and a gate that is not the literal comparison.

## metro.config.js

```js
// apps/line-siege/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// EXPO_PUBLIC_* values are inlined at transform time but are NOT part of Metro's cache key.
// Keying the cache on the variant stops a store build from reusing test-build transforms.
config.cacheVersion = `app-variant-${process.env.EXPO_PUBLIC_APP_VARIANT ?? 'test'}`;

module.exports = config;
```

Verified twice: without the cache key, a store export made after a test export shipped the debug menu. This is JavaScript because Metro loads it directly (a tool-demanded exception like `babel.config.js`); `npx expo-doctor` still passes 21/21. The Metro cache lives in `$TMPDIR/metro-cache` and is shared by every project on the Mac. Every app has the file; the new-game scaffold copies `templates/metro.config.js`.
