# The versions table (Expo SDK 57 set, verified 2026-09-26)

Every package Pocket Arcade may depend on, the exact version, the specifier that goes into `package.json`, where it is installed and why. `assets/versions.json` is the machine copy the scripts read; change a row in both files in the same commit as the repo change. Read this before installing, upgrading or reviewing any dependency.

## Contents

- Why a written table
- App and Shell runtime (every app)
- Shell-only JavaScript libraries
- Development tooling (root and tooling devDependencies)
- Companions and root overrides
- Do not add
- Held-back majors and their triggers
- Toolchain outside npm
- Native pods
- Re-verifying versions (they age)

## Why a written table

Three facts shape every row:

1. **Training data is stale.** On 2026-09-26 npm already carried React Native 0.87.1, TypeScript 7.0.2, ESLint 10.11.0, Jest 30.5.2 and Skia 2.13.0. None of them is right for this project; npm `latest` is the wrong major for several packages. The table is the truth, memory is not.
2. **Expo pins a tested set of native module versions per SDK.** The set lives in `expo/bundledNativeModules.json` (copied into this skill as `assets/expo-sdk-57-module-map.json`) and in the "related packages" of Expo's versions API. `npx expo install` applies it and `npx expo install --check` verifies it. Anything outside that set is our responsibility, so it gets an exact version.
3. **The app never reaches the network through our code (spec N1-N3).** Some packages add a server, telemetry or a network probe; they are banned outright (the supply-chain reference).

Spec column: `~x.y.z` means the specifier that `npx expo install <pkg>@~x.y.z` writes (always pass it: a bare `npx expo install <pkg>` can write a patch published that day); an exact `x.y.z` means `save-exact`. Install column: where and how.

## App and Shell runtime (every app)

Each of these is a dependency of **every** app with the identical specifier, and (except `expo-system-ui`) a `peerDependencies` entry `"*"` of `packages/shell` with a root `overrides` entry at the version the apps install (the Version column: `react-native-screens` 4.26.2 for the spec `~4.26.0`). Autolinking and `npx expo install --check` only see an app's own dependencies. Some Shell, app, Jest-setup or config-plugin code must use each of them (`check-deps-policy.mjs` rule `unused-dependency`), except `react-native-screens` and `react-native-safe-area-context`, which `@react-navigation/native-stack` loads as its peers (`implicitUse` in `assets/versions.json`).

