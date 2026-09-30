# Wiring a game app: game.config.ts, withShell, the entry, build variants

How one game becomes one Expo app: every per-game value in `game.config.ts`, `app.config.ts` as one `withShell` statement, the 3-line `index.ts`, how runtime configuration reaches the app through `expo.extra`, local config plugins, and the build variants that decide what a build contains. Read this when creating or changing an app's wiring files, the config composer, or anything variant-dependent.

## Contents

- The wiring rules
- game.config.ts and the GameConfig type
- app.config.ts
- index.ts and src/index.ts
- What withShell does
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

Spec 11 → field: app name per language → `appName`; store id / bundle id → `bundleId`, `appStoreId`; version → `version`, `buildNumber`; Premium product id and price note → `premium`; AdMob app and unit IDs per platform → `ads.ids` (test IDs are chosen by `ADS_MODE`, never written here); frequency numbers and the master switch → `ads.policy`, `ads.isEnabled`; modes, packs and level counts → `modes`, `levels`; free hints per day → `hints.freePerDay`; continue allowed → `isContinueAllowed`; privacy policy link and support email → `links`; age rating answers and target audience → `store`.

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

| Field or check | Value and why |
|---|---|
| bundle id check | throws unless `bundleId` matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$` |
| `resolveBuildVariant(env)` | throws on an unknown value, a mismatch between `APP_VARIANT` and `EXPO_PUBLIC_APP_VARIANT`, or a forbidden pair |
| `name`, `slug`, `version` | `appName.en`, the game id, `version` |
| `orientation: 'portrait'`, `supportsTablet: true` | portrait-first; iPad still rotates and iOS 27 makes iPhone windows resizable, so layouts never assume a size |
| `userInterfaceStyle: 'automatic'` | the blank template's `light` stops dark mode from following the phone |
| `scheme` only in test builds | debug deep links (Maestro setup) exist only where the debug handler exists |
| `ios.deploymentTarget: '16.4'` | built-in key since SDK 56 |
| `ios.appleTeamId` from `APPLE_TEAM_ID` | writes `DEVELOPMENT_TEAM`; absent for simulator builds |
| `ios.buildNumber`, `android.versionCode` | from `buildNumber` |
| `ios.config.usesNonExemptEncryption: false` | skips the export-compliance question |
| `infoPlist.CADisableMinimumFrameDurationOnPhone: true` | 120 Hz on ProMotion |
| `CFBundleAllowMixedLocalizations` + `locales` | the home-screen name per language |
| `privacyManifests` | aggregated required-reason APIs (`npm run audit:privacy`) |
| `updates.enabled: false` | no OTA network traffic (N3) |
| `experiments.reactCompiler: true` | the React Compiler |
| `extra.appVariant`, `extra.adsMode`, `extra.adUnits` | runtime inputs; `adsMode` is `off` when the game's ads master switch is off; `adUnits` only in live builds (absent, not `null`) |
| `extra.game` | the runtime subset of `GameConfig` |
| `plugins` | `['@e07/shell/plugins/with-app-variant-marker.ts', { appVariant }]`, then `...shellPlugins(game, adsMode)` |
| the icon and the splash | `withGameArt(config, game.id)` last: the generated icons and the `expo-splash-screen` plugin, only once `render-art.ts` has drawn the game (its grounds are in `splash-grounds.ts`, which ships empty) |

`shell-plugins.ts` is the ONE native-module plugin list; each line names the skill that owns the module:

| Line | Owner |
|---|---|
| `'expo-sqlite'` | save-persistence-and-migrations |
| `['expo-localization', { supportedLocales: { ios, android } }]` (the four languages only; never `supportsRTL`/`forcesRTL`) | i18n-strings-and-catalogs |
| `['expo-font', { fonts: FONT_FILES }]` (Lilita One, Rubik Regular and Bold, Vazirmatn Regular and Bold, from `./assets/fonts/`) | toybox-design-system |
| `'expo-iap'` (the bare string: every option adds a server or an SDK) | premium-purchase |
| `['react-native-google-mobile-ads', admobPluginOptions(adsMode, game.ads.ids, SKADNETWORK_IDS)]` | admob-ads |
| `AUDIO_API_PLUGIN` (no background audio, microphone, permissions or downloads) | game-audio-and-haptics |

Outside the list, `withShell` adds `ios.privacyManifests: PRIVACY_MANIFESTS` (privacy-and-network-audit) and ends with `withGameArt(config, game.id)` (code-drawn-art-and-icons). Paths in plugin options are relative to the app folder (Expo's project root): each app carries its own `assets/fonts/`, copied by the new-game scaffold. A new native module with a config plugin gets one line in `shellPlugins`, never a second list and never an edit in `ios/`; the Xcode-27 scene-support wrapper (expo-sdk-upgrade) wraps this list when it is due. `with-shell.test.ts` proves the order (marker first, then every Shell plugin), the privacy manifest, and that the icon and splash join only for a game `render-art.ts` has drawn; `shell-plugins.test.ts` proves each line and its options.

## Runtime configuration: expo.extra.game

`packages/shell/src/config/game-extra.ts` (Node side, neutral) defines `GameExtra` and `toGameExtra(game)`: `id`, `appStoreId` (only when set), `premiumProductId`, `adPolicy` (`isAdsEnabled` + the policy numbers), `modes`, `levels`, `hints`, `isContinueAllowed`, `links`. JSON only, and no nulls: an absent value is an absent key.

`packages/shell/src/app/read-game-extra.ts` parses it with valibot from `Constants.expoConfig?.extra` and **throws** on a mismatch on purpose: it runs once at startup (`createDeviceAdapters()` in game-host-integration's composition root), so a composer bug fails the first simulator launch and the E2E smoke run, never silently in the field. It imports only the `GameExtra` type from the neutral file.

## Local config plugins

A local plugin is an ESM TypeScript file in `packages/shell/plugins/`, named `with-<capability>.ts`, with a default export, referenced from `withShell` by its package path (`templates/with-app-variant-marker.ts` is the shape to copy). Runtime imports from Expo use `expo/config-plugins.js`: the `expo` package has no `exports` map, so the bare `expo/config-plugins` does not resolve from ESM (`ERR_MODULE_NOT_FOUND`, verified). Tag the default export `/** @public ... */` so knip keeps it.

`with-app-variant-marker.ts` writes `E07AppVariant` into Info.plist, a second, native-side signal for the store-artifact gate: `plutil -extract E07AppVariant raw <App>.app/Info.plist` must print `store`.

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
- The pair is one shared file set (this skill's `templates/test-only-api.ts` and `templates/test-only-entry.ts`, the same bytes the simulator-build and parity skills ship). A member joins when the file behind it exists: at Shell steps 4 to 7 the pair holds only `TEST_BUILD_SENTINEL`, so `test-only.ts` compiles from step 4 (the save layer's step) without the debug kit, the parity harness or the perf log; `DebugScreen` stays out while S15 is outside `shell-slice.json`. Trim the copied pair to those members; never remove the sentinel. The members are `DebugScreen`, the simulated clock and connectivity, the debug store, services, link handler and network guard (e2e-maestro), the parity harness (`readParityRequest` ... `parityFrameState`, `isParityMotionFrozen`, `isParityBoardProbeOn`, `parityGameFixture`; toybox-visual-parity) and `createPerfLog` (performance-budgets).
- Callers use `TEST_ONLY?.parityFrameState()` and similar. `IS_TEST_BUILD`-style constants may drive *behaviour*, never *inclusion*.
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
