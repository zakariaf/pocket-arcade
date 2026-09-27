# 01 · Stack and versions

> **What this doc decides.** The technology stack of the Shell and every game app (Expo SDK 57 on React Native 0.86.3, no game engine, no server, no EAS), recorded as short ADRs. It also sets the exact version of every dependency and how that version is pinned and installed, the rules for upgrading (SDK cadence, the SDK 58 trigger, Xcode 27), the dependency-freshness policy (`min-release-age=7`), and the list of banned packages.
> **Binding source:** [99-final-decisions.md](99-final-decisions.md) (2026-09-26). This doc restates those decisions with versions and procedures and does not change them. The problems found while writing it are listed under [Open issues](#open-issues).
> **Related docs:** [02-architecture-and-folders.md](02-architecture-and-folders.md) (workspace layout), [04-code-style-and-limits.md](04-code-style-and-limits.md) (lint and TypeScript config), [13-privacy-network-security.md](13-privacy-network-security.md) (banned packages in the network audit), [14-ios-build-and-release.md](14-ios-build-and-release.md) (Xcode, signing and release), [16-quality-gates-hooks-ci.md](16-quality-gates-hooks-ci.md) (the dependency gate in verify). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

---

## 1. Introduction

Claude Code builds this codebase alone, so the stack has to stay stable, current and checkable by machine. Three facts shape every rule below:

1. **Training data is stale.** On 2026-09-26 npm already carries React Native 0.87.1, TypeScript 7.0.2, ESLint 10.11.0, Jest 30.5.2 and Skia 2.13.0. None of them is right for this project. The table in section 3.2 is the source of truth. Memory is not.
2. **Expo pins a tested set of native module versions per SDK.** The pinned set lives in `bundledNativeModules.json` and in the "related packages" of the versions API. `npx expo install` applies it, and `npx expo install --check` verifies it. Any package outside that set is our responsibility, so it gets an exact version.
3. **The app must never reach the network through our own code (spec N1–N3).** Some packages add a server, telemetry or a network probe. Those are banned outright (section 3.6) and the ban is checked on every `npm run audit:network`.

This doc covers what we use and at which version. How each piece is used belongs to the topic docs (navigation, persistence, game engine, services, i18n, quality, release). The release pipeline is in `docs/14-ios-build-and-release.md`.

---

## 2. Rules

Each rule is imperative and can be tested. "Why" gives the reason in one line, and **Source** points to the evidence for any external fact.

1. **Use exactly the versions in [the versions table](#32-versions-table).** Change a version only through the procedures in sections 3.4 and 3.5. The same commit updates the table and the [Verified](#verified) section.
   *Why:* one written truth stops agents from "upgrading" to npm `latest`, which on 2026-09-26 is the wrong major for several of our packages.
2. **Install app runtime packages that are in Expo's SDK 57 module map only with `npx expo install <pkg>`, run inside `apps/<game>/`, and keep the specifier it writes (`~x.y.z` or exact).** The dev tools Expo also versions are root dev dependencies: `typescript`, `jest`, `@types/jest` and `@types/react` (the versions API's "related packages"), and `jest-expo` and `eslint-config-expo` (in the module map). Install them with npm at the exact version in the table, which lies inside Expo's range.
   *Why:* Expo tests one coherent set of native versions per SDK, and `expo install` resolves that set. **Source:** [bundledNativeModules.json (sdk-57)](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json), [api.expo.dev versions](https://api.expo.dev/v2/versions/latest).
3. **Pin every other package to an exact version.** The root `.npmrc` sets `save-exact=true`, so plain `npm install <pkg>` writes `1.2.3` and never `^1.2.3`. Pre-1.0 packages and packages that wrap a native SDK (AdMob, StoreKit, audio) are always exact.
   *Why:* patch releases of native wrappers change native binaries. An exact pin turns every change into a deliberate, reviewed commit (FINAL A.43).
4. **Commit `package-lock.json`, install fresh clones with `npm ci`, and never delete the lockfile to "fix" an install.**
   *Why:* the lockfile is what makes 26 apps build identically. `npm ci` installs exactly what it lists, and `min-release-age` cannot silently change it (verified, section 3.4).
5. **Keep `min-release-age=7` in the root `.npmrc`.** Put every exception in a dated block (`# exclude-block expires=YYYY-MM-DD reason=…`). `npm run verify` fails on an exclude that is undated or expired.
   *Why:* a 7-day wait lets most malicious or broken releases be pulled before we adopt them. **Source:** [npm config: min-release-age](https://docs.npmjs.com/cli/v11/using-npm/config#min-release-age).
6. **Keep every app on the same Expo SDK and the same version of every shared package (lockstep).** A check in `npm run verify` compares all `apps/*/package.json`.
   *Why:* "Duplicate React Native versions in a single monorepo are not supported." **Source:** [Expo monorepos guide](https://docs.expo.dev/guides/monorepos/).
7. **Never add a package from the [banned list](#36-banned-packages).** `npm run audit:network` fails if one appears anywhere in `package-lock.json` (for HTTP clients: as a direct dependency).
   *Why:* each banned package adds a server, telemetry or network probe, or duplicates a decided stack piece.
8. **`npx expo install --check` and `npx expo-doctor` must pass in every app and run inside `npm run verify`.**
   *Why:* they detect SDK/version drift that TypeScript and Jest cannot see. **Source:** [Expo CLI: install](https://docs.expo.dev/more/expo-cli/#install).
9. **Stay on Expo SDK 57 until SDK 58 is stable, at least 7 days old, and the full suite (verify, simulator builds, E2E, screenshot diffs) is green for every app.** Do not wait for Xcode 27: SDK 58 needs Xcode 26.4 or newer.
   *Why:* FINAL A.1. **Source:** [Expo SDK version table](https://docs.expo.dev/versions/v58.0.0/) (SDK 58: iOS 16.4+, Xcode 26.4+).
10. **Build with Xcode 26.6. If Xcode 27 is ever used with SDK 57, set `expo-build-properties` → `ios.enableSceneSupport: true` first** (requires `expo` ≥ 57.0.23).
    *Why:* apps built with the iOS 27 SDK that still use the application life cycle do not launch correctly on iOS 27. **Source:** [expo/fyi ios-scene-lifecycle](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md#staying-on-sdk-57-with-xcode-27).
11. **Pin Node 26.4.0 in `.mise.toml` and `.nvmrc`.** Set `engines` to `{"node": ">=22.18", "npm": ">=11.17.0"}` and `engine-strict=true`.
    *Why:* `app.config.ts` relies on Node's built-in type stripping, which is on by default from 22.18. `min-release-age-exclude` (the dated exception blocks) first ships in npm 11.17.0 (`min-release-age` itself is older; verified in the npm 11.10, 11.16 and 11.17 docs). Without `engine-strict`, an older npm ignores the lines it does not know: before 11.17 the excludes (so the bootstrap install fails with `ETARGET`), and in older releases the age policy itself. **Source:** [Node 22.18.0 release](https://nodejs.org/en/blog/release/v22.18.0), [npm config](https://docs.npmjs.com/cli/v11/using-npm/config).
12. **Approve install scripts one package at a time (`npm approve-scripts <pkg>`), commit the `allowScripts` field, and let `npm run verify` fail while any script is pending.**
    *Why:* npm 11.17 says "A future release will block unreviewed install scripts". **Source:** [npm approve-scripts](https://docs.npmjs.com/cli/v11/commands/npm-approve-scripts).
13. **Before writing code against a library API, read that library's versioned docs, never memory.** For Expo that means `https://docs.expo.dev/versions/v57.0.0/` or `https://docs.expo.dev/llms.txt`. Add `.md` to any Expo docs URL to get plain text.
    *Why:* Expo, React Native and TypeScript have moved past the training data (RN 0.87, TS 7, SDK 58 beta).
14. **Do not move to ESLint 10, Jest 30, TypeScript 7, React Navigation 8, Gesture Handler 3 or `react-native` 0.87+ ahead of the triggers in [section 3.5](#35-upgrade-policy).**
    *Why:* each one breaks a verified part of the stack (reasons in the ADRs).

---

## 3. Details

### 3.1 Architecture decision records

Each ADR restates a FINAL-DECISIONS item. Its details (APIs, code patterns) live in the topic doc named in the ADR.

#### ADR-01 · Expo SDK 57, New Architecture only, Continuous Native Generation
- **Context.** React Native recommends a framework for new apps. The Mac has Xcode 26.6. Apple requires uploads built with Xcode 26 or newer (since 2026-04-28).
- **Decision.** `expo` 57.0.25 → `react-native` 0.86.3, `react` 19.2.3, Hermes V1. The New Architecture is the only one; there is no flag. `ios/` and `android/` are gitignored and regenerated with `npx expo prebuild --platform ios --clean`. Every native change goes through `app.config.ts` and config plugins (local plugins live in `packages/shell/plugins/`).
- **Rejected.** Bare RN CLI: hand-maintained native projects and no version set. A committed `ios/`: hand edits are lost on prebuild and upgrades multiply across 26 apps. SDK 58 now: beta. Expo Go: it cannot load AdMob or IAP.
- **Consequences.** An SDK upgrade becomes a version bump plus a clean prebuild for all apps together. The agent never edits Xcode projects.

#### ADR-02 · React Compiler on
- **Context.** Hand-written `useMemo`, `useCallback` and `React.memo` are where agents make stale-closure mistakes.
- **Decision.** `experiments.reactCompiler: true`. The compiler is bundled by `babel-preset-expo` 57, so do not add `babel-plugin-react-compiler`. No manual memoisation without a measured need. `'use no memo'` is the documented escape hatch only. Reanimated shared values use `.get()`/`.set()`, never `.value`.
- **Rejected.** Compiler off with manual memoisation.
- **Consequences.** The Rules of React are lint errors (`eslint-plugin-react-hooks` 7.1.1 via `eslint-config-expo`). Workspace packages are compiled too (verified by the research team: the bundle contains `react.memo_cache_sentinel`).

#### ADR-03 · TypeScript 6.0 with strict flags
- **Context.** TS 7.0.2 has no programmatic API. typescript-eslint 8.70.1 supports TypeScript `<6.1.0`, and Expo pins `~6.0.3` for SDKs 57 and 58.
- **Decision.** `typescript` 6.0.3 with the full flag list from FINAL A.3 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `customConditions: ["react-native-strict-api","react-native"]`, …). TS 6 defaults `types` to `[]`, so app and test tsconfigs set `["jest"]` and the tooling tsconfig sets `["node", "jest"]`, because its tests are colocated (docs/04; with `["node"]` alone they fail with TS2593).
- **Rejected.** TS 7 (no API, lint breaks). Template-default `strict` only.
- **Consequences.** No enums (`erasableSyntaxOnly`). RN 0.87 deep-import errors already happen today, so the SDK 58 move costs no type migration.

#### ADR-04 · Navigation: React Navigation 7 static API, no Expo Router
- **Context.** The Shell is a shared package and must own navigation. Since SDK 56, Expo Router forbids importing `@react-navigation/*` in app code.
- **Decision.** `@react-navigation/native` 7.4.1 + `@react-navigation/native-stack` 7.19.2 (exact), plus `react-native-screens` and `react-native-safe-area-context` from `npx expo install`. One static native stack is defined in `packages/shell/src/navigation/`.
- **Rejected.** Expo Router (per-app route files, churn in SDK 58, `usePreventRemove` only from SDK 58). React Navigation 8 (alpha). The dynamic JSX API.
- **Consequences.** Remove `expo-router` from the template and rewrite the template's AGENTS.md, which says "Use Expo Router for all navigation".

#### ADR-05 · State: Zustand 5 plus pure reducers; games are pure TypeScript
- **Context.** Four domain stores and one game session must be testable without React (FINAL A.5).
- **Decision.** `zustand` 5.0.15 (exact), one store per domain. The logic lives in pure reducers. Game engines are pure TS (`create`, `listMoves`, `applyMove`, `outcome`, …) bound through a per-session vanilla store.
- **Rejected.** Redux Toolkit (ceremony), Jotai 3 (new major), XState (a second paradigm), Context-only (re-renders, unreachable outside React).
- **Consequences.** Selectors return primitives or use `useShallow`, otherwise Zustand v5 throws "Maximum update depth exceeded".

#### ADR-06 · Persistence: expo-sqlite synchronous API
- **Context.** Spec 8.6 and N10: save after every move, survive a kill and every update, recover a damaged save.
- **Decision.** `expo-sqlite` 57.0.3 with WAL, `synchronous = FULL`, and one versioned JSON document in `save_slots('current'|'backup')` behind `SaveStore` + `SqlDriver`, validated with `valibot` 1.5.0 on every load and before every write. Jest runs the real SQL on Node 26's `node:sqlite`. Details: [06-navigation-state-persistence.md](06-navigation-state-persistence.md).
- **Rejected.** MMKV (Nitro, outside the Expo map), JSON files (non-atomic writes in the SDK 57 source), AsyncStorage (async, no transactions).
- **Consequences.** A crash-safe "save after every move" costs no extra dependency.

#### ADR-07 · Styling and RTL: StyleSheet, typed theme, logical properties
- **Context.** Spec N11 bans left/right in layout code, and two of the four languages are right-to-left.
- **Decision.** Plain `StyleSheet` and a typed theme. Only logical properties are used. Direction is owned by the Shell: `I18nManager.allowRTL/forceRTL` plus `reloadAppAsync()` from `expo`, never from `expo-updates`.
- **Rejected.** Unistyles 3 (Nitro), NativeWind 4 (Tailwind 3 with v5 pending), Tamagui (compiler).
- **Consequences.** Zero styling dependencies. The ESLint rules enforce N11.

#### ADR-08 · One npm-workspaces monorepo on Node 26
- **Context.** About 26 apps share one Shell (N5), and Expo supports npm-workspace monorepos.
- **Decision.** npm 11 workspaces with `apps/*` (one Expo app per game) and `packages/{shell,game-kit,tooling}`, consumed as TypeScript source. Node 26.4.0 is pinned. `app.config.ts` imports `@e07/shell/config/with-shell.ts` and `./game.config.ts` with explicit `.ts` extensions (verified; without the extension Expo fails with "Cannot find module").
- **Rejected.** One copy of the Shell per game (26 forks drift), a versioned package registry (needs a hosted service), pnpm/yarn/bun (not installed on this Mac, and npm 11 workspaces are enough; Expo supports isolated installs since SDK 54 but still warns that duplicate native packages break builds).
- **Consequences.** A Shell fix reaches every game, and one SDK upgrade serves all 26 apps. Every app must pass before any app ships.

#### ADR-09 · Game rendering: no engine, Skia + Reanimated 4 + Gesture Handler
- **Context.** The catalogue is small 2D board and puzzle games; about 24 of 26 are turn-based (FINAL B.12).
- **Decision.** `@shopify/react-native-skia` 2.6.2, `react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1, `react-native-gesture-handler` 2.32.x (all through `npx expo install`), plus an in-house kit in `packages/game-kit` and `packages/shell/src/game-host`. A determinism policy bans transcendental `Math.*`, `Math.random` and wall-clock reads in rules and simulation code.
- **Rejected.** react-native-game-engine (last published 2020), expo-pixi (2022), Godot and Unity embeds (little adoption, huge binaries), physics engines (no game in the catalogue needs rigid bodies; planck 1.5.0 is the fallback only).
- **Consequences.** See the [owner section](#38-for-the-owner-engine-or-library) and [08-game-engine.md](08-game-engine.md).

#### ADR-10 · Sound and haptics
- **Context.** Spec 8.7 and N9: sounds made in code that follow the silent switch and never play over the player's music.
- **Decision.** `react-native-audio-api` **0.13.6 exact** (pre-1.0, not in Expo's map). Sound effects are synthesised in code. The plugin runs with `iosBackgroundMode: false`, `androidPermissions: []`, `androidForegroundService: false`, `disableFFmpeg: true` and `disableStaticExternalLibs: true` (FINAL B.20; option names checked in the 0.13.6 plugin source). Music is off by default. Haptics use `expo-haptics` 57.0.3.
- **Rejected.** `expo-audio`, whose plugin adds `NSMicrophoneUsageDescription` and background audio by default (see the banned list).
- **Consequences.** Watch the first TestFlight upload for ITMS-90683 (microphone purpose string). The playbook is in doc 14.

#### ADR-11 · Ads: react-native-google-mobile-ads 17 with Google UMP; no ATT
- **Context.** Spec 8.8 and section 4: AdMob with Google's consent message, and no server of ours.
- **Decision.** `react-native-google-mobile-ads` **17.2.0 exact** (iOS pods Google-Mobile-Ads-SDK 13.6.0 and GoogleUserMessagingPlatform 3.1.0). The rollback target is 16.5.0. It is configured only through its config plugin, and only `admob-ads-adapter.ts` imports it.
- **Rejected.** Firebase-based setups (a backend), and asking for tracking (ATT) in v1 (decision D4).
- **Consequences.** 17.2.0 was 1 day old on 2026-09-26. It is installed under the dated bootstrap exclude (section 3.4).

#### ADR-12 · Purchases: expo-iap (StoreKit 2), no server
- **Context.** Spec N7 and 8.9: one non-consumable Premium, checked on the phone with the store's own tools.
- **Decision.** `expo-iap` **5.8.0 exact** (openiap-apple 3.6.0) behind `PurchasePort`. The server features `kitApi`, `verifyPurchaseWithProvider`, `iapkitApiKey` and `modules.onside` are banned. The fallback version is 5.6.3 (openiap-apple 3.4.0).
- **Rejected.** RevenueCat (validates purchases on its servers), `react-native-iap` (Nitro stack, same core), `expo-in-app-purchases` (unmaintained since 2023).
- **Consequences.** 5.8.0 was published on 2026-09-26 itself. It is covered by the `expo-*` bootstrap exclude and gated on the Tier-2 StoreKit tests.

#### ADR-13 · Connectivity: expo-network
- **Context.** Spec 9: offline hides ads and rewarded buttons silently, and N3 forbids our code from probing the network.
- **Decision.** `expo-network` 57.0.2 (NWPathMonitor, no HTTP probe) behind `ConnectivityPort`.
- **Rejected.** `@react-native-community/netinfo`: its default reachability check fetches `https://clients3.google.com/generate_204`. **Source:** [netinfo defaultConfiguration.ts](https://github.com/react-native-netinfo/react-native-netinfo/blob/master/src/internal/defaultConfiguration.ts).
- **Consequences.** "Online" means "the OS reports a path", not "Google answers". The test-build "Simulate offline" switch wraps this port.

#### ADR-14 · Languages: react-intl, FormatJS polyfills, expo-localization, Vazirmatn
- **Context.** Spec N6, N12 and 7.3: four languages, ICU plurals, Persian and Sorani digits, Arabic-script fonts.
- **Decision.** `react-intl` 12.1.3, `@formatjs/cli` 6.16.32, and forced polyfills (`intl-getcanonicallocales` 3.2.12, `intl-locale` 5.3.12, `intl-pluralrules` 6.3.15, `intl-numberformat` 9.4.3). Hermes lacks `PluralRules` and `Locale` and ignores numbering systems. Also `expo-localization` 57.0.2, `expo-font` 57.0.4, and the Vazirmatn v33.003 TTFs.
- **Rejected.** i18next (its silent fallback plural rule on Hermes), Lingui (macro and compile step), Hermes' native Intl.
- **Consequences.** One polyfill module loads first in the app entry and in the Jest setup. FormatJS ships ESM, so Jest needs a `transformIgnorePatterns` allowlist ([07-testing-and-tdd.md](07-testing-and-tdd.md) section 3.4; [10-i18n-and-rtl.md](10-i18n-and-rtl.md)).

#### ADR-15 · Quality tooling
- **Context.** Spec 2.2 and FINAL D: every rule must be machine-checked, because no human reviews the code.
- **Decision.** ESLint **9.39.5 exact**; ESLint 10 breaks `eslint-plugin-react` inside `eslint-config-expo` 57. Also typescript-eslint 8.70.1, Prettier 3.9.9, knip 6.38.0, Jest 29.7.0 with `jest-expo` 57.0.5 (FINAL's `~29.7` / `~57.0.5` lines, pinned exactly), `@react-native/jest-preset` 0.86.3, RNTL 14.0.1 with `test-renderer` 1.2.0, fast-check 4.10.2, Stryker 10.0.0, Maestro 2.10.0 and lefthook 2.1.14.
- **Rejected.** ESLint 10, Jest 30 (jest-expo 57 is built on Jest 29), Vitest (RNTL closed support), Detox (Homebrew tap, stale Expo plugin), `eslint-plugin-react-compiler` (superseded by `react-hooks` 7).
- **Consequences.** ESLint 9 has been end-of-life since 2026-08-06. It is dev-only, and its trigger is in section 3.5. **Source:** [ESLint version support](https://eslint.org/version-support/).

#### ADR-16 · Build and release: local xcodebuild + altool; no EAS, no fastlane
- **Context.** No human programmer: the agent must build, sign and upload from this Mac with command-line tools only.
- **Decision.** A clean prebuild → `xcodebuild` (Release simulator build, or archive with App Store Connect API-key signing) → `-exportArchive` → `xcrun altool --validate-app` / `--upload-package`. A small Node ES256 JWT script covers what altool lacks. Full detail: `docs/14-ios-build-and-release.md`.
- **Rejected.** EAS Build and `eas build --local` (Expo account or `EXPO_TOKEN`), fastlane (a Ruby toolchain to maintain), Xcode GUI or Transporter (needs a human).
- **Consequences.** Signing depends on the owner's team API key, and a few steps stay human (app record, agreements, App Privacy; doc 14).

#### ADR-17 · Supply chain and freshness
- **Context.** The agent installs and upgrades packages without a human reading each release.
- **Decision.** Exact pins (section 3.2), a committed lockfile with `npm ci`, `min-release-age=7` with dated excludes, `allowScripts` approvals, a banned list enforced by `audit:network`, a Podfile.lock vendor allowlist, and a licence allowlist (MIT, BSD, Apache-2.0, ISC, OFL, CC0) via `audit:licenses`. The one dev-only exception is `eslint-plugin-sonarjs` (LGPL-3.0-only).
- **Rejected.** Caret ranges guarded only by the lockfile (any fresh resolve can pull a release published an hour ago).
- **Consequences.** New releases wait a week. A needed fix gets a dated, reviewed exception.

### 3.2 Versions table

Every version below was checked on **2026-09-26** with `npm view` and the Expo versions API.

**Spec column.** "(expo)" means the specifier `npx expo install` writes; keep it as written. "exact" means `save-exact`.

**Install column.** "expo" means `npx expo install <pkg>` run in `apps/<game>/`. "npm" means `npm install <pkg>@<version>` (at the root for tools, or `-w apps/<game>` for app dependencies).

#### App and Shell runtime

| Package | Verified | Spec | Install | Why this version and pin |
|---|---|---|---|---|
| `expo` | 57.0.25 | `~57.0.25` (expo) | expo | SDK 57 = npm `latest` / `sdk-57`. `next` is 58.0.0-preview.7 |
| `react-native` | 0.86.3 | `0.86.3` (expo) | expo | SDK 57's React Native. npm `latest` 0.87.1 is **not** for SDK 57 |
| `react` | 19.2.3 | `19.2.3` (expo) | expo | 19.3.0 belongs to SDK 58 |
| `@react-navigation/native` | 7.4.1 | exact | npm | Not in the Expo map. v8 is still 8.0.0-alpha.48 |
| `@react-navigation/native-stack` | 7.19.2 | exact | npm | Same as above |
| `react-native-screens` | 4.26.2 | `~4.26.0` (expo) | expo | Expo map |
| `react-native-safe-area-context` | 5.7.0 | `~5.7.0` (expo) | expo | Expo map |
| `zustand` | 5.0.15 | exact | npm | Not in the Expo map |
| `valibot` | 1.5.0 | exact | npm (`-w packages/shell`) | Save-document validator chosen by docs/06 section 6.1 (no `eval`/`new Function`, MIT, no dependencies; published 2026-09-09). A Shell dependency only |
| `expo-sqlite` | 57.0.3 | `~57.0.3` (expo) | expo | Synchronous API, WAL |
| `expo-localization` | 57.0.2 | `~57.0.2` (expo) | expo | Plugin option `supportedLocales` only |
| `expo-font` | 57.0.4 | `~57.0.4` (expo) | expo | Fonts embedded by the config plugin |
| `expo-build-properties` | 57.0.22 | `~57.0.22` (expo) | expo | Has `ios.enableSceneSupport` (verified in 57.0.22 types) |
| `expo-constants` | 57.0.19 | `~57.0.19` (expo) | expo | Runtime read of `extra.adsMode` (doc 14) |
| `expo-haptics` | 57.0.3 | `~57.0.3` (expo) | expo | `HapticsPort` adapter |
| `expo-network` | 57.0.2 | `~57.0.2` (expo) | expo | `ConnectivityPort`, no HTTP probe |
| `expo-store-review` | 57.0.3 | `~57.0.3` (expo) | expo | "Rate this game" (OS component) |
| `@shopify/react-native-skia` | 2.6.2 | `2.6.2` (expo) | expo | Expo pin. npm `latest` 2.13.0 is not for SDK 57 |
| `react-native-reanimated` | 4.5.1 | `4.5.1` (expo) | expo | Expo pin (4.7.0 is SDK 58) |
| `react-native-worklets` | 0.10.1 | `0.10.1` (expo) | expo | Pre-1.0, Expo pins it exactly |
| `react-native-gesture-handler` | 2.32.0 | `~2.32.0` (expo) | expo | Builder API. 3.x is SDK 58. 2.33.0 (`legacy` tag) is outside the range |
| `react-native-audio-api` | 0.13.6 | exact | npm | Pre-1.0, not in the Expo map, native |
| `react-native-google-mobile-ads` | 17.2.0 | exact | npm | Native SDK wrapper. Rollback 16.5.0 |
| `expo-iap` | 5.8.0 | exact | npm | Not in the Expo map. Fallback 5.6.3 |
| `react-intl` | 12.1.3 | exact | npm | ICU messages |
| `@formatjs/intl-getcanonicallocales` | 3.2.12 | exact | npm | Polyfill, guarded by should-polyfill |
| `@formatjs/intl-locale` | 5.3.12 | exact | npm | Polyfill (forced) |
| `@formatjs/intl-pluralrules` | 6.3.15 | exact | npm | Polyfill (forced) |
| `@formatjs/intl-numberformat` | 9.4.3 | exact | npm | Polyfill (forced) |

Do **not** add these directly: `babel-preset-expo` (57.0.13 comes with `expo`), `babel-plugin-react-compiler` (a dependency of `babel-preset-expo`), `react-dom` and `react-native-web` (no web target; remove the template leftovers).

#### Development tooling (root `devDependencies`)

| Package | Verified | Spec | Install | Why |
|---|---|---|---|---|
| `typescript` | 6.0.3 | exact | npm | Expo pins `~6.0.3`. TS 7 has no API |
| `@types/react` | 19.2.18 | exact | npm | Expo related range `~19.2.4` |
| `@types/node` | 26.4.1 | exact | npm | Matches the Node 26.4 runtime. Root and tooling tsconfigs list `node` in `types` (docs/04) |
| `@types/jest` | 29.5.14 | exact | npm | Expo related pin |
| `jest` | 29.7.0 | exact | npm | Expo related `~29.7.0`. Jest 30 is not supported |
| `jest-expo` | 57.0.5 | exact | npm | SDK 57 preset |
| `babel-jest` | 29.7.0 | exact | npm | Same release as `jest`. Root dependency because `jest.sim.config.js` names it (docs/16, knip) |
| `@react-native/jest-preset` | 0.86.3 | exact | npm | jest-expo peer. Must equal the RN version |
| `@testing-library/react-native` | 14.0.1 | exact | npm | Async API |
| `test-renderer` | 1.2.0 | exact | npm | The React 19.2 line. 1.3.0 targets React 19.3 |
| `fast-check` | 4.10.2 | exact | npm | Property tests |
| `jest-image-snapshot` / `@types/jest-image-snapshot` | 6.5.2 / 6.4.2 | exact | npm | Board pixel goldens |
| `pixelmatch` / `pngjs` | 7.2.0 / 7.0.0 | exact | npm | Headless-Skia diff script |
| `@stryker-mutator/core`, `/jest-runner`, `/typescript-checker` | 10.0.0 | exact | npm | Mutation testing |
| `eslint` | 9.39.5 | exact | npm | ESLint 10 breaks `eslint-config-expo` 57 |
| `eslint-config-expo` | 57.0.2 | exact | npm | Brings react, react-hooks 7.1.1 and import 2.32.0 |
| `typescript-eslint` | 8.70.1 | exact | npm | Peer `typescript <6.1.0` |
| `eslint-plugin-sonarjs` | 4.2.1 | exact | npm | Cognitive complexity. LGPL-3.0, dev-only |
| `eslint-plugin-react-native` | 5.0.0 | exact | npm | Style rules. Peer ≤ ESLint 9 |
| `@react-native/eslint-plugin` | 0.86.3 | exact | npm | `no-deep-imports`. Must equal the RN version |
| `eslint-plugin-check-file` | 3.3.2 | exact | npm | kebab-case files and folders |
| `eslint-plugin-jest` | 29.16.6 | exact | npm | |
| `eslint-plugin-testing-library` | 7.16.2 | exact | npm | |
| `eslint-plugin-formatjs` | 8.1.0 | exact | npm | `no-literal-string-in-jsx` only |
| `eslint-config-prettier` | 10.1.8 | exact | npm | Last in the flat config |
| `globals` | 17.12.0 | exact | npm | Node globals for JS config files (imported by docs/04's `eslint.config.mjs`) |
| `prettier` | 3.9.9 | exact | npm | 4.0 is alpha |
| `knip` | 6.38.0 | exact | npm | |
| `lefthook` | 2.1.14 | exact | npm | Git hooks |
| `@formatjs/cli` | 6.16.32 | exact | npm | `formatjs verify` |
| `@formatjs/icu-messageformat-parser` | 3.5.20 | exact | npm | Custom catalog linter |

`typescript`, `jest`, `@types/jest` and `@types/react` are Expo "related packages" (versions API), and `jest-expo` and `eslint-config-expo` are in the module map. Installed with npm under `save-exact`, the exact version still satisfies Expo's range (verified: `npm install -D typescript@~6.0.3` saves `"6.0.3"`).

#### Toolchain outside npm

| Tool | Verified | How it is pinned | Notes |
|---|---|---|---|
| macOS | 27.0 (Apple silicon) | none | Host of the verification runs |
| Xcode | 26.6 (17F113) | `XCODE_VERSION = '26.6'` in `packages/tooling/src/ios/toolchain.ts`; scripts set `DEVELOPER_DIR` | Xcode 27.0 (27A266a) is also installed at `/Applications/Xcode.app`, license not accepted. See doc 14 |
| iOS simulator runtime | iOS 26.5 (23F77) | device and runtime names in tooling | iPhone 17 family and iPad (M5) models exist on 26.5 |
| altool | 26.40.1 | comes with Xcode | `--upload-package --wait`, `--beta-app-store-text` |
| Node.js | 26.4.0 | `.mise.toml`, `.nvmrc` | 26.10.0 exists. Node 26 becomes LTS on 2026-10-28 |
| npm | 11.17.0 | bundled with Node 26.4.0; `engines.npm >=11.17.0` | `min-release-age-exclude` (new in 11.17), `approve-scripts` (11.16+) |
| mise | 2024.7.2 on this Mac | any current release | Manages Node and Ruby |
| Ruby | 3.2.2 | `.mise.toml` | Runs CocoaPods only |
| CocoaPods | 1.17.0 (1.15.2 also verified) | `gem install cocoapods -v 1.17.0` | 1.17.0 matches the `macos-26` CI image |
| Java | 17.0.11 (Android Studio JBR) | `JAVA_HOME` | For Maestro (and Gradle later) |
| Maestro CLI | 2.10.0 | zip + SHA-256 in `tools/maestro` | Owned by [07-testing-and-tdd.md](07-testing-and-tdd.md) section 3.11 |

**Native pods** follow the npm versions because the podspecs pin them exactly. As resolved on 2026-09-26: Google-Mobile-Ads-SDK 13.6.0, GoogleUserMessagingPlatform 3.1.0, openiap 3.6.0, hermes-engine 250829098.0.17. The three trunk pods are downloaded during `pod install`, so the build (not the app) needs the network. With the plugin options of ADR-10 (`disableFFmpeg`, `disableStaticExternalLibs`), `react-native-audio-api` downloads no prebuilt binaries (read in its 0.13.6 podspec and download script; [09-sound-haptics-art.md](09-sound-haptics-art.md) section 2).

### 3.3 Installing packages (commands)

```sh
# Expo-managed native module, inside the app. Writes the SDK's range; do not edit it.
cd apps/line-siege && npx expo install expo-haptics

# Any other app dependency, exact (save-exact=true in .npmrc).
npm install react-native-google-mobile-ads@17.2.0 -w apps/line-siege

# Root development tool, exact.
npm install -D eslint@9.39.5

# After any install that pulled a package with an install script:
npm approve-scripts --allow-scripts-pending   # review the list
npm approve-scripts <package>                 # approve one package, pinned to its version
```

Known traps (verified by the research team or in this writing session):
- `npx expo install X -- --save-dev` put packages into `dependencies`. Use `npx expo install X --dev`.
- For a package outside the Expo map, `npx expo install <pkg>` just runs `npm install --save <pkg>` (npm `latest`, no version check; the probe got `^17.2.0`). Use `npm install <pkg>@<exact>` for those instead.
- `npm ls --parseable` redacts UUID-like path segments as `***`. Read `package-lock.json` instead.
- The Skia 2.6.2 postinstall copies about 205 MB of xcframeworks and needs `npm approve-scripts @shopify/react-native-skia`. Skia 2.6.5 and later have no postinstall (SDK 58 ships 2.11.2; checked with `npm view`).

### 3.4 Dependency freshness and pinning policy

The policy has four parts: the complete `.npmrc` below, exact pins, a committed lockfile, and a monthly update pass.

**The complete root `.npmrc`** (verified on 2026-09-26: npm reads every key, and a full lockfile resolution of the section-3.2 set succeeds):

```ini
# .npmrc (repo root). Owned by docs/01-stack-and-versions.md, "Dependency freshness".
# Refuse to resolve any version published less than 7 days ago.
min-release-age=7
# Refuse to install when node/npm do not satisfy package.json "engines".
engine-strict=true
# Never let npm guess ranges: every `npm install <pkg>` writes an exact version.
save-exact=true

# exclude-block expires=2026-10-03 reason=bootstrap of the set verified on 2026-09-26 (docs/01 versions table)
min-release-age-exclude[]=expo
min-release-age-exclude[]=expo-*
min-release-age-exclude[]=@expo/*
min-release-age-exclude[]=babel-preset-expo
min-release-age-exclude[]=react-native-audio-api
min-release-age-exclude[]=react-native-google-mobile-ads
min-release-age-exclude[]=typescript-eslint
min-release-age-exclude[]=@typescript-eslint/*
min-release-age-exclude[]=prettier
min-release-age-exclude[]=knip
min-release-age-exclude[]=fast-check
min-release-age-exclude[]=react-intl
min-release-age-exclude[]=intl-messageformat
min-release-age-exclude[]=@formatjs/*
min-release-age-exclude[]=eslint-plugin-formatjs
```

Why the bootstrap block exists: several of the versions FINAL-DECISIONS selected were younger than 7 days on 2026-09-26. `expo` 57.0.25 was 2 days old and pulls `@expo/cli ^57.0.27`. `expo-build-properties` 57.0.22 and `babel-preset-expo` 57.0.13 were 2 days old, `react-native-audio-api` 0.13.6 was 3 days, `react-native-google-mobile-ads` 17.2.0 was 1 day, and `expo-iap` 5.8.0 was 0 days (covered by `expo-*`). The fresh dev tools were typescript-eslint 8.70.1, Prettier 3.9.9, knip 6.38.0, fast-check 4.10.2, react-intl 12.1.3 and the FormatJS packages. A resolution of that set with `min-release-age=7` fails with `ETARGET No matching version found for …`. Each of the 15 patterns above was tested by removal, and each one is needed. The block expires on 2026-10-03, the day the youngest package (`expo-iap` 5.8.0) turns 7. **Delete the whole block on or after that date.** The lockfile does not change, because locked versions are not re-resolved (verified: `npm ci` and `npm install` with an existing lockfile ignore the age filter).

How the policy behaves (verified with npm 11.17.0):
- A fresh resolution of a too-young version fails with `npm error notarget No matching version found for <pkg>@<v> with a date before <now − 7 days>`.
- A range picks the newest version that is at least 7 days old. For example `react-native-google-mobile-ads@^17` resolved to 17.0.0.
- An exclude exempts only the named package. "Its own dependencies still follow the release-age policy" (npm docs). That is why `@expo/*` and `@typescript-eslint/*` are listed.
- CocoaPods has no age gate. Pods follow the npm pins, and the Podfile.lock vendor allowlist in `audit:network` catches any new vendor pod.

**Adding a dated exception later** (a fix we need before it is 7 days old): add a new block, give it an expiry date of publish date + 7 days, list only the needed patterns, and put the reason (issue link or changelog line) in the header. The commit message states why.

**The expiry check** runs inside `npm run verify`. Its pure core:

```ts
// packages/tooling/src/deps/release-age-excludes.ts
// Pure: every min-release-age exclude in .npmrc must sit in a dated, unexpired block.
const POLICY_LINE = /^min-release-age=7$/m;
const BLOCK_HEADER = /^# exclude-block expires=(\d{4}-\d{2}-\d{2}) reason=\S.*$/;
const EXCLUDE_LINE = /^min-release-age-exclude\[\]=(\S+)$/;

export type ExcludeProblem = 'policy-missing' | 'no-block' | 'expired';
export type ExcludeViolation = {
  readonly line: number;
  readonly pattern: string;
  readonly problem: ExcludeProblem;
};

export function checkReleaseAgeExcludes(npmrc: string, todayIso: string): ExcludeViolation[] {
  const violations: ExcludeViolation[] = [];
  if (!POLICY_LINE.test(npmrc)) {
    violations.push({ line: 0, pattern: '', problem: 'policy-missing' });
  }
  let expires: string | null = null;
  npmrc.split('\n').forEach((text, index) => {
    const header = BLOCK_HEADER.exec(text);
    const exclude = EXCLUDE_LINE.exec(text);
    if (header !== null) {
      expires = header[1] ?? null;
    } else if (text.trim() === '') {
      expires = null;
    } else if (exclude !== null) {
      const pattern = exclude[1] ?? '';
      if (expires === null) {
        violations.push({ line: index + 1, pattern, problem: 'no-block' });
      } else if (expires < todayIso) {
        violations.push({ line: index + 1, pattern, problem: 'expired' });
      }
    }
  });
  return violations;
}
```

The wrapper is `packages/tooling/src/deps/check-deps.ts` (docs/16), which exits non-zero on any violation. It gets today's date from the one tooling module that reads the wall clock (doc 14's `asc/print-app-record.ts` and doc 12's `asc/create-premium-iap.ts` use the same module):

```ts
// packages/tooling/src/clock/system-clock.ts
// The ONLY tooling module that reads the wall clock (docs/04 exempts exactly this file from the
// Node-code clock ban): every other tooling module receives the time as a value.
export function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// Today's UTC date as YYYY-MM-DD (the release-age exclude check compares against it).
export function todayIso(): string {
  return new Date(Date.now()).toISOString().slice(0, 10);
}
```

Verified on 2026-09-26 (and re-run by the reviewer as Jest tests): the block above gives no violations on 2026-09-26 and 2026-10-03, and 15 `expired` violations on 2026-10-04; an undated exclude gives `no-block`, and a missing `min-release-age=7` gives `policy-missing`.

**Monthly dependency pass** (and whenever a fix is needed):
1. In each app, run `npx expo install --check`. It lists Expo-managed packages behind the SDK's expected versions.
2. At the root, run `npm outdated`. Ignore majors that section 3.5 holds back.
3. For each candidate, run `npm view <pkg>@<version> time --json` (it must be at least 7 days old) and read its changelog. Pre-1.0 and native packages also need a simulator smoke run (`npm run build:ios:sim`) and, for purchases, the Tier-2 StoreKit tests.
4. Apply the change to all apps together, then run `npm run verify`, `npm run build:ios:sim` for every app, `npm run e2e:ios`, and a screenshot-diff review.
5. Update the section 3.2 table and the Verified section in the same commit.

**Install scripts.** After every install, `npm approve-scripts --allow-scripts-pending` must print `No packages with unreviewed install scripts.`. The command exits 0 either way, so `verify` greps its output. Expected approvals on SDK 57: `@shopify/react-native-skia` (postinstall), `unrs-resolver` (from eslint-config-expo), `lefthook`, and `fsevents` if it appears.

### 3.5 Upgrade policy

**Expo SDK cadence.** For years Expo shipped three majors a year. SDK 57 (2026-06-30) tried a lighter, non-breaking "React Native bump" SDK. Each SDK gets critical fixes for about one year. **Source:** [Expo SDK 57 changelog](https://expo.dev/changelog/sdk-57). The SDK 58 beta started on 2026-09-15 for 3–4 weeks (RN 0.88, React 19.3). Expect it to go stable in mid or late October 2026.

**SDK 58 trigger (all conditions required):**
1. `npm view expo dist-tags` shows `latest` = 58.x, and that version is at least 7 days old.
2. Every package we use from the SDK 58 map is published and at least 7 days old.
3. On a branch, every app upgrades together and passes: `npm run verify`, `npm run build:ios:sim`, `npm run e2e:ios`, and the screenshot matrix, with diffs reviewed.

Procedure (one commit, all apps):
```sh
# in each apps/<game>/
npx expo install expo@^58.0.0 && npx expo install --fix
npx expo-doctor
# at the root
npm run verify && npm run build:ios:sim -- --app <game>   # for every game
```
Known SDK 58 changes to handle: Reanimated 4.7 and Worklets 0.13 test-setup changes, `test-renderer` 1.3 for React 19.3, RNGH 3.x (the builder API still compiles but is deprecated; move a board's gestures to hooks together), Skia 2.11.2 (no postinstall), `useColorScheme()` can return `null`, removed RN APIs (InteractionManager, the Modal `animated` prop, StatusBar `backgroundColor`/`translucent`), and Android compileSdk 37 with AGP 9. After the move, remove `ios.enableSceneSupport` if it was set (it is a no-op on 58).

**Xcode.** Stay on Xcode 26.6 while it satisfies Apple ("built with Xcode 26 or later", required since 2026-04-28). Apple had announced no Xcode 27 requirement on 2026-09-26. **Source:** [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/). Xcode 27.0 is already installed on the build Mac but is not selected. If Xcode 27 is ever used while still on SDK 57, first add the following. This was verified on 2026-09-26: prebuild writes `UIApplicationSceneManifest` with `EXExpoAppSceneDelegate`, and the app still builds with Xcode 26.6 and launches on the iOS 26.5 simulator.

```ts
// packages/shell/src/config/with-shell.ts (plugins excerpt: only when building SDK 57 with Xcode 27)
import type { ExpoConfig } from 'expo/config';

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

export const SCENE_SUPPORT_PLUGIN: PluginEntry = [
  'expo-build-properties',
  { ios: { enableSceneSupport: true } },
];
```

Append `SCENE_SUPPORT_PLUGIN` to the `plugins` array that `withShell` returns. If `expo-build-properties` is already listed, merge `enableSceneSupport: true` into its `ios` options instead of adding a second entry. The plugin needs `expo` ≥ 57.0.23 and throws otherwise. It rewrites only the standard SDK 57 Swift AppDelegate and adds the scene manifest to Info.plist; it throws on a customised AppDelegate or when the app already declares `UIApplicationSceneManifest` (read in the 57.0.22 source, `build/iosSceneSupport.js`).

**Node.** 26.4.0 until Node 26 LTS (2026-10-28). After that, move to the newest 26.x LTS that is at least 7 days old with a full verify run, then update `.mise.toml`, `.nvmrc` and this table.

**Held-back majors and their triggers:**

| Held back | Trigger to revisit |
|---|---|
| ESLint 10 | `eslint-config-expo` ships with an `eslint-plugin-react` that supports ESLint 10 (jsx-eslint/eslint-plugin-react PR #4022) |
| TypeScript 7 | typescript-eslint supports TS 7 (it needs the 7.1 API) **and** Expo's related packages list it |
| Jest 30 | `jest-expo` for our SDK depends on Jest 30 |
| React Navigation 8 | a stable 8.0 release, and Expo documents it |
| RNGH 3 / Reanimated 4.7 / Skia 2.11+ | arrive with SDK 58 via `npx expo install --fix` |
| `react-native` 0.87+ | only through an Expo SDK that pins it |
| `react-native-audio-api` 1.0 | a stable 1.0 release plus a simulator audio smoke |

### 3.6 Banned packages

`npm run audit:network` (its dependency check, FINAL D.44) fails when a banned package appears in `package-lock.json`. HTTP-client packages are banned only as direct dependencies, because some tools pull them in transitively (for example `fbjs` → `cross-fetch`). ESLint `no-restricted-imports` blocks the same names in our code.

| Package(s) | Reason |
|---|---|
| `expo-router` | The Shell owns one React Navigation 7 stack. Expo Router (SDK 56+) forbids `@react-navigation/*` imports in app code |
| `expo-updates` | OTA updates are network traffic (N3). Restart with `reloadAppAsync` from `expo`. Also set `updates.enabled: false` |
| `expo-dev-client` | Ships a network inspector. We test Release builds without Metro |
| `@react-native-community/netinfo` | Its default reachability probe fetches `clients3.google.com` from our JS bundle. Use `expo-network` |
| `expo-audio` | Its plugin adds `NSMicrophoneUsageDescription`, background audio and Android record permissions by default. Use `react-native-audio-api` |
| `react-native-purchases`, `react-native-purchases-ui` (RevenueCat) | Every purchase goes through RevenueCat's servers (N2) |
| `react-native-iap` | A second IAP stack (Nitro) with the same core. Use `expo-iap` |
| `firebase`, `@react-native-firebase/*` | A backend and analytics (N2) |
| `@sentry/*`, `sentry-expo`, `@bugsnag/*`, `@datadog/*` | Crash reporting services (N2) |
| `expo-insights`, `expo-observe`, `expo-app-metrics` | Expo telemetry services (N2) |
| `expo-notifications` | No push notifications (spec 14) |
| `@amplitude/*`, `expo-analytics-amplitude`, `@segment/*` | Analytics (N2) |
| `react-native-webview`, `expo-web-browser` | Web views are a network surface. `@expo/dom-webview` is a dependency of `expo` itself, so it is allowed installed but banned from imports |
| `expo-tracking-transparency` | Decision D4: no ATT prompt in v1. Its plugin writes a tracking string |
| `react-native-restart` | A pre-1.0 native dependency. `reloadAppAsync` covers restarts |
| `eslint-plugin-react-compiler` | Superseded by `eslint-plugin-react-hooks` 7 (still 19.1.0-rc.2) |
| `axios`, `ky`, `got`, `node-fetch`, `cross-fetch` (direct) | N3: our app code makes no requests. Tooling uses Node's built-in `fetch` |

The checker (verified: `tsc` 6.0.3 and the project ESLint config pass). Against the research probes it flags the Expo template leftovers `expo-router` and `expo-web-browser`, flags `expo-audio` in the Skia probe, and finds nothing in the services spike, which has AdMob and expo-iap installed:

```ts
// packages/tooling/src/deps/banned-packages.ts
// Checked by `npm run audit:network` against package-lock.json.
export type BannedScope = 'anywhere' | 'direct';
export type BannedRule = {
  readonly pattern: RegExp;
  readonly scope: BannedScope;
  readonly reason: string;
};

const NO_NETWORK = 'Spec N2/N3: adds a server, telemetry or network code of its own.';

export const BANNED_PACKAGES: readonly BannedRule[] = [
  {
    pattern: /^expo-router$/,
    scope: 'anywhere',
    reason: 'The Shell owns a React Navigation 7 stack.',
  },
  { pattern: /^expo-updates$/, scope: 'anywhere', reason: 'OTA updates are network traffic.' },
  { pattern: /^expo-dev-client$/, scope: 'anywhere', reason: 'Ships a network inspector.' },
  {
    pattern: /^@react-native-community\/netinfo$/,
    scope: 'anywhere',
    reason: 'Probes Google over HTTP.',
  },
  {
    pattern: /^expo-audio$/,
    scope: 'anywhere',
    reason: 'Adds microphone and background-audio keys.',
  },
  { pattern: /^react-native-purchases(-ui)?$/, scope: 'anywhere', reason: 'RevenueCat server.' },
  { pattern: /^react-native-iap$/, scope: 'anywhere', reason: 'Second IAP stack; use expo-iap.' },
  { pattern: /^(firebase|@react-native-firebase\/.+)$/, scope: 'anywhere', reason: NO_NETWORK },
  {
    pattern: /^(@sentry\/.+|sentry-expo|@bugsnag\/.+|@datadog\/.+)$/,
    scope: 'anywhere',
    reason: NO_NETWORK,
  },
  {
    pattern: /^(expo-insights|expo-observe|expo-app-metrics)$/,
    scope: 'anywhere',
    reason: NO_NETWORK,
  },
  { pattern: /^expo-notifications$/, scope: 'anywhere', reason: 'Spec 14: no push notifications.' },
  {
    pattern: /^(@amplitude\/.+|expo-analytics-amplitude|@segment\/.+)$/,
    scope: 'anywhere',
    reason: NO_NETWORK,
  },
  {
    pattern: /^(react-native-webview|expo-web-browser)$/,
    scope: 'anywhere',
    reason: 'Web views are a network surface.',
  },
  {
    pattern: /^expo-tracking-transparency$/,
    scope: 'anywhere',
    reason: 'Decision D4: no ATT prompt in v1.',
  },
  {
    pattern: /^react-native-restart$/,
    scope: 'anywhere',
    reason: 'reloadAppAsync from expo covers restarts.',
  },
  {
    pattern: /^eslint-plugin-react-compiler$/,
    scope: 'anywhere',
    reason: 'Superseded by react-hooks 7.',
  },
  {
    pattern: /^(axios|ky|got|node-fetch|cross-fetch)$/,
    scope: 'direct',
    reason: 'Spec N3: no HTTP client.',
  },
];

type LockEntry = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
};
export type Lockfile = { readonly packages: Readonly<Record<string, LockEntry>> };
export type PackageInventory = {
  readonly direct: readonly string[];
  readonly all: readonly string[];
};
export type BannedHit = { readonly name: string; readonly reason: string };

const NODE_MODULES = 'node_modules/';

export function inventoryFromLockfile(lockfile: Lockfile): PackageInventory {
  const paths = Object.keys(lockfile.packages);
  const all = paths
    .filter((path) => path.includes(NODE_MODULES))
    .map((path) => path.slice(path.lastIndexOf(NODE_MODULES) + NODE_MODULES.length));
  const direct = paths
    .filter((path) => !path.includes(NODE_MODULES))
    .flatMap((path) => {
      const entry = lockfile.packages[path];
      return Object.keys({
        ...entry?.dependencies,
        ...entry?.devDependencies,
        ...entry?.optionalDependencies,
      });
    });
  return { direct: [...new Set(direct)].sort(), all: [...new Set(all)].sort() };
}

export function findBannedPackages(inventory: PackageInventory): readonly BannedHit[] {
  return BANNED_PACKAGES.flatMap((rule) => {
    const names = rule.scope === 'direct' ? inventory.direct : inventory.all;
    return names
      .filter((name) => rule.pattern.test(name))
      .map((name) => ({ name, reason: rule.reason }));
  });
}
```

Also banned, but as **options** rather than packages (docs 11, 12, 13 and 16 enforce these): the `expo-iap` exports `kitApi`, `KitApiError` and `verifyPurchaseWithProvider`, the `expo-iap` plugin options `iapkitApiKey` and `modules.onside`, the GMA plugin option `userTrackingUsageDescription` (while D4 stands), and the Maestro commands `assertWithAI`, `assertNoDefectsWithAI` and `extractTextWithAI` (they upload screenshots to an LLM service).

### 3.7 Re-verifying versions (they will age)

Run these before trusting any version in this doc if the doc's Verified date is more than a few weeks old:

```sh
npm view expo dist-tags                       # latest / sdk-57 / next
npm view react-native dist-tags               # never install these by hand; compare only
curl -s https://api.expo.dev/v2/versions/latest | node -e "
  let s = ''; process.stdin.on('data', (c) => { s += c; }).on('end', () => {
    const v = JSON.parse(s).data.sdkVersions;
    for (const sdk of ['57.0.0', '58.0.0']) {
      const x = v[sdk] ?? {};
      console.log(sdk, x.facebookReactNativeVersion, x.facebookReactVersion, JSON.stringify(x.relatedPackages));
    }
  });"
(cd apps/line-siege && npx expo install --check && npx expo-doctor)
npm view <package> version time --json        # age check against the 7-day policy
npm outdated                                  # at the root
xcodebuild -version; xcrun simctl list runtimes; pod --version; node --version; npm --version
```

`npx expo install --check` and `expo-doctor` contact Expo's API. That is allowed for development tools, because N3 covers the app, not the toolchain. Set `EXPO_NO_TELEMETRY=1` in every tooling environment.

### 3.8 For the owner: engine or library?

**Short answer: libraries, not an engine.** A game engine (Unity, Godot, Cocos) is a complete program that runs the whole game: it draws, animates, plays sound, simulates physics, and hosts the menus and the store code. Our games are small 2D board and puzzle games inside a shared React Native app (the Shell), so a full engine would add weight and a second world to maintain. Instead, each piece of work goes to a proven specialist library:

- **Drawing the board:** Skia, the same drawing engine Chrome and Android use, packaged for React Native by Shopify.
- **Smooth animation and the game clock:** Reanimated, which runs frame-by-frame work on the phone's UI thread, so a busy moment in the menus cannot stutter the board.
- **Taps, swipes and drags:** Gesture Handler.
- **Sound effects:** a Web-Audio-style library (react-native-audio-api). The sounds are generated by code (N9), so there are no recorded files.
- **Vibration:** Expo Haptics.
- **The rules of each game:** plain TypeScript written by Claude Code. They contain no graphics, so a test "bot" can play thousands of games in seconds, and the same seed always produces the same level on every phone.

What you gain: small apps, one language (TypeScript) everywhere, and every rule testable without a screen. It also means the menus, languages, ads and purchase screens are ordinary app screens that work in all four languages, including right-to-left. What you give up: no drag-and-drop visual editor and no ready-made physics. No game on the list needs a full physics engine. Bank Shot and Halo Drift use a small collision kit written in-house.

---

## 4. Checklist

Before calling any change to dependencies, versions or this stack "done":

- [ ] Every changed version matches section 3.2, and the table and the Verified section were updated in the same commit.
- [ ] Expo-managed packages were installed with `npx expo install` inside each app. Every other package has an exact version in `package.json`.
- [ ] All `apps/*/package.json` list identical versions for shared packages (lockstep check in `npm run verify`).
- [ ] `package-lock.json` is committed, and `npm ci` from a clean clone succeeds.
- [ ] `npx expo install --check` and `npx expo-doctor` pass in every app.
- [ ] `.npmrc` still has `min-release-age=7`, `engine-strict=true` and `save-exact=true`. Every exclude is in a dated, unexpired block (the verify check passes). The bootstrap block is gone after 2026-10-03.
- [ ] `npm approve-scripts --allow-scripts-pending` prints `No packages with unreviewed install scripts.`
- [ ] `npm run audit:network` reports no banned package, and `npm run audit:licenses` passes.
- [ ] No held-back major (section 3.5) was taken without its trigger.
- [ ] Pre-1.0 or native package changes: `npm run build:ios:sim` was run for every app, and for purchases, the Tier-2 StoreKit tests too.
- [ ] `npm run verify` is green.

---

## 5. Sources

- Expo SDK tables: https://docs.expo.dev/versions/latest/ and https://docs.expo.dev/versions/v58.0.0/
- Expo SDK 57 changelog (cadence, about one year of support): https://expo.dev/changelog/sdk-57
- Expo SDK 58 beta: https://expo.dev/changelog/sdk-58-beta
- Expo scene life cycle and SDK 57 with Xcode 27: https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md
- Expo SDK 57 module map: https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json
- Expo versions API: https://api.expo.dev/v2/versions/latest
- Expo CNG: https://docs.expo.dev/workflow/continuous-native-generation/
- Expo monorepos: https://docs.expo.dev/guides/monorepos/
- Expo app config in TypeScript: https://docs.expo.dev/guides/typescript/
- Expo React Compiler: https://docs.expo.dev/guides/react-compiler/
- `reloadAppAsync`: https://docs.expo.dev/versions/latest/sdk/expo/#reloadappasyncreason
- Expo Router SDK 57 docs (no `@react-navigation/*` imports): https://docs.expo.dev/versions/v57.0.0/sdk/router/
- React Navigation static configuration: https://reactnavigation.org/docs/static-configuration
- TypeScript 6.0 / 7.0 announcements: https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ , https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- typescript-eslint dependency versions: https://typescript-eslint.io/users/dependency-versions
- ESLint version support: https://eslint.org/version-support/
- npm config (`min-release-age`, `min-release-age-exclude`, `engine-strict`, `save-exact`): https://docs.npmjs.com/cli/v11/using-npm/config
- npm approve-scripts: https://docs.npmjs.com/cli/v11/commands/npm-approve-scripts
- Node 22.18.0 (type stripping on by default): https://nodejs.org/en/blog/release/v22.18.0
- Node release schedule: https://github.com/nodejs/Release
- Apple upcoming requirements: https://developer.apple.com/news/upcoming-requirements/
- netinfo default configuration: https://github.com/react-native-netinfo/react-native-netinfo/blob/master/src/internal/defaultConfiguration.ts
- expo-audio: https://docs.expo.dev/versions/latest/sdk/audio/
- Expo in-app purchases guide: https://docs.expo.dev/guides/in-app-purchases/
- openiap / expo-iap setup: https://openiap.dev/docs/setup/expo
- Hermes Intl APIs: https://github.com/facebook/hermes/blob/main/doc/IntlAPIs.md
- Hermes math functions (platform libm): https://github.com/facebook/hermes/blob/main/lib/VM/JSLib/MathStdFunctions.def
- Skia rendering modes: https://raw.githubusercontent.com/Shopify/react-native-skia/main/apps/docs/docs/canvas/rendering-modes.md
- CocoaPods releases: https://rubygems.org/gems/cocoapods
- mise: https://mise.jdx.dev/

---

## Verified

**Verified on 2026-09-26 by the writer of this doc** (macOS 27.0 on Apple silicon, Xcode 26.6 17F113, iOS 26.5 runtime, Node 26.4.0, npm 11.17.0, CocoaPods 1.15.2 and 1.17.0, Ruby 3.2.2), in copies under `scratchpad/rn/writer-stack-ios/`. No probe was modified.

- Every version in section 3.2 was checked with `npm view` (versions, dist-tags, publish times) and `api.expo.dev/v2/versions/latest` (SDK 57: RN 0.86.3, React 19.2.3, related `typescript ~6.0.3`, `jest ~29.7.0`, `@types/jest 29.5.14`, `@types/react ~19.2.4`; SDK 58: RN 0.88.0-rc.1, React 19.3.0).
- Package ages on 2026-09-26 (days): `expo-iap` 5.8.0 0, `react-native-google-mobile-ads` 17.2.0 1, `react-intl` 12.1.3 1, `@formatjs/cli` 6.16.32 1, `eslint-plugin-formatjs` 8.1.0 1, `@formatjs/intl-locale` 5.3.12 1, `expo` 57.0.25 2, `expo-build-properties` 57.0.22 2, `babel-preset-expo` 57.0.13 2, `react-native-audio-api` 0.13.6 3, `prettier` 3.9.9 3, `knip` 6.38.0 3, `typescript-eslint` 8.70.1 4, `fast-check` 4.10.2 6, `@formatjs/icu-messageformat-parser` 3.5.20 6. Everything else in the table is 8 days or older.
- `min-release-age` (npm 11.17.0): a too-young version fails with `ETARGET`; `min-release-age-exclude[]` exempts only the named package; `npm ci` and `npm install` with an existing lockfile install the locked (too-young) version without error; `^17` resolves to 17.0.0. The complete `.npmrc` in section 3.4 resolves the full section-3.2 set. Removing any one of its 15 exclude patterns makes the resolution fail. `engine-strict=true` makes `npm install` refuse a root `engines.npm` it does not meet.
- `npx expo install expo-haptics` writes `~57.0.3` even with `save-exact=true`. `npm install -D typescript@~6.0.3` under `save-exact` writes `6.0.3`.
- `checkReleaseAgeExcludes` and `banned-packages.ts`: type-checked with TypeScript 6.0.3 (strict flags, `types: ["node"]`), linted clean with the verified ESLint config (`review-qt-b/eslint.fixed.mjs`), formatted with Prettier 3.9.9, and run against the lockfiles of `probe`, `skiatest`, `spike` and the monorepo copy with the results given in section 3.6.
- In a copy of the `mono` probe: `npx expo install --check` → "Dependencies are up to date", and `npx expo-doctor` → 21/21 checks passed.
- `expo-build-properties` 57.0.22 declares `ios.enableSceneSupport` (minimum `expo` 57.0.23, SDK 58 no-op). With it set, prebuild wrote the scene manifest, the app built with Xcode 26.6 and it launched on iOS 26.5.
- CocoaPods 1.17.0 (isolated `GEM_HOME`): prebuild with `pod install` and a Release simulator build succeeded on the monorepo copy (a small app without the AdMob, Skia or audio pods). 1.15.2 is the machine's default.
- Node release index: 26.4.0 (2026-06-24, npm 11.17.0). The latest 26.x is 26.10.0 (2026-09-21, npm 11.19.1).
- Apple's upcoming-requirements page: Xcode 26 / iOS 26 SDK required since 2026-04-28, iOS 13+ targets since 2026-09-09, and no Xcode 27 date announced.
- Expo docs: SDK 58 lists Xcode 26.4+ and iOS 16.4+. The SDK 57 changelog gives the release date 2026-06-30 and about one year of support.

**Verified earlier on 2026-09-26 by the research team and challengers** (evidence in `scratchpad/rn/notes_*.md` and `decisions_full.json`): the monorepo and static-navigation Release build, the React Compiler applied to workspace code, ESLint 10 breaking `eslint-config-expo` 57, TS 6 `types: []` failing Jest globals (TS2593), the `./game.config` import failing without `.ts`, AdMob, UMP and expo-iap building and running on the simulator, Hermes Intl gaps, the netinfo probe URL in source, and the `expo-audio` plugin defaults.

**Re-verified on 2026-09-26 by the reviewer** (copies under `scratchpad/rn/verify-stack-build/`): every version in section 3.2 exists on npm with the publish ages above; the dist-tags quoted in this doc; the SDK 57 and SDK 58 module maps and related packages; Skia's postinstall (2.6.2 has it, 2.6.5 and 2.11.2 do not); `min-release-age-exclude` first documented in npm 11.17.0; `expo-build-properties` 57.0.22 scene-support source; GMA 17.2.0 `sdkVersions` (13.6.0 / UMP 3.1.0) and `expo-iap` `openiap-versions.json` (5.8.0: 3.6.0; 5.6.3: apple 3.4.0); the `react-native-audio-api` 0.13.6 plugin option names; Node 26 LTS date 2026-10-28; CocoaPods 1.17.0 on rubygems; Apple's upcoming-requirements page. `npm install --package-lock-only` of the whole section-3.2 set (with `globals` and `babel-jest`) under the complete `.npmrc` succeeds, and fails with `ETARGET` once the exclude block is removed. `release-age-excludes.ts`, `banned-packages.ts` and `system-clock.ts` pass `tsc` 6.0.3, docs/04's ESLint config and Prettier, with Jest tests for both checkers.

**Not verified:** Java 17 installed through mise (this Mac uses Android Studio's JBR 17.0.11), and CocoaPods 1.17.0 with the full pod set (AdMob, Skia, audio-api).

---

## Open issues

1. **Caret ranges vs exact pins inside FINAL-DECISIONS.** A.4 and A.5 write `@react-navigation/native ^7.4.1`, `native-stack ^7.19.2` and `zustand ^5.0.15`, and several D items name lines such as "Prettier 3.9.x" and "knip 6.x". A.43 requires "exact versions in package.json". This doc applies A.43: every package outside Expo's module map is pinned exactly at the version shown in A.4/A.5 (`save-exact=true`). Expo-managed packages keep the specifier `npx expo install` writes, which it rewrites anyway. `test-renderer ~1.2.0` becomes `1.2.0`, the only 1.2.x release.
2. **The freshness policy conflicts with the chosen versions on day one.** With `min-release-age=7`, the FINAL-selected set does not resolve on 2026-09-26. The blockers are `expo` 57.0.25 (via `@expo/cli ^57.0.27`), `expo-build-properties`, `babel-preset-expo`, AdMob 17.2.0, `expo-iap` 5.8.0, `react-native-audio-api` 0.13.6, typescript-eslint, Prettier, knip, fast-check, react-intl and the FormatJS packages. Both decisions are kept: a dated bootstrap block of 15 excludes (each proven necessary) expires on 2026-10-03, and `verify` fails if it is still present after that date.
3. **Xcode 27.0 is already installed** at `/Applications/Xcode.app` (license not accepted) next to `/Applications/Xcode-26.6.0.app`, the one `xcode-select` points to. Any tool that picks the app named "Xcode.app", or a future `xcode-select` change, would silently build with the iOS 27 SDK without scene support. Doc 14 pins `DEVELOPER_DIR` explicitly.
4. **Resolved: the save-document validator is valibot 1.5.0** (FINAL-DECISIONS A.6 only says "validated on load and before write"). docs/06 section 6.1 chose it after the Hermes Release-build smoke test this doc asked for; zod 4 was rejected because its JIT uses `new Function`. The row is in section 3.2.
5. **The Java 17 source is not fixed.** FINAL-DECISIONS D.40 says `JAVA_HOME` = Java 17. On this Mac it comes from Android Studio's JBR (verified). A from-zero Mac without Android Studio needs another JDK (for example `mise use java@temurin-17`, listed by `mise ls-remote` but not installed or verified).
6. **Tooling `types`.** FINAL A.3 says the scripts/tooling tsconfig sets `types: ["node"]`. The tooling tests are colocated (`*.test.ts` next to the scripts), so docs/04, doc 14 and this doc use `["node", "jest"]` (verified: with `["node"]` alone `build-number.test.ts` fails with TS2593).
