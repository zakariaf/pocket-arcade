# Spec N3 in six layers

## Contents

- The promise and the two allowed components
- The six layers at a glance
- Layer A: lint (our code)
- Layer B: the shipped JS bundle
- Layer C: native modules
- Layer D: vendor pods
- Layer E: build configuration
- The runner: npm run audit:network
- Layer F: runtime (network guard and socket sampling)
- Baselines: NEW and STALE findings

## The promise and the two allowed components

Spec N3: "Our own code makes no network requests." The only network traffic in a game app comes from:

| Component | npm package | Native code that may talk to the network | Why it is allowed |
|---|---|---|---|
| (a) AdMob ads + consent | `react-native-google-mobile-ads` 17.2.0 | pods `Google-Mobile-Ads-SDK` 13.6.0, `GoogleUserMessagingPlatform` 3.1.0; JS dependency `@iabtcf/core` | ads are downloaded from Google (spec 4.1) |
| (b) Store purchases | `expo-iap` 5.8.0 | pod `openiap` 3.6.0 -> StoreKit 2 (a system daemon) | the purchase is confirmed by Apple |

Everything else (React Native, Expo, Skia, SQLite, audio) contains network-capable code that we never call. "Never call" cannot be proven by reading once; six layers keep it true on every verify, every release and every E2E smoke run. Developer tooling (`packages/tooling`, Expo CLI, npm, expo-doctor) may use the network; N3 covers the app bundle only. Spec N2 adds: no accounts, no server, no cloud, no analytics, no crash reporting, no remote configuration.

## The six layers at a glance

| Layer | What it catches | Where it runs |
|---|---|---|
| A. Lint | our code: `fetch`/XHR/WebSocket/EventSource, remote URL literals, banned imports, vendor SDKs outside adapters | `npm run lint`, pre-commit; this skill's `audit-repo.mjs` |
| B. JS bundle | any shipped JS module that can open a connection, first-party or third-party | `npm run audit:network` (expo export + source map); this skill's `audit-bundle.mjs` |
| C. Native modules | network-capable native code in every autolinked iOS module | `npm run audit:network` |
| D. Vendor pods | a new binary SDK from the CocoaPods trunk | `npm run audit:network` after prebuild; `audit-repo.mjs` reads `apps/*/ios/Podfile.lock` |
| E. Config | OTA updates, ATS exceptions, banned plugin options, banned npm packages | `npm run audit:network` after prebuild; `audit-repo.mjs` reads the config sources |
| F. Runtime | anything the static layers missed: real sockets while the app runs | E2E smoke flow (Release, test variant, `ADS_MODE=off`) |

## Layer A: lint (our code)

The lint config (owned by the TypeScript and lint rules work) must keep these N3 entries; each was verified to fire on a deliberately bad file:

