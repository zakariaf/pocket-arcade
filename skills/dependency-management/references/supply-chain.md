# Supply chain: banned packages, install scripts, licences, Expo alignment

What protects the apps from packages nobody reviewed: the banned list, reviewed install scripts, the licence allowlist, Expo's own alignment checks, and the tooling files that run them inside `npm run verify`. Read it before adding any package, when a check names one of these rules, and when a gate in this area fails.

## Contents

- The guards at a glance
- Banned packages (and why each one)
- Banned options and pods (not packages, same reason)
- Install scripts: review, approve, re-approve
- Licences: what may ship
- Expo alignment: expo install --check and expo-doctor
- The tooling files behind the gates
- When a gate in this area fails

## The guards at a glance

| Guard | Rule | Checked by |
|---|---|---|
| Exact pins | every package exact, except the specifier `npx expo install` writes for Expo-managed native modules | `check-deps-policy.mjs` (`pin-exact`, `expo-spec`) |
| Lockfile | `package-lock.json` committed; fresh clones and CI use `npm ci` | `check-deps-policy.mjs` (`lockfile-missing`, `lockfile-sync`) |
| Release age | `min-release-age=7`; exceptions only in dated blocks | `check-deps.ts` in `verify`; `check-deps-policy.mjs` (`npmrc-policy`, `npmrc-exclude`) |
| Install scripts | `allowScripts` in the root `package.json`, one reviewed package at a time | `check-deps.ts`; `check-deps-policy.mjs` (`install-scripts`, `stale-approval`) |
| Banned packages | the list below, anywhere in the lockfile (HTTP clients: as direct dependencies) | `check-deps.ts`, the network audit, ESLint `no-restricted-imports`; `check-deps-policy.mjs` (`banned`) |
| Licences | shipped code only under MIT, ISC, Apache-2.0, BSD-2/3-Clause, 0BSD, OFL-1.1, CC0-1.0 | `npm run audit:licenses`; `plan-dependency.mjs --online` (`licence`) |
| Expo alignment | `npx expo install --check` and `npx expo-doctor` pass in every app | `check-deps.ts` |
| Vendor pods | only `Google-Mobile-Ads-SDK`, `GoogleUserMessagingPlatform` and `openiap` come from the CocoaPods trunk | the network audit (the `privacy-and-network-audit` skill) |

## Banned packages (and why each one)

The spec forbids our code from reaching the network (N1 to N3) and forbids analytics, crash reporting and servers (N2). Each package below adds a server, telemetry or a network probe, or duplicates a decided part of the stack. `assets/banned-packages.json` holds the same list as patterns for the scripts.

| Package(s) | Reason | Use instead |
|---|---|---|
| `expo-router` | The Shell owns one React Navigation 7 static stack; Expo Router (SDK 56+) forbids `@react-navigation/*` imports in app code | `@react-navigation/native` + `native-stack` |
| `expo-updates` | OTA updates are network traffic; also keep `updates.enabled: false` | `reloadAppAsync()` from `expo` to restart |
| `expo-dev-client` | Ships a network inspector; the project tests Release builds without Metro | Release simulator builds |
| `@react-native-community/netinfo` | Its default reachability check fetches `https://clients3.google.com/generate_204` from our bundle | `expo-network` behind `ConnectivityPort` |
| `expo-audio` | Its plugin adds `NSMicrophoneUsageDescription`, background audio and Android record permissions by default | `react-native-audio-api` 0.13.6 |
| `react-native-purchases`, `react-native-purchases-ui` | RevenueCat: every purchase goes through its servers | `expo-iap` behind `PurchasePort` |
| `react-native-iap` | A second IAP stack (Nitro) with the same core | `expo-iap` |
| `firebase`, `@react-native-firebase/*` | A backend and analytics | nothing (AdMob does not need Firebase) |
| `@sentry/*`, `sentry-expo`, `@bugsnag/*`, `@datadog/*` | Crash reporting services | the local error log (`ErrorLogPort`) |
| `expo-insights`, `expo-observe`, `expo-app-metrics` | Expo telemetry services | nothing |
| `expo-notifications` | The product has no push notifications | nothing |
| `@amplitude/*`, `expo-analytics-amplitude`, `@segment/*` | Analytics | nothing |
| `react-native-webview`, `expo-web-browser` | Web views are a network surface (`@expo/dom-webview` comes with `expo`: allowed installed, banned from imports) | OS hand-off links through `Linking` |
| `expo-tracking-transparency` | No ATT prompt in v1; its plugin writes a tracking string | nothing |
| `react-native-restart` | A pre-1.0 native dependency | `reloadAppAsync()` from `expo` |
| `eslint-plugin-react-compiler` | Superseded by `eslint-plugin-react-hooks` 7 (brought by `eslint-config-expo`) | nothing |
| `axios`, `ky`, `got`, `node-fetch`, `cross-fetch` (direct) | App code makes no requests; tooling uses Node's built-in `fetch` | built-in `fetch` in `packages/tooling` only |