| Package | Version | Spec | Install | Why this version and pin |
|---|---|---|---|---|
| `expo` | 57.0.25 | `~57.0.25` | npx expo install (in each app) | SDK 57 line; on 2026-09-30 npm latest / sdk-57 is 57.0.26 (a patch, due 2026-10-07), next is 58.0.0 (not latest, so no SDK move is due) |
| `react-native` | 0.86.3 | `0.86.3` | npx expo install (in each app) | SDK 57's React Native; npm latest 0.87.1 is not for SDK 57 |
| `react` | 19.2.3 | `19.2.3` | npx expo install (in each app) | 19.3.0 belongs to SDK 58; the root `overrides` pin the same two |
| `@react-navigation/native` | 7.4.1 | `7.4.1` | npm install -w apps/<each> | not in the Expo map; v8 is still an alpha |
| `@react-navigation/native-stack` | 7.19.2 | `7.19.2` | npm install -w apps/<each> | same as @react-navigation/native |
| `react-native-screens` | 4.26.2 | `~4.26.0` | npx expo install (in each app) | Expo map |
| `react-native-safe-area-context` | 5.7.0 | `~5.7.0` | npx expo install (in each app) | Expo map |
| `expo-sqlite` | 57.0.3 | `~57.0.3` | npx expo install (in each app) | synchronous API, WAL |
| `expo-localization` | 57.0.2 | `~57.0.2` | npx expo install (in each app) | plugin option supportedLocales only |
| `expo-font` | 57.0.4 | `~57.0.4` | npx expo install (in each app) | fonts embedded by the config plugin |
| `expo-build-properties` | 57.0.22 | `~57.0.22` | npx expo install (in each app) | has ios.enableSceneSupport (needs expo >= 57.0.23) |
| `expo-constants` | 57.0.19 | `~57.0.19` | npx expo install (in each app) | runtime read of expo.extra |
| `expo-haptics` | 57.0.3 | `~57.0.3` | npx expo install (in each app) | HapticsPort adapter |
| `expo-network` | 57.0.2 | `~57.0.2` | npx expo install (in each app) | ConnectivityPort; no HTTP probe |
| `expo-store-review` | 57.0.3 | `~57.0.3` | npx expo install (in each app) | "Rate this game" (OS component) |
| `expo-tracking-transparency` | 57.0.2 | `~57.0.2` | npx expo install (in each app) | App Tracking Transparency prompt behind `ConsentPort.requestTracking` (owner decision O1, 2026-09-30); on 2026-09-30 npm `sdk-57` = `latest` = 57.0.2, published 2026-09-11, MIT, no install script; imported only by `services/consent/admob-consent-adapter.ts`; its plugin entry in `shell-plugins.ts` (`userTrackingPermission`) writes `NSUserTrackingUsageDescription` (Expo's generic English sentence when the option is missing) and adds Android's `com.google.android.gms.permission.AD_ID` |
| `expo-splash-screen` | 57.0.9 | `~57.0.9` | npx expo install (in each app) | splash config plugin (code-drawn art) |
| `expo-system-ui` | 57.0.4 | `~57.0.4` | npx expo install (in each app) | `userInterfaceStyle: 'automatic'` needs it (knip checks); app-only, not a Shell peer |
| `@shopify/react-native-skia` | 2.6.2 | `2.6.2` | npx expo install (in each app) | Expo pin; npm latest 2.13.0 is not for SDK 57; postinstall needs approval |
| `react-native-reanimated` | 4.5.1 | `4.5.1` | npx expo install (in each app) | Expo pin (4.7.0 is SDK 58) |
| `react-native-worklets` | 0.10.1 | `0.10.1` | npx expo install (in each app) | pre-1.0; Expo pins it exactly |
| `react-native-gesture-handler` | 2.32.0 | `~2.32.0` | npx expo install (in each app) | builder API; 3.x is SDK 58; 2.33.0 (legacy tag) is outside the range |
| `react-native-audio-api` | 0.13.6 | `0.13.6` | npm install -w apps/<each> | pre-1.0, not in the Expo map, native |
| `react-native-google-mobile-ads` | 17.2.0 | `17.2.0` | npm install -w apps/<each> | native SDK wrapper (pods Google-Mobile-Ads-SDK 13.6.0, UMP 3.1.0); rollback target 16.5.0 |
| `expo-iap` | 5.8.0 | `5.8.0` | npm install -w apps/<each> | not in the Expo map (openiap-apple 3.6.0); fallback 5.6.3 (openiap-apple 3.4.0) |

## Shell-only JavaScript libraries

Pure JavaScript libraries only the Shell imports are ordinary dependencies of `packages/shell` and are **not** app dependencies (knip would report them unused in the apps).

| Package | Version | Spec | Install | Why |
|---|---|---|---|---|
| `zustand` | 5.0.15 | `5.0.15` | npm install -w packages/shell | not in the Expo map; Shell stores only |
| `valibot` | 1.5.0 | `1.5.0` | npm install -w packages/shell | save-document validator (no eval or new Function, MIT, no dependencies) |
| `react-intl` | 12.1.3 | `12.1.3` | npm install -w packages/shell | ICU messages |
| `@formatjs/intl-getcanonicallocales` | 3.2.12 | `3.2.12` | npm install -w packages/shell | polyfill, guarded by should-polyfill |
| `@formatjs/intl-locale` | 5.3.12 | `5.3.12` | npm install -w packages/shell | polyfill (forced) |
| `@formatjs/intl-pluralrules` | 6.3.15 | `6.3.15` | npm install -w packages/shell | polyfill (forced) |
| `@formatjs/intl-numberformat` | 9.4.3 | `9.4.3` | npm install -w packages/shell | polyfill (forced) |

## Development tooling (root and tooling devDependencies)

`typescript`, `jest`, `@types/jest` and `@types/react` are Expo "related packages" (versions API) and `jest-expo` and `eslint-config-expo` are in the module map; installed with npm under `save-exact`, the exact version still satisfies Expo's range (verified: `npm install -D typescript@~6.0.3` saves `"6.0.3"`).

| Package | Version | Install | Why |
|---|---|---|---|
| `typescript` | 6.0.3 | npm install -D (root) | Expo pins ~6.0.3 for SDKs 57 and 58; TS 7 has no programmatic API and typescript-eslint supports <6.1.0 |
| `@types/react` | 19.2.18 | npm install -D (root) | Expo related range ~19.2.4 |
| `@types/node` | 26.4.1 | npm install -D (root) | matches the Node 26.4 runtime |
| `@types/jest` | 29.5.14 | npm install -D (root) | Expo related pin |
| `jest` | 29.7.0 | npm install -D (root) | Expo related ~29.7.0; Jest 30 is not supported by jest-expo 57 |
| `jest-expo` | 57.0.5 | npm install -D (root) | SDK 57 preset |
| `babel-jest` | 29.7.0 | npm install -D (root) | same release as jest; jest.sim.config.js names it |
| `@react-native/jest-preset` | 0.86.3 | npm install -D (root) | jest-expo peer; must equal the React Native version |
| `@testing-library/react-native` | 14.0.1 | npm install -D (root) | async API |
| `test-renderer` | 1.2.0 | npm install -D (root) | the React 19.2 line; 1.3.0 targets React 19.3 (SDK 58) |
| `fast-check` | 4.10.2 | npm install -D (root) | property tests |
| `jest-image-snapshot` / `@types/jest-image-snapshot` | 6.5.2 / 6.4.2 | npm install -D (root) | board pixel goldens |
| `pixelmatch` / `pngjs` / `@types/pngjs` | 7.2.0 / 7.0.0 / 6.0.5 | npm install -D (root) | headless-Skia diff script (pixelmatch 7 is ESM only) |
| `@stryker-mutator/core`, `/jest-runner`, `/typescript-checker` | 10.0.0 | npm install -D (root) | mutation testing |
| `eslint` | 9.39.5 | npm install -D (root) | ESLint 10 breaks eslint-plugin-react inside eslint-config-expo 57 (ESLint 9 is EOL since 2026-08-06; dev-only) |
| `eslint-config-expo` | 57.0.2 | npm install -D (root) | brings react, react-hooks 7.1.1 and import 2.32.0 |
| `typescript-eslint` | 8.70.1 | npm install -D (root) | peer typescript <6.1.0 |
| `eslint-plugin-sonarjs` | 4.2.1 | npm install -D (root) | cognitive complexity; LGPL-3.0, dev-only (never shipped) |
| `eslint-plugin-react-native` | 5.0.0 | npm install -D (root) | style rules; peer <= ESLint 9 |
| `@react-native/eslint-plugin` | 0.86.3 | npm install -D (root) | no-deep-imports; must equal the React Native version |
| `eslint-plugin-check-file` | 3.3.2 | npm install -D (root) | kebab-case files and folders |
| `eslint-plugin-jest` | 29.16.6 | npm install -D (root) | test rules |
| `eslint-plugin-testing-library` | 7.16.2 | npm install -D (root) | test rules |
| `eslint-plugin-formatjs` | 8.1.0 | npm install -D (root) | no-literal-string-in-jsx only |
| `eslint-config-prettier` | 10.1.8 | npm install -D (root) | last in the flat config |
| `globals` | 17.12.0 | npm install -D (root) | Node globals for JS config files |
| `prettier` | 3.9.9 | npm install -D (root) | 4.0 is an alpha |
| `knip` | 6.38.0 | npm install -D (root) | unused files, exports, dependencies |
| `lefthook` | 2.1.14 | npm install -D (root) | git hooks; postinstall needs approval |
| `@formatjs/cli` | 6.16.32 | npm install -D (root) | `formatjs verify` |
| `@formatjs/icu-messageformat-parser` | 3.5.20 | npm install -D -w packages/tooling | the catalog linter in packages/tooling imports it, so knip needs it listed there |

## Companions and root overrides

Some pins hold only when a second package is pinned with them, because npm would otherwise resolve that package on a range to a release outside the SDK 57 set. `assets/versions.json` records these as `companions` of the row that needs them; `plan-dependency.mjs` prints them with the install command, and `check-deps-policy.mjs` fails a missing companion (`companion`) and a second installed version of any table package or companion (`one-version`).

| Row | Companion | How | Why |
|---|---|---|---|
| `@testing-library/react-native` 14.0.1 | `test-renderer` 1.2.0 | installed in the same command (`npm install -D test-renderer@1.2.0 @testing-library/react-native@14.0.1`) | a `^1.0.0` peer: installed alone, npm picked 1.3.0, the React 19.3 (SDK 58) line (seen 2026-09-29) |
| `@react-navigation/native-stack` 7.19.2 | `@react-navigation/native` 7.4.1, `react-native-screens` 4.26.2, `react-native-safe-area-context` 5.7.0 | installed together (the two native ones with `npx expo install` in every app) | `>= 4.0.0` peers: alone, npm picks the newest release, not the SDK 57 one |
| `react-native-reanimated` 4.5.1 | `react-native-worklets` 0.10.1 | installed together | a 0.10.x peer that Expo pins exactly |
| `jest-expo` 57.0.5 | `@react-native/jest-preset` 0.86.3 | installed together | a `^0.86.3` peer that must equal the React Native version |
| `@stryker-mutator/jest-runner`, `/typescript-checker` 10.0.0 | `@stryker-mutator/core` 10.0.0 | installed together | an exact peer |
| `typescript-eslint` 8.70.1 | the ten `@typescript-eslint/*` packages (`eslint-plugin`, `parser`, `project-service`, `scope-manager`, `tsconfig-utils`, `type-utils`, `types`, `typescript-estree`, `utils`, `visitor-keys`) at 8.70.1 | root `overrides` | `eslint-config-expo` asks for `^8.59.0`; a newer copy at the root next to `typescript-eslint`'s own crashes ESLint with `Cannot redefine plugin "@typescript-eslint"` (seen 2026-09-29 with 8.71.0) |

The root `overrides` hold exactly three kinds of key, and `check-deps-policy.mjs` fails any other (`stale-override`):

1. `react` and `react-native`, at the apps' versions (one React);
2. every package `packages/shell` lists as a `"*"` peer, at the version the apps install (`peer-override`): today `expo` 57.0.25, `@shopify/react-native-skia` 2.6.2, `react-native-gesture-handler` 2.32.0, `react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1, and `react-native-screens` 4.26.2, `react-native-safe-area-context` 5.7.0 and the other native rows once installed;
3. the companions marked "root `overrides`" above (`companion`).

An override moves with its row: an SDK move (`expo-sdk-upgrade`) updates the first two kinds, an upgrade of `typescript-eslint` the third.

## Do not add

`babel-preset-expo` (57.0.13 comes with `expo`), `babel-plugin-react-compiler` (a dependency of `babel-preset-expo`; the compiler is switched on with `experiments.reactCompiler`), `react-dom` and `react-native-web` (no web target; remove the Expo template leftovers). The checks report them as `do-not-add`.

## Held-back majors and their triggers

| Held back | Trigger to revisit |
|---|---|
| ESLint 10 | `eslint-config-expo` ships an `eslint-plugin-react` that supports ESLint 10 (jsx-eslint/eslint-plugin-react PR #4022) |
| TypeScript 7 | typescript-eslint supports TS 7 (it needs the 7.1 API) and Expo's related packages list it |
| Jest 30 | `jest-expo` for our SDK depends on Jest 30 |
| React Navigation 8 | a stable 8.0 release, and Expo documents it |
| Prettier 4 | a stable release and a reviewed formatting diff |
| RNGH 3, Reanimated 4.7, Worklets 0.13, Skia 2.11+ | arrive with SDK 58 via `npx expo install --fix` (the `expo-sdk-upgrade` skill) |
| `react-native` 0.87+ | only through an Expo SDK that pins it |
| `react-native-audio-api` 1.0 | a stable 1.0 release plus a simulator audio smoke test |

## Toolchain outside npm

| Tool | Verified | How it is pinned |
|---|---|---|
| Node.js | 26.4.0 (ships npm 11.17.0) | `.mise.toml`, `.nvmrc`; `engines` `>=22.18` / npm `>=11.17.0` with `engine-strict=true` |
| Xcode | 26.6 (17F113) | selected through `DEVELOPER_DIR`, never `xcode-select` |
| Ruby / CocoaPods | 3.2.2 / 1.17.0 | `.mise.toml`; `gem install cocoapods -v 1.17.0` |
| Maestro CLI | 2.10.0 | zip + SHA-256 into `tools/maestro` |

Node 26 becomes LTS on 2026-10-28; after that, move to the newest 26.x LTS that is at least 7 days old with a full verify run, and update `.mise.toml`, `.nvmrc` and this table together.

## Native pods

Pods follow the npm versions because the podspecs pin them exactly. As resolved on 2026-09-26: Google-Mobile-Ads-SDK 13.6.0, GoogleUserMessagingPlatform 3.1.0, openiap 3.6.0, hermes-engine 250829098.0.17. CocoaPods has no age gate; the vendor-pod allowlist in the network audit catches any new trunk pod. With the audio plugin options `disableFFmpeg` and `disableStaticExternalLibs`, `react-native-audio-api` downloads no prebuilt binaries.

## Re-verifying versions (they age)

Run these before trusting a version if the table's date is more than a few weeks old:

```sh
npm view expo dist-tags                       # latest / sdk-57 / next
npm view react-native dist-tags               # compare only; never install by hand
curl -s https://api.expo.dev/v2/versions/latest | node -e "
  let s = ''; process.stdin.on('data', (c) => { s += c; }).on('end', () => {
    const v = JSON.parse(s).data.sdkVersions;
    for (const sdk of ['57.0.0', '58.0.0']) {
      const x = v[sdk] ?? {};
      console.log(sdk, x.facebookReactNativeVersion, x.facebookReactVersion, JSON.stringify(x.relatedPackages));
    }
  });"
node -p "require('expo/bundledNativeModules.json')['jest-expo']"   # expo install --check ignores root devDependencies
(cd apps/<game> && npx expo install --check && npx expo-doctor)
npm view <package> version time --json        # age check against the 7-day policy
npm outdated                                  # at the root
```

Checked again on 2026-09-28: `expo` dist-tags `latest` = 57.0.25, `next` = 58.0.0-preview.7 (preview.8 appeared at 12:25 UTC the same day); the versions API lists SDK 57 with React Native 0.86.3 / React 19.2.3 and SDK 58 with 0.88.0-rc.1 / 19.3.0 (related `typescript ~6.0.3`, `jest ~29.7.0` for both).