- `no-restricted-globals`: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`.
- `no-restricted-syntax`: `Literal[value=/^(https?|wss?|ftp):\/\//i]` and `TemplateElement[value.raw=/^(https?|wss?|ftp):\/\//i]`, exempt only in `packages/shell/src/config/external-links.ts` (OS hand-off links: store page, privacy policy, `mailto:`). Layer B exempts the same one file, for URLs only; keep the two exemptions naming the same path.
- `no-restricted-imports`: `axios`, `@react-native-community/netinfo`, `expo-updates`, `expo-web-browser`, `react-native-webview`, `expo-file-system`, `react-native-purchases`, `react-native-iap`; `expo-tracking-transparency` everywhere except `packages/shell/src/services/consent/admob-consent-adapter.ts` (owner decision O1: the one file that asks App Tracking Transparency; the package is a system wrapper with no network code); the vendor SDKs outside their adapters (`packages/shell/src/services/*/*-adapter.ts`); and expo-iap's `kitApi`, `KitApiError`, `verifyPurchaseWithProvider`, `verifyPurchase`, `useIAP` everywhere.
- The rules apply to `apps/*/src` and `packages/{shell,game-kit}/src`, not to `packages/tooling` (the SKAdNetwork refresh and the App Store Connect client legitimately use `fetch`).

Remote images, fonts and downloads make requests without `fetch`, which is why URL literals are banned too. `audit-repo.mjs` repeats these checks without depending on the lint config, so a weakened lint rule cannot hide a violation; it also reports the forms lint's selectors can miss: `globalThis['fetch'](...)`, `new globalThis.WebSocket(...)`, and a network global taken into a variable (`const Socket = WebSocket`, `const send = globalThis.fetch`, rule `network-global`).

## Layer B: the shipped JS bundle

`npx expo export --platform ios --no-bytecode --source-maps true` produces the same module graph as the Xcode bundling phase, with a source map whose `sourcesContent` names the owner of every module. The layer flags every module whose source matches one of: `fetch(`, `new XMLHttpRequest`, `new WebSocket(`, `new EventSource(`, `sendBeacon(`, or a quoted `http(s)://` URL that is not localhost; findings are grouped by npm package (`node_modules/<pkg>/` or `node_modules/@scope/pkg/`).

- A first-party module (no `node_modules` in its path) with any finding fails at once, whatever the baseline says.
- One exception, and only for `remoteUrl`: `packages/shell/src/config/external-links.ts`, the OS hand-off links (store page, privacy policy, `mailto:`, and `licenceTextUrl`'s public licence pages on spdx.org and Google's AdMob terms page for S11d "Show licence text") that settings-and-preferences ships (template and test) for Rate, Contact, Privacy policy and the licences. Every one opens in the OS browser or mail app through `Linking.openURL`; the app itself never loads them. **The lint exemption (layer A) and the audit exemption (layer B, `network-js-layer.ts` and this skill's `audit-bundle.mjs`) name exactly this one file.** A `fetch(` or socket in that file still fails, and so does a URL in any other file, including a copy of it elsewhere. Moving the links to another file means changing both exemptions together, with the owner.
- A third-party finding must be covered by `packages/tooling/network-audit/js-baseline.json` (package -> categories + reason).

Starting baseline (the template), from Release store exports of an Expo SDK 57 app with both SDKs: `react-native` {webSocket, remoteUrl}, `whatwg-fetch` {fetch, xhr}, `expo` {fetch, remoteUrl}, `@iabtcf/core` {fetch, remoteUrl, xhr}, `react-native-google-mobile-ads` {remoteUrl}, `expo-iap` {remoteUrl, fetch} (768 modules, 2026-09-26), plus six packages the verified Shell stack ships, each read in its source on 2026-09-29:

| Package | Category | Why it is unreachable |
|---|---|---|
| `expo-asset` | remoteUrl | `AssetSources.js` builds Expo CDN URLs for dev-server and updates assets; Release builds embed every asset and our code passes no remote source |
| `react-native-worklets` | remoteUrl | docs links inside error messages |
| `react-native-reanimated` | remoteUrl | docs links inside error and logger messages |
| `react-reconciler` | remoteUrl | the react.dev error-decoder link inside production errors |
| `react-native-audio-api` | fetch | `decodeFromRemoteUrl` fetches only when `decodeAudioData` gets an http(s) URL; the sound banks are synthesised in code |
| `@expo/devtools` | webSocket | `WebSocketWithReconnect.js`, the dev-tools plugin client `expo` re-exports; it connects only to a running dev server, which Release builds never have |

Without these six entries the first `npm run audit:network` of the Shell fails with six `NEW` lines; without the external-links exemption it fails with `first-party network code: .../packages/shell/src/config/external-links.ts: remoteUrl`. A game that adds a package with a finding adds its own entry, with a reason, a `Gate-Change:` trailer and the owner's approval.

Metro does not tree-shake: expo-iap's IAPKit client (`https://kit.openiap.dev`) and the AdMob library's `TestIds` are in every bundle, used or not. That is why layer A bans the entry points and why release checks attribute strings by module instead of grepping the raw bundle.

## Layer C: native modules

`network-native-layer.ts` lists every autolinked iOS module (`npx expo-modules-autolinking react-native-config --platform ios --json` and `resolve --platform apple --json`) and scans its `.swift/.m/.mm/.h/.c/.cpp` sources for `URLSession`/`NSURLConnection`, WebSocket classes, low-level sockets (`CFSocket`, `NWConnection`, `getaddrinfo(`) and web views (`WKWebView`, `SFSafariViewController`, `ASWebAuthenticationSession`). Result on the SDK 57 test app (14 native modules): `react-native`, `expo`, `expo-modules-core`, `expo-modules-jsi`, `expo-asset`, `expo-file-system`, `@expo/dom-webview`, `@expo/log-box`, `expo-constants`: the nine entries of `native-baseline.json`. The two SDKs have no hits here: their networking lives in the vendor binaries, which layer D covers. Regex scanning cannot see inside binary `.xcframework`s; layers D and F cover that gap.

Three rules keep the walk correct in an npm-workspaces repo (each once crashed or skewed a real run; `network-native-layer.test.ts` builds such a repo on disk and proves all three):

- **react-native is resolved, never assumed.** npm hoists it to the repo root, so `apps/<game>/node_modules/react-native` does not exist (the old template crashed with `ENOENT ... apps/<game>/node_modules/react-native`). `installedPackageRoot()` resolves `react-native/package.json` with `createRequire(<app>/package.json)`, the way Node and Metro do.
- **A module's root is the folder with its package.json.** Expo reports the podspec folder, which is the package root for some modules and `ios/` for others; `packageRootOf()` walks up to the nearest `package.json` (taking the podspec folder's parent made all of `node_modules` one module).
- **Symlinks are never followed.** The workspace link `node_modules/@e07/<game>` leads back into the app and its `ios/Pods`, whose CocoaPods header links can dangle; the walk uses `lstat` and skips links.

## Layer D: vendor pods

`Podfile.lock` separates pods built from `node_modules` (`EXTERNAL SOURCES`) from pods downloaded from the CocoaPods trunk (`SPEC REPOS: trunk:`). Only the second kind can bring an unreviewed binary SDK. The trunk list must be exactly `Google-Mobile-Ads-SDK`, `GoogleUserMessagingPlatform`, `openiap` (verified with CocoaPods 1.15.2). Any other trunk pod fails; the banned-SDK table in `references/secrets-and-supply-chain.md` names the usual suspects so a failure is recognised at once.

## Layer E: build configuration

Read from `npx expo config --json --type prebuild` of a store build (and, statically, from the config sources):

- `expo.updates.enabled` must be exactly `false`; `expo-updates` and `expo-dev-client` are never installed (OTA updates and dev clients are network components).
- No `NSAllowsArbitraryLoads: true` (Expo's generated `NSAllowsLocalNetworking: true` only allows local-network loads and stays).
- The expo-iap plugin takes no options (`iapkitApiKey`, `module: 'onside'`, `modules.onside`, `ios.alternativeBilling`, ...), `ios.onside.enabled` stays unset and `EXPO_IAP_ONSIDE` is never set (each Onside switch adds the OnsideKit pod).
- App Tracking Transparency (owner decision O1): with ads enabled the `expo-tracking-transparency` plugin carries `userTrackingPermission` and `locales.<en|de|fa|ckb>.ios.NSUserTrackingUsageDescription` exist (`network-config-layer.ts`; `audit-repo.mjs` rule `att-config` checks the sources); the AdMob plugin never gets its own `userTrackingUsageDescription`, so the text has one source.
- Banned npm packages are checked in the same run with `banned-packages.ts` (anywhere in the lockfile; HTTP clients only as direct dependencies).

## The runner: npm run audit:network

`packages/tooling/src/audit/audit-network.ts` (template) runs layers B-E for every app plus the banned-package check: it exports each app as a store bundle (`APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=off`, a valid store pair that ships the same JS) into `dist-audit/<game-id>/` (also read by `audit:licenses`), compares findings with the baselines, runs the release bundle checks, and, when `apps/<game>/ios/Podfile.lock` exists, the pods and config layers. On Linux CI (no Pods) layers D and E print `SKIPPED`; the release script always runs after a prebuild, so they run there. `STALE` baseline entries are reported without failing, so the baseline shrinks when a package leaves.

Run end to end on 2026-09-26 against the SDK 57 test app: layers B-D passed, and layer E correctly failed on that app's missing `updates.enabled: false` (exit 1).

## Layer F: runtime (network guard and socket sampling)

Both measurements run on a Release simulator build of the test variant with `ADS_MODE=off` (ads would legitimately open sockets, and WebKit ad traffic runs in separate processes). Dev builds legitimately talk to Metro over WebSockets, so layer F runs on Release builds only.

1. **JS network guard** (`packages/shell/src/screens/debug/network-guard.ts`, test builds only, exported by the test-only entry as `installNetworkGuard`; the same file e2e-maestro ships): replaces `fetch`, `XMLHttpRequest#open` and `WebSocket` with throwing stubs. e2e-maestro's `createDebugParts` installs it as its first action in test builds, before `startPremium` and the ad services start, and logs each attempt with `errorLog.record('network', ...)`. The debug menu counts those entries as "network attempts: N", and every E2E smoke flow ends with `assertVisible: { id: "debug.network-attempts", text: "0" }`. It cannot see native SDK traffic.
2. **Socket sampling**: `sample-sockets.ts <AppName> <report> <udid>...` runs next to `maestro test`, one per simulator of the run, and samples the app's copies on the named simulators only (all pids `pgrep -f 'Devices/<udid>/.*\.app/<App>( |$)'` finds, `appProcessPatterns` in `network-runtime-layer.ts`: any bundle folder, because Maestro's `clearState` reinstalls the app as `<bundle id>-<timestamp>.app`; the run's phone and iPad are both watched, another session's simulator never is: its `ADS_MODE=test` copy legitimately talks to Google and would otherwise fail this run, verified on 2026-10-01) every second with `lsof -nP -i -a -p <pid>` (no sudo needed for simulator processes); any non-loopback connected peer is appended to `reports/e2e/<game-id>/network.txt`, and a non-empty file fails the run. StoreKit traffic runs in system daemons and is invisible here (allowed anyway).

The simulator has no airplane mode: the debug "Simulate offline" switch plus these two measurements are the spec's airplane-mode test on iOS.

An `ADS_MODE=off` build opens no Google socket at all: the ads port is a fake, and the consent port comes from `createConsentPort(adsMode)`, which never calls Google's UMP when ads are off (a UMP consent-info update is an HTTPS request from the app process, not from a system daemon). A Google host in `network.txt` right after launch therefore means the consent port was built with `createAdmobConsentAdapter` directly or `isAdsEnabled` ignores `ADS_MODE`; fix the wiring (the ads work), never the sampler or the report.

## Baselines: NEW and STALE findings

- Baselines live in `packages/tooling/network-audit/js-baseline.json` and `native-baseline.json`; every entry carries its categories and a reason ("capability present, unused, our use of it is lint-banned").
- A `NEW` finding fails. Find out why the package can open a connection. If the capability is unused and unreachable from our code, add an entry with a reason, commit it with a `Gate-Change:` trailer, and get the owner's approval before pushing; otherwise remove the package. First-party findings are never baselined.
- A `STALE` entry (in the baseline, not found) is a note: delete the entry when the package has left.
- Baselines are shared by all games; a package only one game uses still needs its entry. If games diverge a lot, split them per app (`network-audit/<game-id>/`).