HTTP clients are banned only as direct dependencies, because some tools pull them in transitively (for example `fbjs` pulls `cross-fetch`). Everything else is banned anywhere in `package-lock.json`: if a banned package appears transitively, find the parent with `npm explain <pkg>` and remove the parent.

Also "do not add" (not banned, just wrong): `babel-preset-expo` (57.0.13 comes with `expo`), `babel-plugin-react-compiler` (a dependency of `babel-preset-expo`; the compiler is switched on with `experiments.reactCompiler: true`), `react-dom` and `react-native-web` (no web target; the Expo template leftovers). The checks report them as `do-not-add`.

## Banned options and pods (not packages, same reason)

Some installed packages are fine while one of their options is not. Other skills enforce these; know them so an install never re-enables one:

- `expo-iap`: the exports `kitApi`, `KitApiError`, `verifyPurchaseWithProvider`, the plugin options `iapkitApiKey` and `modules.onside`, and `ios.onside.enabled` (they add servers).
- `react-native-google-mobile-ads`: the plugin option `userTrackingUsageDescription` (no ATT in v1).
- Maestro: the commands `assertWithAI`, `assertNoDefectsWithAI`, `extractTextWithAI` (they upload screenshots to an LLM service).
- Pods: none of `Firebase*`, `GoogleAppMeasurement`, `Sentry`, `Bugsnag`, `Crashlytics`, `Adjust`, `AppsFlyerFramework`, `Branch`, `Amplitude`, `Mixpanel`, `Segment`, `RevenueCat`/`PurchasesHybridCommon`, `OneSignal`, `OnsideKit`, `FBSDKCoreKit`, `FBAudienceNetwork`, `GoogleMobileAdsMediation*` may appear in `Podfile.lock`. Only three pods may come from the CocoaPods trunk at all (see the table above). CocoaPods has no age gate; pods follow the npm pins because the podspecs pin them exactly (as resolved on 2026-09-26: Google-Mobile-Ads-SDK 13.6.0, GoogleUserMessagingPlatform 3.1.0, openiap 3.6.0).

## Install scripts: review, approve, re-approve

npm 11.17 lists every package whose install script is not yet approved in the root `package.json` `allowScripts`, and says "A future release will block unreviewed install scripts". The workflow:

```sh
npm approve-scripts --allow-scripts-pending    # read-only list; exits 0 whether or not something is pending
npm view <pkg>@<version> scripts               # read what preinstall/install/postinstall run
npm approve-scripts <pkg>                      # approve ONE package, pinned to the installed version
npm approve-scripts --allow-scripts-pending    # must print: No packages with unreviewed install scripts.
```

- Approvals are pinned (`"lefthook@2.1.14": true`), so a version bump needs a fresh review and approval; `check-deps-policy.mjs` reports the old pin as `stale-approval`.
- `npm approve-scripts` is not workspace-aware: approvals always live in the root `package.json`.
- Registry installs run `preinstall`, `install` and `postinstall`; `prepare` runs only for git or local sources.
- Never `npm approve-scripts --all`. If a script does something unexpected (downloads a binary from an unknown host, reads the home folder), deny it (`npm deny-scripts <pkg>`) and stop and ask the owner.

Expected approvals on the SDK 57 set:

| Package | Script | What it does |
|---|---|---|
| `lefthook@2.1.14` | postinstall `node postinstall.js` | installs the platform binary of the git-hook runner |
| `unrs-resolver@1.12.2` | postinstall `node postinstall.js` | picks the native resolver binary used by the ESLint import resolver (from `eslint-config-expo`) |
| `@shopify/react-native-skia@2.6.2` | postinstall `node scripts/install-libs.js` | copies about 205 MB of iOS xcframeworks into `libs/`; an empty `libs/ios` breaks the iOS build. Skia 2.6.5 and later (SDK 58 ships 2.11.2) have no postinstall, so the approval goes away with that move |
| `fsevents@2.3.3` (optional) | install `node-gyp rebuild` (the pending list shows `install: (install scripts present)`) | the macOS file-watching addon, an optional dependency of `jest-haste-map` through `jest` (`npm explain fsevents`). It sits in the lockfile from the bootstrap and is usually left out by the first `npm install`; any later install on a Mac (an `overrides` change, the first `npx expo install`) installs it and lists it as pending (seen on 2026-09-28 and 2026-09-29). The script compiles the addon locally with node-gyp and downloads nothing; approving it is expected (`npm approve-scripts fsevents`) |

## Licences: what may ship

Every npm package that ends up in a release JS bundle must carry an allowed licence: MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, OFL-1.1 or CC0-1.0. In an SPDX expression, `OR` needs one allowed side and `AND` needs every side.

- `npm run audit:licenses` (`packages/tooling/src/audit/audit-licenses.ts`) reads the source maps that `npm run audit:network` exported (`dist-audit/<game-id>/_expo/static/js/ios/*.map`), finds the package that owns each bundled source, and checks its `license`. Only shipped code is audited: build tools in the lockfile such as Expo CLI's `lightningcss` (MPL-2.0), `caniuse-lite` (CC-BY-4.0), `node-forge` or `argparse` never reach the app and must not fail the audit. In the two SDK 57 probe apps checked on 2026-09-26, every shipped package (27 in one bundle, 52 in the other) was MIT, Apache-2.0 or ISC.
- Dev-only tools may use other licences: `eslint-plugin-sonarjs` is LGPL-3.0-only and is never shipped.
- An exception is an entry in `packages/tooling/license-exceptions.json`: `{ "<package>": { "license": "<exact SPDX>", "reason": "<why it is acceptable>" } }`. It applies only while the package keeps that exact licence. The file is a gated path (`Gate-Change:` trailer), and every entry needs the owner's agreement.
- Fonts and sounds are not npm packages; their licences (OFL-1.1 fonts, CC0 sounds) are recorded for the in-app licences screen by the skills that add them.
- Before installing, `plan-dependency.mjs <pkg>@<v> --root . --online` prints the licence and fails (`licence`) on a shipped package outside the allowlist.

## Expo alignment: expo install --check and expo-doctor

- `npx expo install --check`, run inside each app, compares the app's Expo-managed dependencies with the SDK's module map (`expo/bundledNativeModules.json`) and prints `Dependencies are up to date` when they match. It does not look at root devDependencies: compare `jest-expo` by hand with `node -p "require('expo/bundledNativeModules.json')['jest-expo']"`.
- `npx expo install --fix` rewrites mismatched Expo-managed specifiers to the SDK's; run it in every app, never in one.
- `npx expo-doctor` runs the project health checks (21 on SDK 57, all passing on the verified set), including duplicate native modules and config problems.
- Both contact Expo's API. That is allowed for development tools (the no-network rule covers the app, not the toolchain); set `EXPO_NO_TELEMETRY=1` in every tooling environment.
- "Duplicate React Native versions in a single monorepo are not supported" (Expo's monorepo guide): the root `overrides` keep one `react` and one `react-native`; `npm ls react react-native` must show one version of each. The same holds for every native module: each one the Shell lists as a `"*"` peer has a root override at the version the apps install (rule 4), or npm may satisfy the peer with its newest release at the root (seen: `react-native-screens` 4.28.0 and `react-native-safe-area-context` 5.10.0 at the root beside the app's 4.26.2 and 5.7.0), and `expo-doctor` reports duplicate native modules.
- A patch that Expo published in the last 7 days makes both checks report a mismatch overnight (`expo@57.0.25 - expected version: ~57.0.26`). `check-deps.ts` turns that into a `WARN` line with the due date until the patch is 7 days old (the release-age reference, "A new Expo patch inside the 7 days").

## The tooling files behind the gates

`templates/tooling-deps/` holds the tooling files the gates run; the `monorepo-bootstrap` skill writes them at the start, and this skill restores them if they are missing or damaged. Copy each file to the same path under `packages/tooling/`:

| File | What it does |
|---|---|
| `src/deps/check-deps.ts` | the dependency gate, last step of `npm run verify`: dated excludes, banned packages in the lockfile, app lockstep, `expo install --check` and `expo-doctor` in every app, no pending install scripts. Needs the network; offline, `verify` fails here, which is correct |
| `src/deps/release-age-excludes.ts` (+ test) | pure check: `min-release-age=7` present, every exclude inside an unexpired `# exclude-block expires=YYYY-MM-DD reason=…` block |
| `src/deps/banned-packages.ts` (+ test) | the banned list as regexes and the lockfile inventory (direct vs anywhere); also used by the network audit |
| `src/deps/app-lockstep.ts` (+ test) | every package that two apps declare with different specifiers |
| `src/deps/expo-patch-age.ts` (+ test) | pure: parses the `expo install --check` and `expo-doctor` mismatches and decides which are patches younger than 7 days (a `WARN` line with the due date) and which fail |
| `src/clock/system-clock.ts` | the only tooling module that reads the wall clock (`todayIso()` for the expiry check) |
| `src/audit/audit-licenses.ts`, `license-policy.ts` (+ test) | the licence audit described above |
| `license-exceptions.json` | starts as `{}` |

All of them passed `tsc` 6.0.3 (tooling program: `types: ["node", "jest"]`), the project ESLint config with `--max-warnings 0`, Prettier and Jest on 2026-09-28.

## When a gate in this area fails

| Failure | Fix |
|---|---|
| `npm error notarget No matching version found for <pkg>@<v> with a date before …` | the version is younger than 7 days: wait, or (a needed fix, with the owner) add a dated exception (the release-age reference). Never delete the lockfile or the policy line |
| `check-deps: .npmrc line N: expired <pattern>` | delete the whole expired block; nothing reinstalls |
| `check-deps: .npmrc line N: policy-overridden min-release-age=0` | a later line switches the policy off (npm keeps the last value of a key): delete it |
| `npm install` prints "N moderate severity vulnerabilities" | `npm explain <pkg>` for each advisory: under `expo` → `@expo/config-plugins` or a dev tool it is build tooling that does not ship; never `npm audit fix` (it breaks the pins and the SDK) |
| `check-deps: banned package <name>` | `npm explain <name>`, remove the dependency that pulls it in |
| `check-deps: <pkg> differs between apps` | move every app to the same specifier in one commit |
| `check-deps: <app>: expo install --check failed` (or `expo-doctor failed`) | read the listed mismatches. Expected versions at least 7 days old: `npx expo install --fix` in every app, move the versions-table rows and any root override (`expo` has one) in the same commit, then rerun. Anything else (a duplicate native module, a config problem): fix the named cause |
| `check-deps: WARN <app>: expo install --check: expo 57.0.26 (found 57.0.25) was published 2026-09-29; min-release-age=7 refuses it until 2026-10-07 …` | not a failure: an Expo patch younger than 7 days. Change nothing today (no exclude, no `--fix`); on the due date the line becomes a failure, and then the patch moves as in the row above. Name the due date in the report |
| ESLint crashes on every file: `ConfigError: … Key "plugins": Cannot redefine plugin "@typescript-eslint"` | two copies of `@typescript-eslint/eslint-plugin` (`npm ls @typescript-eslint/eslint-plugin`): `eslint-config-expo`'s `^8.59.0` range took a newer release than `typescript-eslint`'s own. Restore the ten `@typescript-eslint/*` root overrides at the `typescript-eslint` pin, remove any `typescript-eslint` or `@typescript-eslint/*` exclude from `.npmrc`, `npm install` |
| `check-deps-policy` `one-version`: `<pkg> is installed as <a>, <b>` | a second copy of a versions-table package floated in on a range. `npm explain <pkg>` shows who pulled it; pin it with a root override at the table version (a companion or Shell peer row says which), `npm install`, and `npm ls <pkg>` must show one version |
| `check-deps-policy` `peer-override`, or `expo-doctor` "Found duplicates for react-native-screens" | a Shell `"*"` peer without its root override: add `"<pkg>": "<the version the apps install>"` to the root `overrides` (plan-dependency prints it), `npm install`. After an SDK move, the expo-sdk-upgrade runbook updates every override |
| `check-deps-policy` `companion`: `<pkg> is installed but its companion <other> is not` | install the pair together with the command plan-dependency prints (RNTL 14.0.1 with `test-renderer` 1.2.0: alone, npm picks `test-renderer` 1.3.0, the SDK 58 line) |
| `check-deps: review install scripts…` | review and approve as above |
| `audit:licenses: <pkg>: licence "…" is not allowed` | replace the package, or ask the owner for an exception entry |
| knip `Unused dependencies` | the package was installed before its code: import it, or uninstall it |
| `check-deps-policy` `unused-dependency` | an app-wide native module nothing imports (knip misses it because the Shell peer counts as a use): write its adapter in the same change, or remove it from every app and the Shell peers |
| knip `Unlisted dependencies` for a native library named by a root config | add it to the root workspace's `ignoreDependencies` in `knip.json` (`Gate-Change:`); never install it at the root |
| npm `ERESOLVE` peer conflict | the requested version is outside the SDK set; go back to the table row. Never `--force` or `--legacy-peer-deps` |
