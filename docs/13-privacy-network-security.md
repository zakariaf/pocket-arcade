# 13 · Privacy, network security and the release audit

> **What this doc decides.** How the promise "our own code makes no network requests" (spec N3) is enforced in six automated layers, with the script behind each one; how the iOS privacy manifest is aggregated from every pod and what feeds the App Store "App Privacy" answers; how the App Store Connect `.p8` key is handled; the supply-chain guards and the banned-SDK list; the runtime network guard; and the release audit that proves a store build carries no debug code, no Google test ad IDs and no StoreKit test artefacts.
> **Binding source:** [99-final-decisions.md](99-final-decisions.md) items 10, 24, 27, 43 and 44 (plus 9, 23, 25, 26), as amended by section H (O1 tracking, O4 IDs). Other owners: ESLint config `docs/04`, versions and the banned npm list `docs/01`, scripts/hooks/licence audit `docs/16`, build variants and the store-artifact gate `docs/14`. Problems found while writing are listed under [Open issues](#open-issues).
> **Related docs:** [01-stack-and-versions.md](01-stack-and-versions.md) (banned packages), [04-code-style-and-limits.md](04-code-style-and-limits.md) (layer A lint), [07-testing-and-tdd.md](07-testing-and-tdd.md) (the E2E runner (layer F)), [11-ads-admob.md](11-ads-admob.md) (AdMob privacy), [12-in-app-purchase.md](12-in-app-purchase.md) (expo-iap bans), [14-ios-build-and-release.md](14-ios-build-and-release.md) (the store-artifact gate), [16-quality-gates-hooks-ci.md](16-quality-gates-hooks-ci.md) (licence audit and gated paths). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

---

## 1. Introduction

The spec allows exactly two network-capable components in a game app (N3):

| Component | npm package | Native code that may talk to the network | Why it is allowed |
|---|---|---|---|
| (a) AdMob ads + consent | `react-native-google-mobile-ads` 17.2.0 | pods `Google-Mobile-Ads-SDK` 13.6.0, `GoogleUserMessagingPlatform` 3.1.0; JS dependency `@iabtcf/core` | spec 4.1: ads are downloaded from Google |
| (b) Store purchases | `expo-iap` 5.8.0 | pod `openiap` 3.6.0 → StoreKit 2 (system daemon) | spec 4.1: the purchase is confirmed by Apple |

`expo-tracking-transparency` (Apple's App Tracking Transparency prompt, FINAL H.1) is not a network component: its JS and Swift make no request (read in the 57.0.2 tarball), so it is not on this list and N3 is unchanged.

Everything else — React Native, Expo, Skia, SQLite, audio — contains network-capable code that we never call. "Never call" is not provable by reading once; it is kept true by six layers that run on every `npm run verify`, every release and the E2E smoke run:

| Layer | What it catches | Where it runs | Owner of the code |
|---|---|---|---|
| **A. Lint** | our own code: `fetch`/XHR/WebSocket/EventSource, remote URL literals, banned imports, vendor SDKs outside adapters | `npm run lint`, pre-commit | `docs/04` (rules), this doc (policy) |
| **B. JS bundle** | any shipped JS module that can open a connection, first-party or third-party | `npm run audit:network` (`expo export` + source map) | this doc |
| **C. Native modules** | network-capable native code in every autolinked iOS module | `npm run audit:network` | this doc |
| **D. Vendor pods** | a new binary SDK from the CocoaPods trunk | `npm run audit:network` after prebuild | this doc |
| **E. Config** | OTA updates, ATS exceptions, banned plugin options, banned npm packages | `npm run audit:network` after prebuild | this doc + `docs/01` (banned list) |
| **F. Runtime** | anything the static layers missed: real sockets while the app runs | E2E smoke flow on the simulator (Release, test variant, `ADS_MODE=off`) | this doc + docs/07 |

Developer tooling (`packages/tooling`, Expo CLI, npm, `expo-doctor`) may use the network; N3 covers the app bundle only.

---

## 2. Rules

1. **Our code never calls `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `navigator.sendBeacon`, and contains no `http(s)://`, `ws(s)://` or `ftp://` literal**, except the OS hand-off links in `packages/shell/src/config/external-links.ts` (store page, privacy policy, `mailto:`).
   *Why:* spec N3. Remote images, fonts and downloads make requests without `fetch`, so URL literals are banned too (`docs/04` layer A, verified selectors).
2. **Vendor SDKs are imported only by their adapters** (`packages/shell/src/services/*/*-adapter.ts`); `react-native-google-mobile-ads` and `expo-iap` are the only network-capable ones.
   *Why:* FINAL F and `docs/04` rule 18; the allowlist stays at exactly two components.
3. **`npm run audit:network` must pass** for every app before a push (`verify`) and before every release; a new finding needs a baseline entry with a reason, committed with a `Gate-Change:` trailer and approved by the owner.
   *Why:* FINAL 44; baselines are gated paths (`docs/16`).
4. **No first-party module may appear in the JS layer's findings.** Any hit outside `node_modules` fails immediately, whatever the baseline says.
   *Why:* our code is exactly what N3 forbids.
5. **Only three vendor pods may come from the CocoaPods trunk: `Google-Mobile-Ads-SDK`, `GoogleUserMessagingPlatform`, `openiap`.** Everything else must be built from `node_modules`.
   *Why:* a binary SDK bypasses layers A–C; the trunk list in `Podfile.lock` is exact (verified).
6. **Only Google's pods may declare `NSPrivacyTracking` or tracking domains.** `npm run audit:privacy` fails otherwise.
   *Why:* N2 (no analytics, no crash reporting). Asking for ATT (FINAL H.1) does not change this: Google's SDK is what tracks, and it declares that in its own manifest.
7. **Keep `expo.updates.enabled: false`, never install `expo-updates` or `expo-dev-client`, never allow `NSAllowsArbitraryLoads`, never give `expo-iap` plugin options or set `ios.onside.enabled`, never pass GMA's `userTrackingUsageDescription`. Always configure `expo-tracking-transparency`'s plugin with the en `userTrackingPermission`, and the translated `NSUserTrackingUsageDescription` in `expo.locales` for de, fa and ckb.**
   *Why:* OTA updates and dev clients are network components; `iapkitApiKey` and the Onside switches add servers (docs/12 rule 3; FINAL 23, 25, 44). `NSUserTrackingUsageDescription` has one writer, and the app crashes when it uses ATT without the key (FINAL H.1, docs/11 rule 21).
8. **Ban `@react-native-community/netinfo`; online detection is `expo-network` behind `ConnectivityPort`.**
   *Why:* NetInfo's default reachability probe fetches `clients3.google.com` from our JS bundle; `expo-network` uses `NWPathMonitor` with no HTTP probe (FINAL 27, verified in its iOS source).
9. **Declare every required-reason API that any pod declares in `ios.privacyManifests` (through `withShell`), with `NSPrivacyTracking: false` and no `NSPrivacyTrackingDomains`.** `npm run audit:privacy` runs after every prebuild and fails on a gap or on tracking declared in the app's own manifest.
   *Why:* Apple does not reliably read the manifests of static CocoaPods, so the app manifest must aggregate them (FINAL 24). The tracking keys describe our own code, which neither tracks nor contacts any domain; the tracking Device ID is declared in GMA's own manifest; and iOS fails requests to listed tracking domains for players who have not allowed tracking, so listing Google's ad domains would stop ads for everyone who declines ATT (FINAL H.1). **Source:** [Expo privacy manifests](https://docs.expo.dev/guides/apple-privacy/), [NSPrivacyTracking](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytracking), [NSPrivacyTrackingDomains](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytrackingdomains).
10. **The App Privacy answers in App Store Connect must match the aggregated SDK manifests** (the data list in section 3.4), with Device ID declared as linked and used for tracking by the third-party ads SDK. Our own code collects nothing.
    *Why:* Apple builds a privacy report from the manifests; Google makes the developer responsible for the match. **Source:** [Google data disclosure](https://developers.google.com/admob/ios/privacy/data-disclosure).
11. **Never open, print, copy, move, commit or log the `.p8` key, and never print a JWT made from it.** Only `packages/tooling/src/asc/asc-credentials.ts` reads it, into memory; tools get `ASC_KEY_ID`, `ASC_ISSUER_ID`, `APPLE_TEAM_ID`.
    *Why:* FINAL 10; env-var names fixed by `docs/14`. A leaked team key can publish apps.
12. **Pin exact versions, commit the lockfile, install with `npm ci`, keep the 7-day release-age cooldown and approve every install script.**
    *Why:* FINAL 43. The policy files are owned by `docs/01` (`.npmrc`) and `docs/16` (checks).
13. **Every npm package that ships in a release bundle has an allowed licence** (MIT, BSD, Apache-2.0, ISC, 0BSD, OFL, CC0); `npm run audit:licenses` checks exactly the shipped set.
    *Why:* FINAL 43; build tools (for example Expo CLI's `lightningcss`, MPL-2.0) are not shipped and must not fail the audit (`docs/16` section 9.3).
14. **Test builds install the JS network guard; E2E asserts "network attempts: 0" and samples the app's sockets with `lsof`.** Store builds never contain the guard.
    *Why:* FINAL 44 layer F; spec 8.13 airplane-mode and network audits.
15. **A store build is released only when the release audit passes:** no test-only module (sentinel `SHELL_TEST_BUILD_ONLY`), no Google sample publisher ID outside the AdMob library, a live `GADApplicationIdentifier`, no `*.storekit`, no `*.xctest`, no `get-task-allow`, no StoreKit test code. A test build contains none of the game's real ad IDs (unit test plus `GADApplicationIdentifier` check).
    *Why:* spec S15 and 8.8, FINAL 9 and 26; `docs/14` step 7 runs the binary part, this doc's `release-bundle-checks.ts` the JS part.

---

## 3. Details

### 3.1 The npm scripts

The names and paths are the contract in `docs/16`:

```json
{
  "scripts": {
    "audit:network": "node packages/tooling/src/audit/audit-network.ts",
    "audit:privacy": "node packages/tooling/src/audit/audit-privacy.ts",
    "audit:licenses": "node packages/tooling/src/audit/audit-licenses.ts"
  }
}
```

Files owned by this doc, all in `packages/tooling/src/audit/`:

```
audit-network.ts            runner: layers B-E for every app
bundle-modules.ts           source-map reader shared by B, the release audit and audit:licenses
network-baseline.ts         baseline comparison
network-js-layer.ts         layer B
network-native-layer.ts     layer C
network-pods-layer.ts       layer D
network-config-layer.ts     layer E
network-runtime-layer.ts    layer F (lsof parsing)
sample-sockets.ts           layer F sampler process, spawned by the E2E runner
release-bundle-checks.ts    JS part of the release audit
audit-privacy.ts            privacy-manifest aggregation
privacy-manifest.ts         plist reading and reason merging
packages/tooling/network-audit/js-baseline.json      (Gate-Change path)
packages/tooling/network-audit/native-baseline.json  (Gate-Change path)
```

`audit-licenses.ts` is defined in `docs/16` and reads the `dist-audit/<game-id>/` exports that `audit:network` writes.

### 3.2 The six layers

#### Layer A: lint (our code)

`docs/04` owns `eslint.config.mjs`; the N3 entries it must keep (all verified to fire on a deliberately bad file):
- `no-restricted-globals`: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`.
- `no-restricted-syntax`: `Literal[value=/^(https?|wss?|ftp):\/\//i]` and `TemplateElement[value.raw=/^(https?|wss?|ftp):\/\//i]`, exempt only in `packages/shell/src/config/external-links.ts`.
- `no-restricted-imports`: `axios`, `@react-native-community/netinfo`, `expo-updates`, `expo-web-browser`, `react-native-webview`, `expo-file-system`, `react-native-purchases`, `react-native-iap`, the vendor SDKs outside their adapters (`expo-tracking-transparency` counts as one: only the ConsentPort adapter may import it, FINAL H.1), and `expo-iap`'s `kitApi`, `KitApiError`, `verifyPurchaseWithProvider`, `verifyPurchase`, `useIAP` everywhere (`docs/12`).
- The N3 rules apply to `apps/*/src` and `packages/{shell,game-kit}/src`, not to `packages/tooling` (the tooling block turns `no-restricted-globals` and the URL selectors off: the SKAdNetwork refresh and the App Store Connect client legitimately use `fetch`).

Lint sees only our code. Everything below looks at what actually ships.

#### Layer B: the release JS bundle

`expo export --platform ios --no-bytecode --source-maps true` produces the same module graph as the Xcode bundling phase, with a source map that names the owner of every module. The layer flags every module whose source can open a connection and groups the findings by npm package.

```ts
// packages/tooling/src/audit/bundle-modules.ts
// Reads the source map of `npx expo export --platform ios --no-bytecode --source-maps true`
// and answers "which shipped module contains X". Shared by audit:network (layer B),
// the release audit and audit:licenses.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type BundleModule = { readonly source: string; readonly content: string };

export function readBundleModules(exportDir: string): BundleModule[] {
  const dir = join(exportDir, '_expo', 'static', 'js', 'ios');
  const mapFile = readdirSync(dir).find((file) => file.endsWith('.js.map'));
  if (mapFile === undefined) throw new Error(`no source map in ${dir}`);
  const map = JSON.parse(readFileSync(join(dir, mapFile), 'utf8')) as {
    sources: string[];
    sourcesContent?: (string | null)[];
  };
  return map.sources.map((source, index) => ({
    source,
    content: map.sourcesContent?.[index] ?? '',
  }));
}

// 'node_modules/@scope/name/...' -> '@scope/name'; first-party files -> null.
export function packageOf(source: string): string | null {
  const match = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(source);
  return match?.[1] ?? null;
}

export function modulesMatching(modules: readonly BundleModule[], pattern: RegExp): string[] {
  return modules.filter((m) => pattern.test(m.content)).map((m) => m.source);
}
```

```ts
// packages/tooling/src/audit/network-js-layer.ts
// Layer B: which shipped JS modules can open a connection. Input: `expo export` source map.
import { packageOf } from './bundle-modules.ts';
import { addFinding } from './network-baseline.ts';

import type { BundleModule } from './bundle-modules.ts';
import type { Findings } from './network-baseline.ts';

const JS_PATTERNS: Readonly<Record<string, RegExp>> = {
  fetch: /\bfetch\(/,
  xhr: /new XMLHttpRequest\b/,
  webSocket: /new WebSocket\(/,
  eventSource: /new EventSource\(/,
  beacon: /\bsendBeacon\(/,
  remoteUrl: /['"`]https?:\/\/(?!localhost|127\.0\.0\.1)[^'"`\s]+/,
};

// First-party modules (no node_modules in the path) must have zero findings: fail directly.
export function jsNetworkFindings(modules: readonly BundleModule[]): {
  readonly findings: Findings;
  readonly firstParty: readonly string[];
} {
  const findings = new Map<string, Set<string>>();
  const firstParty: string[] = [];
  for (const { source, content } of modules) {
    const owner = packageOf(source);
    for (const [category, pattern] of Object.entries(JS_PATTERNS)) {
      if (!pattern.test(content)) continue;
      if (owner === null) firstParty.push(`${source}: ${category}`);
      else addFinding(findings, owner, category);
    }
  }
  return { findings, firstParty };
}
```

```ts
// packages/tooling/src/audit/network-baseline.ts
// Baselines live in packages/tooling/network-audit/*.json (a Gate-Change path, docs/16).
// Every entry carries a reason; an unknown finding fails, a stale entry is reported.
export type BaselineEntry = { readonly categories: readonly string[]; readonly reason: string };
export type Baseline = Readonly<Record<string, BaselineEntry>>;
export type Findings = ReadonlyMap<string, ReadonlySet<string>>;

export function compareToBaseline(findings: Findings, baseline: Baseline): string[] {
  const problems: string[] = [];
  for (const [owner, categories] of findings) {
    const allowed = new Set(baseline[owner]?.categories ?? []);
    const extra = [...categories].filter((category) => !allowed.has(category));
    if (extra.length > 0) problems.push(`NEW ${owner}: ${extra.join(', ')} (not in baseline)`);
  }
  for (const owner of Object.keys(baseline)) {
    if (!findings.has(owner)) problems.push(`STALE ${owner}: in baseline but not found`);
  }
  return problems;
}

export function addFinding(
  findings: Map<string, Set<string>>,
  owner: string,
  category: string,
): void {
  const set = findings.get(owner) ?? new Set<string>();
  set.add(category);
  findings.set(owner, set);
}
```

What the layer found on 2026-09-26 in a Release export of an Expo SDK 57 app with `react-native-google-mobile-ads` 17.2.0 and `expo-iap` 5.8.0 (768 modules, no first-party hits). This is the starting `js-baseline.json`; the pilot app adds its own packages (Skia, Reanimated, SQLite, audio) on the first run, each with a reason:

```json
{
  "react-native": { "categories": ["webSocket", "remoteUrl"], "reason": "RN core: WebSocket module and doc URLs; our code cannot call them (layer A)" },
  "whatwg-fetch": { "categories": ["fetch", "xhr"], "reason": "fetch polyfill installed by RN; unused by our code" },
  "expo": { "categories": ["fetch", "remoteUrl"], "reason": "Expo winter fetch polyfill; unused by our code" },
  "@iabtcf/core": { "categories": ["fetch", "remoteUrl", "xhr"], "reason": "TCF decoder used by react-native-google-mobile-ads (allowed component N3 a); its GVL download is not called" },
  "react-native-google-mobile-ads": { "categories": ["remoteUrl"], "reason": "allowed component (N3 a); documentation links" },
  "expo-iap": { "categories": ["remoteUrl", "fetch"], "reason": "kit-api.ts (IAPKit) is bundled through the index re-export but every entry point is banned (docs/12 rule 3)" }
}
```

Two facts worth knowing: Metro does not tree-shake, so `expo-iap`'s IAPKit client (`https://kit.openiap.dev`) and `react-native-google-mobile-ads`' `TestIds` are in every bundle, used or not. That is why layer A bans the entry points and why the release audit attributes strings by module instead of grepping the raw bundle.

#### Layer C: native modules

```ts
// packages/tooling/src/audit/network-native-layer.ts
// Layer C: network-capable native code in every autolinked iOS module.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { addFinding } from './network-baseline.ts';

import type { Findings } from './network-baseline.ts';

const NATIVE_PATTERNS: Readonly<Record<string, RegExp>> = {
  urlSession: /\b(NS)?URLSession\b|\bNSURLConnection\b/,
  webSocket: /URLSessionWebSocketTask|SRWebSocket|SocketRocket/,
  lowLevelSocket:
    /\bCFSocket|\bCFStreamCreatePairWithSocket|\bNWConnection\b|\bnw_connection_|\bgetaddrinfo\(/,
  webView: /\bWKWebView\b|\bSFSafariViewController\b|\bASWebAuthenticationSession\b/,
};
const SOURCE = /\.(swift|m|mm|h|c|cpp)$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return SOURCE.test(name) ? [path] : [];
  });
}

function autolinking(appDir: string, args: readonly string[]): unknown {
  const json = execFileSync('npx', ['expo-modules-autolinking', ...args], {
    cwd: appDir,
    encoding: 'utf8',
  });
  return JSON.parse(json) as unknown;
}

// name -> package root, from React Native autolinking and Expo module resolution.
export function nativeModuleRoots(appDir: string): Map<string, string> {
  const rn = autolinking(appDir, ['react-native-config', '--platform', 'ios', '--json']) as {
    dependencies?: Record<string, { root: string; platforms?: { ios?: unknown } }>;
  };
  const expo = autolinking(appDir, ['resolve', '--platform', 'apple', '--json']) as {
    modules?: { packageName: string; pods?: { podspecDir: string }[] }[];
  };
  const roots = new Map<string, string>([
    ['react-native', join(appDir, 'node_modules', 'react-native')],
  ]);
  for (const [name, dep] of Object.entries(rn.dependencies ?? {})) {
    if (dep.platforms?.ios !== undefined) roots.set(name, dep.root);
  }
  for (const m of expo.modules ?? []) {
    const podspecDir = m.pods?.[0]?.podspecDir;
    if (podspecDir !== undefined) roots.set(m.packageName, dirname(podspecDir));
  }
  return roots;
}

function scanFile(path: string, owner: string, findings: Map<string, Set<string>>): void {
  const text = readFileSync(path, 'utf8');
  for (const [category, pattern] of Object.entries(NATIVE_PATTERNS)) {
    if (pattern.test(text)) addFinding(findings, owner, category);
  }
}

export function nativeNetworkFindings(roots: ReadonlyMap<string, string>): Findings {
  const findings = new Map<string, Set<string>>();
  for (const [name, root] of roots) {
    for (const file of sourceFiles(root)) scanFile(file, name, findings);
  }
  return findings;
}
```

Result on the same app (14 native modules): `react-native` {urlSession, webSocket}, `expo` {urlSession, webSocket}, `expo-modules-core` {urlSession, webSocket}, `expo-modules-jsi` {urlSession}, `expo-asset` {urlSession}, `expo-file-system` {urlSession}, `@expo/dom-webview` {webView}, `@expo/log-box` {webView, urlSession}, `expo-constants` {webView}. `react-native-google-mobile-ads` and `expo-iap` have no hits: their networking lives in the vendor binaries, which layer D covers. The starting `native-baseline.json` lists exactly these nine with reasons ("capability present, unused, our use of it is lint-banned"). Regex scanning cannot see inside binary `.xcframework`s; layers D and F cover that gap.

#### Layer D: vendor pods

`Podfile.lock` separates pods built from `node_modules` (`EXTERNAL SOURCES`) from pods downloaded from the CocoaPods trunk (`SPEC REPOS: trunk:`). Only the second kind can bring an unreviewed binary SDK.

```ts
// packages/tooling/src/audit/network-pods-layer.ts
// Layer D: vendor pods (downloaded from the CocoaPods trunk, i.e. not built from node_modules)
// must be on the allowlist, and only Google's pods may declare tracking in their manifests.
export const VENDOR_POD_ALLOWLIST: ReadonlySet<string> = new Set([
  'Google-Mobile-Ads-SDK', // react-native-google-mobile-ads (spec N3 (a))
  'GoogleUserMessagingPlatform', // UMP consent, same component
  'openiap', // expo-iap's StoreKit 2 core (spec N3 (b))
]);

// Podfile.lock lists trunk pods under "SPEC REPOS:" -> "  trunk:" -> "    - Name".
export function trunkPods(podfileLock: string): string[] {
  const section = podfileLock.split('\nSPEC REPOS:\n')[1]?.split('\n\n')[0] ?? '';
  return section
    .split('\n')
    .map((line) => /^ {4}- "?([^"\s]+)"?$/.exec(line)?.[1])
    .filter((name): name is string => name !== undefined);
}

export function podProblems(podfileLock: string): string[] {
  return trunkPods(podfileLock)
    .filter((pod) => !VENDOR_POD_ALLOWLIST.has(pod))
    .map((pod) => `vendor pod ${pod} is not on the N3 allowlist`);
}
```

Verified: the trunk list of an SDK 57 app with both SDKs was exactly `Google-Mobile-Ads-SDK`, `GoogleUserMessagingPlatform`, `openiap` (CocoaPods 1.15.2). The tracking half of this layer runs in `audit-privacy.ts` (section 3.3).

#### Layer E: configuration

```ts
// packages/tooling/src/audit/network-config-layer.ts
// Layer E: configuration that would add network paths. Input: `expo config --json --type prebuild`
// of a STORE build. Banned npm packages are checked by docs/01's banned-packages.ts in the same run.
export type PluginEntry = string | readonly [string, unknown];
export type ExpoConfigLike = {
  readonly updates?: { readonly enabled?: boolean };
  readonly plugins?: readonly PluginEntry[];
  readonly locales?: Readonly<Record<string, unknown>>;
  readonly ios?: {
    readonly infoPlist?: Record<string, unknown>;
    readonly onside?: { readonly enabled?: boolean };
  };
};

function pluginOptions(config: ExpoConfigLike, name: string): unknown {
  const entry = (config.plugins ?? []).find((p) => (typeof p === 'string' ? p : p[0]) === name);
  return typeof entry === 'string' || entry === undefined ? undefined : entry[1];
}

// docs/12 rule 1/3: the plugin takes NO options (iapkitApiKey, module: 'onside', modules.onside,
// ios.alternativeBilling, ...), and ios.onside.enabled must stay unset (it adds OnsideKit).
function expoIapProblems(config: ExpoConfigLike): string[] {
  const problems: string[] = [];
  if (pluginOptions(config, 'expo-iap') !== undefined) {
    problems.push('expo-iap plugin must have no options (docs/12 rule 3)');
  }
  if (config.ios?.onside?.enabled === true) problems.push('ios.onside.enabled adds OnsideKit');
  return problems;
}

const optionOf = (options: unknown, key: string): unknown =>
  typeof options === 'object' && options !== null ? Reflect.get(options, key) : undefined;
const isText = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';

// FINAL H.1 (ATT): expo-tracking-transparency's plugin is the one writer of
// NSUserTrackingUsageDescription (GMA's option stays unset), and every language carries the text.
function trackingProblems(config: ExpoConfigLike): string[] {
  const gma = pluginOptions(config, 'react-native-google-mobile-ads');
  const att = pluginOptions(config, 'expo-tracking-transparency');
  const problems: string[] = [];
  if (optionOf(gma, 'userTrackingUsageDescription') !== undefined) {
    problems.push('GMA userTrackingUsageDescription is set; expo-tracking-transparency writes it');
  }
  if (!isText(optionOf(att, 'userTrackingPermission'))) {
    problems.push('expo-tracking-transparency plugin needs userTrackingPermission (FINAL H.1)');
  }
  for (const lang of ['de', 'fa', 'ckb']) {
    const ios = optionOf(config.locales?.[lang], 'ios');
    if (!isText(optionOf(ios, 'NSUserTrackingUsageDescription'))) {
      problems.push(`locales.${lang} lacks NSUserTrackingUsageDescription (FINAL H.1)`);
    }
  }
  return problems;
}

export function configProblems(config: ExpoConfigLike): string[] {
  const problems = [...expoIapProblems(config), ...trackingProblems(config)];
  if (config.updates?.enabled !== false) problems.push('expo.updates.enabled must be false');
  const ats: unknown = config.ios?.infoPlist?.['NSAppTransportSecurity'];
  if (
    typeof ats === 'object' &&
    ats !== null &&
    Reflect.get(ats, 'NSAllowsArbitraryLoads') === true
  ) {
    problems.push('NSAllowsArbitraryLoads must not be true');
  }
  return problems;
}
```

The banned npm packages (`expo-updates`, `expo-dev-client`, NetInfo, RevenueCat, Firebase, Sentry, Expo telemetry, WebViews, …) are `docs/01` section 3.6's list; the runner below checks `package-lock.json` with docs/01's `banned-packages.ts`. Expo's generated `Info.plist` sets `NSAllowsLocalNetworking: true` (seen in a prebuilt app); that only permits local-network loads and stays.

#### The runner

```ts
// packages/tooling/src/audit/audit-network.ts
// `npm run audit:network`: spec N3 layers B-E for every app (layer A is ESLint, layer F runs in
// E2E) plus docs/01's banned-package check. Exports each app as a STORE bundle into
// dist-audit/<game-id>/ (also read by audit:licenses). Pod and config layers need
// `npx expo prebuild` first; otherwise skipped.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { findBannedPackages, inventoryFromLockfile } from '@e07/tooling/deps/banned-packages.ts';

import { readBundleModules } from './bundle-modules.ts';
import { compareToBaseline } from './network-baseline.ts';
import { configProblems } from './network-config-layer.ts';
import { jsNetworkFindings } from './network-js-layer.ts';
import { nativeModuleRoots, nativeNetworkFindings } from './network-native-layer.ts';
import { podProblems } from './network-pods-layer.ts';
import { storeBundleProblems } from './release-bundle-checks.ts';

import type { Baseline } from './network-baseline.ts';
import type { ExpoConfigLike } from './network-config-layer.ts';
import type { Lockfile } from '@e07/tooling/deps/banned-packages.ts';

const ROOT = process.cwd();
const BASELINES = join(ROOT, 'packages', 'tooling', 'network-audit');
// Store bundle without live IDs: ADS_MODE=off is a valid store pair (docs/14) and ships the same JS.
const STORE_ENV = {
  ...process.env,
  APP_VARIANT: 'store',
  EXPO_PUBLIC_APP_VARIANT: 'store',
  ADS_MODE: 'off',
};

function readBaseline(name: string): Baseline {
  return JSON.parse(readFileSync(join(BASELINES, name), 'utf8')) as Baseline;
}

function exportBundle(appDir: string, outDir: string): void {
  const args = ['expo', 'export', '--platform', 'ios', '--no-bytecode', '--source-maps', 'true'];
  execFileSync('npx', [...args, '--output-dir', outDir], {
    cwd: appDir,
    env: STORE_ENV,
    stdio: 'ignore',
  });
}

function jsProblems(outDir: string): string[] {
  const modules = readBundleModules(outDir);
  const { findings, firstParty } = jsNetworkFindings(modules);
  return [
    ...firstParty.map((hit) => `first-party network code: ${hit}`),
    ...compareToBaseline(findings, readBaseline('js-baseline.json')),
    ...storeBundleProblems(modules),
  ];
}

function nativeAndPodProblems(appDir: string): string[] {
  const native = compareToBaseline(
    nativeNetworkFindings(nativeModuleRoots(appDir)),
    readBaseline('native-baseline.json'),
  );
  const lock = join(appDir, 'ios', 'Podfile.lock');
  if (!existsSync(lock))
    return [...native, 'SKIPPED pods/config layers: run npx expo prebuild first'];
  const json = execFileSync('npx', ['expo', 'config', '--json', '--type', 'prebuild'], {
    cwd: appDir,
    env: STORE_ENV,
    encoding: 'utf8',
  });
  return [
    ...native,
    ...podProblems(readFileSync(lock, 'utf8')),
    ...configProblems(JSON.parse(json) as ExpoConfigLike),
  ];
}

function auditApp(gameId: string): string[] {
  const appDir = join(ROOT, 'apps', gameId);
  const outDir = join(ROOT, 'dist-audit', gameId);
  exportBundle(appDir, outDir);
  return [...jsProblems(outDir), ...nativeAndPodProblems(appDir)].map((p) => `${gameId}: ${p}`);
}

// docs/01 section 3.6: banned packages anywhere in the lockfile (HTTP clients: direct only).
function bannedPackageProblems(): string[] {
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as Lockfile;
  return findBannedPackages(inventoryFromLockfile(lock)).map(
    (hit) => `banned package ${hit.name}: ${hit.reason}`,
  );
}

const gameIds = readdirSync(join(ROOT, 'apps')).filter((name) => !name.startsWith('.'));
const problems = [...bannedPackageProblems(), ...gameIds.flatMap(auditApp)];
for (const line of problems) console.error(line);
const failures = problems.filter((line) => !line.includes('SKIPPED') && !line.includes('STALE'));
console.error(`audit:network: ${String(failures.length)} failure(s)`);
process.exitCode = failures.length === 0 ? 0 : 1;
```

Run end to end on 2026-09-26 against the SDK 57 test app with the baselines above: layers B–D passed, layer E correctly failed on the app's missing `updates.enabled: false`, exit code 1. On Linux CI (no Pods) layers D and E print `SKIPPED`; `release:ios` always runs after prebuild, so they run there. `STALE` entries are reported without failing, so the baseline shrinks when a package leaves.

#### Layer F: runtime

Two measurements, both on a Release simulator build of the **test** variant with `ADS_MODE=off` (ads would legitimately open sockets, and WebKit ad traffic runs in separate processes):

1. **JS network guard** (test-only code, reachable only through `docs/14`'s `TEST_ONLY` gate in `packages/shell/src/app/test-only.ts`): replaces `fetch`, `XMLHttpRequest#open` and `WebSocket` with counting, throwing stubs at startup. The debug menu shows "network attempts: N"; every E2E smoke flow ends with `assertVisible: { id: "debug.network-attempts", text: "0" }`.

```ts
// packages/shell/src/screens/debug/network-guard.ts
// TEST VARIANT ONLY: reachable only through TEST_ONLY (packages/shell/src/app/test-only.ts).
// Counts and blocks every JS-level network attempt so E2E can assert "network attempts: 0".
// It cannot see native SDK traffic (AdMob, StoreKit): the lsof runtime layer covers that.
export type NetworkAttempt = {
  readonly kind: 'fetch' | 'xhr' | 'websocket';
  readonly target: string;
};
export type NetworkGuard = { readonly attempts: () => readonly NetworkAttempt[] };

function blockedError(attempt: NetworkAttempt): Error {
  return new Error(`N3: ${attempt.kind} to ${attempt.target} blocked by the network guard`);
}

export function installNetworkGuard(
  scope: object,
  onAttempt: (a: NetworkAttempt) => void,
): NetworkGuard {
  const seen: NetworkAttempt[] = [];
  const record = (attempt: NetworkAttempt): Error => {
    seen.push(attempt);
    onAttempt(attempt); // ErrorLogPort: visible in the debug menu
    return blockedError(attempt);
  };
  Reflect.set(scope, 'fetch', (input: unknown) =>
    Promise.reject(record({ kind: 'fetch', target: String(input) })),
  );
  const xhr: unknown = Reflect.get(scope, 'XMLHttpRequest');
  if (typeof xhr === 'function') {
    Reflect.set(xhr.prototype as object, 'open', (_method: string, url: unknown) => {
      throw record({ kind: 'xhr', target: String(url) });
    });
  }
  Reflect.set(scope, 'WebSocket', function blockedWebSocket(url: unknown): never {
    throw record({ kind: 'websocket', target: String(url) });
  });
  return { attempts: () => seen };
}
```

It is installed with `installNetworkGuard(globalThis, onAttempt)` as the first action of the test-only startup hook (after the Intl polyfills, before any Shell service starts). `onAttempt` records the attempt with `errorLog.record('network', new Error(…))` (`ErrorSource` has a `'network'` value, docs/04 section 6.2). A Jest test drives the guard with a fake scope and asserts that all three kinds are blocked and counted.

2. **Socket sampling.** While the smoke flow runs, the E2E runner samples the app process every second:

```ts
// packages/tooling/src/audit/network-runtime-layer.ts
// Layer F: sample the app's sockets while an E2E flow runs (Release, test variant, ADS_MODE=off).
// StoreKit traffic runs in system daemons and is invisible here (allowed anyway, spec N3 (b)).
import { execFileSync } from 'node:child_process';

const LOOPBACK = /^(127\.|\[::1\]|localhost)/;

// `lsof -nP -i -a -p <pid>` prints one line per socket; "->" marks a connected peer.
export function nonLoopbackConnections(lsofOutput: string): string[] {
  return lsofOutput
    .split('\n')
    .filter((line) => line.includes('->'))
    .filter((line) => {
      const peer = line.split('->')[1]?.trim().split(/\s/)[0] ?? '';
      return !LOOPBACK.test(peer);
    });
}

// The simulator app is a macOS process: find it by its bundle path.
export function appPid(appName: string): string | null {
  try {
    const out = execFileSync('pgrep', ['-f', `${appName}.app/${appName}`], { encoding: 'utf8' });
    return out.trim().split('\n')[0] ?? null;
  } catch {
    return null; // not running
  }
}

export function sampleSockets(pid: string): string[] {
  try {
    const out = execFileSync('lsof', ['-nP', '-i', '-a', '-p', pid], { encoding: 'utf8' });
    return nonLoopbackConnections(out);
  } catch {
    return []; // lsof exits 1 when the process has no sockets
  }
}
```

The sampler runs as its own process, because docs/07's runner blocks on `spawnSync(maestro)`:

```ts
// packages/tooling/src/audit/sample-sockets.ts
// Layer F sampler. Usage: node packages/tooling/src/audit/sample-sockets.ts <AppName> <report>
// The E2E runner (docs/07) spawns it before `maestro test` and kills it afterwards; any line in
// <report> fails the run. One sample per second.
import { appendFileSync } from 'node:fs';

import { appPid, sampleSockets } from './network-runtime-layer.ts';

const [appName, report] = process.argv.slice(2);
if (appName === undefined || report === undefined) {
  throw new Error('usage: sample-sockets.ts <AppName> <report-file>');
}
setInterval(() => {
  const pid = appPid(appName);
  for (const line of pid === null ? [] : sampleSockets(pid)) appendFileSync(report, `${line}\n`);
}, 1000);
```

`run-e2e-ios.ts` (docs/07) starts it with `spawn('node', [sampler, app.name, 'reports/e2e/<game-id>/network.txt'])` right before `maestro test`, kills it afterwards, and fails when the file is not empty. `lsof` works without `sudo` on simulator processes (seen: Mobile Safari's `:443` connections). The simulator has no airplane mode; the "Simulate offline" debug switch plus these two measurements are the airplane-mode test of spec 15.2 on iOS. Dev builds legitimately talk to Metro over WebSockets, so layer F runs on Release builds only.

### 3.3 Privacy manifest aggregation

`withShell` (docs/02 section 9.1) writes the app's manifest through `ios.privacyManifests: PRIVACY_MANIFESTS`. This doc owns the values (verified for SDK 57 + GMA + expo-iap):

```ts
// packages/shell/src/config/privacy-manifest.ts
// Aggregated required-reason APIs of every pod (checked by `npm run audit:privacy`, which
// fails when a pod's PrivacyInfo.xcprivacy declares a category/reason missing here).
export const PRIVACY_MANIFESTS = {
  // Our code neither tracks nor contacts a domain; GMA's own manifest declares its tracking
  // Device ID. No NSPrivacyTrackingDomains: iOS would block them when ATT is declined (FINAL H.1).
  NSPrivacyTracking: false,
  NSPrivacyAccessedAPITypes: [
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
      NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
    },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
      NSPrivacyAccessedAPITypeReasons: ['C617.1'],
    },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
      NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
    },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
      NSPrivacyAccessedAPITypeReasons: ['E174.1'],
    },
  ],
};
```

The list grows when a pod declares something new (for example when the pilot adds SQLite, Skia or the audio library); `audit:privacy` prints the aggregated table and fails on any gap, and the fix is always an entry in this file, never an edit of `ios/`.

```ts
// packages/tooling/src/audit/privacy-manifest.ts
import { execFileSync } from 'node:child_process';

export type ApiDeclaration = {
  readonly NSPrivacyAccessedAPIType: string;
  readonly NSPrivacyAccessedAPITypeReasons: readonly string[];
};
export type CollectedDataType = {
  readonly NSPrivacyCollectedDataType: string;
  readonly NSPrivacyCollectedDataTypeLinked: boolean;
  readonly NSPrivacyCollectedDataTypeTracking: boolean;
};
export type PrivacyManifest = {
  readonly NSPrivacyTracking?: boolean;
  readonly NSPrivacyTrackingDomains?: readonly string[];
  readonly NSPrivacyAccessedAPITypes?: readonly ApiDeclaration[];
  readonly NSPrivacyCollectedDataTypes?: readonly CollectedDataType[];
};

// plutil ships with macOS; it reads both XML and binary plists.
export function readManifest(path: string): PrivacyManifest {
  const json = execFileSync('plutil', ['-convert', 'json', '-o', '-', path], { encoding: 'utf8' });
  return JSON.parse(json) as PrivacyManifest;
}

// category -> set of reason codes, merged over many manifests.
export function mergeReasons(manifests: readonly PrivacyManifest[]): Map<string, Set<string>> {
  const merged = new Map<string, Set<string>>();
  for (const manifest of manifests) {
    for (const api of manifest.NSPrivacyAccessedAPITypes ?? []) {
      const reasons = merged.get(api.NSPrivacyAccessedAPIType) ?? new Set<string>();
      api.NSPrivacyAccessedAPITypeReasons.forEach((reason) => reasons.add(reason));
      merged.set(api.NSPrivacyAccessedAPIType, reasons);
    }
  }
  return merged;
}

// Every (category, reason) a pod declares must also be declared by the app.
export function missingReasons(
  required: Map<string, Set<string>>,
  declared: Map<string, Set<string>>,
): string[] {
  const missing: string[] = [];
  for (const [category, reasons] of required) {
    for (const reason of reasons) {
      if (declared.get(category)?.has(reason) !== true) missing.push(`${category} ${reason}`);
    }
  }
  return missing;
}
```

```ts
// packages/tooling/src/audit/audit-privacy.ts
// `npm run audit:privacy [-- --app <game-id>]` after `npx expo prebuild --platform ios --clean`
// (prebuild runs pod install). Without --app: every app that has ios/Pods. Fails when app.config
// lacks a reason a pod declares, when a pod other than Google's declares tracking, or when no
// app is prebuilt, or when the app's own manifest declares tracking (FINAL H.1). Also prints the
// App Privacy questionnaire input.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { mergeReasons, missingReasons, readManifest } from './privacy-manifest.ts';

import type { PrivacyManifest } from './privacy-manifest.ts';

// Pods allowed to declare tracking or collected data (the AdMob SDKs, spec N3).
const TRACKING_ALLOWED = /\/(Google-Mobile-Ads-SDK|GoogleUserMessagingPlatform)\//;

function podManifests(appDir: string): string[] {
  const pods = join(appDir, 'ios', 'Pods');
  return readdirSync(pods, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('PrivacyInfo.xcprivacy'))
    .map((file) => join(pods, file));
}

function appManifest(appDir: string): PrivacyManifest {
  const json = execFileSync('npx', ['expo', 'config', '--json', '--type', 'public'], {
    cwd: appDir,
    encoding: 'utf8',
  });
  const config = JSON.parse(json) as { ios?: { privacyManifests?: PrivacyManifest } };
  return config.ios?.privacyManifests ?? {};
}

function trackingViolations(paths: readonly string[]): string[] {
  return paths
    .filter((path) => !TRACKING_ALLOWED.test(path))
    .filter((path) => {
      const manifest = readManifest(path);
      const domains = manifest.NSPrivacyTrackingDomains ?? [];
      return manifest.NSPrivacyTracking === true || domains.length > 0;
    });
}

// The app's own manifest describes our code, which neither tracks nor contacts a domain; tracking
// domains listed here would also make iOS fail those requests for players who declined ATT.
function appTrackingProblems(manifest: PrivacyManifest): string[] {
  const domains = manifest.NSPrivacyTrackingDomains ?? [];
  const isTracking = manifest.NSPrivacyTracking === true || domains.length > 0;
  return isTracking ? ['app manifest declares tracking; only the GMA pod may (FINAL H.1)'] : [];
}

// Input for the App Store Connect "App Privacy" questionnaire (a human step).
function collectedData(paths: readonly string[]): string[] {
  return paths.flatMap((path) =>
    (readManifest(path).NSPrivacyCollectedDataTypes ?? []).map((item) => {
      const pod = path.split('/Pods/')[1]?.split('/')[0] ?? path;
      const flags = `linked=${String(item.NSPrivacyCollectedDataTypeLinked)} tracking=${String(item.NSPrivacyCollectedDataTypeTracking)}`;
      return `${pod}: ${item.NSPrivacyCollectedDataType.replace('NSPrivacyCollectedDataType', '')} ${flags}`;
    }),
  );
}

function auditApp(appDir: string): number {
  const paths = podManifests(appDir);
  const required = mergeReasons(paths.map(readManifest));
  const ownManifest = appManifest(appDir);
  const declared = mergeReasons([ownManifest]);
  const problems = [
    ...missingReasons(required, declared).map((gap) => `app.config lacks ${gap}`),
    ...appTrackingProblems(ownManifest),
    ...trackingViolations(paths).map((path) => `tracking declared outside the AdMob pods: ${path}`),
  ];
  for (const [category, reasons] of required)
    console.error(`${category}: ${[...reasons].join(', ')}`);
  for (const line of new Set(collectedData(paths))) console.error(`collected ${line}`);
  for (const problem of problems) console.error(`FAIL ${problem}`);
  console.error(
    `${appDir}: ${String(paths.length)} pod manifests, ${String(problems.length)} problem(s)`,
  );
  return problems.length;
}

const appIndex = process.argv.indexOf('--app');
const gameIds =
  appIndex >= 0
    ? [process.argv[appIndex + 1] ?? '']
    : readdirSync('apps').filter((id) => existsSync(join('apps', id, 'ios', 'Pods')));
if (gameIds.length === 0) console.error('audit:privacy: no prebuilt app (run npx expo prebuild)');
const failures = gameIds.reduce((sum, id) => sum + auditApp(join('apps', id)), 0);
process.exitCode = gameIds.length > 0 && failures === 0 ? 0 : 1;
```

Verified output on the SDK 57 test app (28 pod manifests): required reasons SystemBootTime `35F9.1`, UserDefaults `CA92.1`, DiskSpace `E174.1`, FileTimestamp `C617.1`; the app config of that spike lacked DiskSpace `E174.1`, and the script failed with exactly that gap. If Apple emails `ITMS-91053` (missing API declaration) after an upload, the same script shows which declaration is missing (`docs/14` failure playbook).

### 3.4 App Privacy label guidance

The App Privacy questionnaire is filled in by the owner in App Store Connect (human step G3 in `docs/14`; believed not to be available in the API). Input, from the verified pod manifests:

| Data type | Pod | Linked to user | Used for tracking | Purposes (Google's disclosure page) |
|---|---|---|---|---|
| Device ID | Google-Mobile-Ads-SDK 13.6.0 | yes | **yes** (the third-party ads SDK; the app asks for ATT) | Third-party advertising, analytics |
| Coarse location | GMA; UMP 3.1.0 | yes (GMA), no (UMP) | no | Third-party advertising, analytics |
| Advertising data | GMA | yes | no | Third-party advertising, analytics |
| Product interaction | GMA; UMP | yes (GMA), no (UMP) | no | Third-party advertising, analytics |
| Performance data | GMA; UMP | no | no | Analytics |
| Crash data | GMA | no | no | Analytics |
| Other diagnostic data | GMA | no | no | Analytics |

Our own code collects nothing: no account, no analytics, no crash reporting, no server (N2). Saves, settings, the consent string that UMP stores, and Premium stay on the phone.

**The 5.1.2 decision (made by the owner on 2026-09-30: follow Apple's rules, O1, FINAL H.1).** Guideline 5.1.2(i): "You must receive explicit permission from users via the App Tracking Transparency APIs to track their activity." The GMA manifest marks Device ID as used for tracking, so on iOS the app asks for ATT before the first ad request (after Google's form where required; docs/11 rule 21), and the App Privacy answers are:

| Data type | App Privacy answer |
|---|---|
| Device ID | collected by the third-party ads SDK; **linked to the user; used for tracking**; third-party advertising, analytics |
| Every other row of the table above | as the table says; not used for tracking |

A declined or restricted ATT answer leaves the advertising identifier all zeros and ads still serve, so the answers do not depend on the player's choice. The earlier options (declare tracking without asking; declare no tracking) are retired: the first risked a 5.1.2(i) rejection, the second contradicted the SDK manifest. The ATT prompt is Apple's system dialog with our translated `NSUserTrackingUsageDescription`; the app's own privacy manifest keeps `NSPrivacyTracking: false` with no tracking domains (rule 9).

Other privacy items: the privacy-policy URL (both stores and AdMob require it; the offline copy is S11c), and the `app-ads.txt` file (`docs/11` section 3.11).

### 3.5 Secrets: the App Store Connect key

| Item | Rule | Where it is enforced |
|---|---|---|
| Location | `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`, mode `600`, outside the repo | `docs/14` preflight: `stat -f %Sp` only, never reads the file |
| Identity | a **team** key with the Admin role, created by the owner | human step O3 (`docs/14`) |
| What tools receive | `ASC_KEY_ID`, `ASC_ISSUER_ID`, `APPLE_TEAM_ID` (in `~/.zshenv`, not the repo) | `docs/14` rule 9 |
| Who reads the key | only `packages/tooling/src/asc/asc-credentials.ts`, into memory, to sign a 15-minute ES256 JWT; `altool` reads it itself | `docs/14` section 3.10 |
| Agent file access | `permissions.deny` for `Read(~/.appstoreconnect/**)`, `Read(**/*.p8)`, `Read(**/AuthKey_*)`, `Read(**/*.p12)`, `Read(**/*.mobileprovision)` in `.claude/settings.json` | `docs/16` section 6 |
| Commits | `.gitignore` lists `*.p8`, `AuthKey_*`, `ApiKey_*`, `*.p12`, `*.mobileprovision`, `*.xcarchive`, `*.ipa`; the lefthook `no-secrets` job refuses staged key or signing files even with `git add -f` | `docs/14` step 9, `docs/16` section 4 |

Additional rules owned here:
- **Tokens are secrets too.** Never print the JWT, the `Authorization` header or a full request with headers; error messages from `ascRequest` contain the API's error body only.
- **Scripts that read the key never pass it on a command line or through an environment variable**, and never write it to a temp file.
- **Claude Code's deny rules cover its own file tools and recognised shell file commands**, not arbitrary child processes; that is intended (the release script must read the key), and it is why rule 11 is the real guard. **Source:** [Claude Code permissions](https://code.claude.com/docs/en/permissions).
- **Leak response (human):** revoke the key in App Store Connect → Users and Access → Integrations, create a new team key, replace the file, update `ASC_KEY_ID`/`ASC_ISSUER_ID`. Then check `git log -p -S "BEGIN PRIVATE KEY"` and the reports folder.
- Real AdMob IDs are not secrets (they ship in every store build), but they live only in `game.config.ts` and reach the runtime only in live builds (`docs/11` rule 17).

### 3.6 Supply chain

| Guard | Decision | Owner |
|---|---|---|
| Exact pins | every package exact, except the specifiers `npx expo install` writes for Expo-managed native modules | `docs/01` rules 2–3 |
| Lockfile | `package-lock.json` committed; `npm ci` in CI and for fresh clones | `docs/01` rule 4 |
| Release-age cooldown | `.npmrc` `min-release-age=7`, dated `min-release-age-exclude[]` blocks with an expiry, checked by `check-deps.ts` | `docs/01` 3.4, `docs/16` 9.1 |
| Install scripts | `package.json` `allowScripts` via `npm approve-scripts`; `check-deps.ts` fails unless `npm approve-scripts --allow-scripts-pending` prints "No packages with unreviewed install scripts." (the command exits 0 either way) | `docs/16` 9.2 |
| Licences | `audit:licenses` checks every npm package in the release bundles (MIT, BSD, Apache-2.0, ISC, 0BSD, OFL, CC0; `OR` needs one allowed side); fonts and CC0 sounds are recorded for S11d | `docs/16` 9.3 |
| Banned npm packages | the table and checker in `docs/01` 3.6 (run inside `audit:network`) | `docs/01` |
| Vendor pods | trunk allowlist of exactly three pods (layer D) | this doc |
| Freshness | `npx expo install --check` and `npx expo-doctor` in `verify`; monthly dependency pass | `docs/01` 3.4 |

Verified facts behind the table: npm 11.17.0 defines `min-release-age` (days, "only versions that were available more than the given number of days ago will be installed") and `min-release-age-exclude` (names or globs), and `allow-scripts` for one-off contexts with `package.json` `allowScripts` as the project policy (read in npm's `@npmcli/config` definitions). In the SDK 57 test app, the 27 npm packages that actually ship in the JS bundle were all MIT, Apache-2.0 or ISC, while the lockfile's production closure also contains build-time packages under MPL-2.0, Unlicense, Python-2.0, CC-BY-4.0 and GPL-dual licences (`lightningcss`, `big-integer`, `argparse`, `caniuse-lite`, `node-forge`), which is why the licence audit reads the bundle, not the lockfile.

**Banned SDKs and pods** (in addition to `docs/01`'s npm list). None may appear in `Podfile.lock`, `package-lock.json` or a config plugin list; layer D fails on any trunk pod outside the allowlist anyway, this list names the usual suspects so a failure is recognised at once:

| SDK family | Example pods / packages | Why |
|---|---|---|
| Firebase / Google Analytics | `Firebase*`, `GoogleAppMeasurement`, `@react-native-firebase/*` | backend + analytics (N2); AdMob does not need Firebase (the trunk list above has no `GoogleAppMeasurement`) |
| Crash reporting | `Sentry`, `Bugsnag`, `Crashlytics`, `@sentry/*` | N2 |
| Attribution / analytics | `Adjust`, `AppsFlyerFramework`, `Branch`, `Amplitude`, `Mixpanel`, `Segment` | N2 |
| Purchase servers | `RevenueCat`/`PurchasesHybridCommon`, `react-native-purchases` | N2 (receipts on their servers) |
| Push | `OneSignal`, `expo-notifications` | spec 14 (no push) |
| Alternative billing | `OnsideKit` (from `expo-iap` `modules.onside`) | N2/N3, `docs/12` |
| Facebook | `FBSDKCoreKit`, `FBAudienceNetwork` | N2/N3 |
| Mediation adapters | `GoogleMobileAdsMediation*` | each adds another ad network's SDK; a v1 decision would be needed first |

### 3.7 The release audit

The release audit has two halves: the JS half runs in `audit:network` (step 3 of `release:ios`, on the source-mapped store export), the binary half is `docs/14`'s store-artifact gate (step 7, on the exported IPA).

```ts
// packages/tooling/src/audit/release-bundle-checks.ts
import { modulesMatching, packageOf } from './bundle-modules.ts';

import type { BundleModule } from './bundle-modules.ts';

// Google's sample publisher id may appear ONLY inside the AdMob library itself
// (its TestIds and doc comments are always bundled: Metro does not tree-shake).
const SAMPLE_PUBLISHER = /3940256099942544/;
const DEBUG_SENTINEL = /SHELL_TEST_BUILD_ONLY/; // docs/14 TEST_BUILD_SENTINEL
const STOREKIT_TEST = /StoreKitTest|SKTestSession/;

export function storeBundleProblems(modules: readonly BundleModule[]): string[] {
  const sampleIds = modulesMatching(modules, SAMPLE_PUBLISHER).filter(
    (source) => packageOf(source) !== 'react-native-google-mobile-ads',
  );
  return [
    ...sampleIds.map((s) => `Google sample ad id outside the AdMob library: ${s}`),
    ...modulesMatching(modules, DEBUG_SENTINEL).map((s) => `debug-only module shipped: ${s}`),
    ...modulesMatching(modules, STOREKIT_TEST).map((s) => `StoreKit test code shipped: ${s}`),
    ...modules
      .filter((m) => m.source.includes('/screens/debug/'))
      .map((m) => `debug screen shipped: ${m.source}`),
  ];
}
```

The complete list, with who checks what:

| Check | Build | Half | How |
|---|---|---|---|
| Debug menu / deep links / network guard / StoreKit hooks absent | store | JS | sentinel `SHELL_TEST_BUILD_ONLY` and `/screens/debug/` modules absent from the export (`storeBundleProblems`); `grep -a -c SHELL_TEST_BUILD_ONLY main.jsbundle` = 0 in the IPA (`docs/14` step 7; Hermes bytecode keeps ASCII strings, verified) |
| Google sample ad IDs absent from our code | store | JS | `3940256099942544` only inside `node_modules/react-native-google-mobile-ads/` (verified: `src/TestIds.ts` and `src/types/RequestOptions.ts` contain it in every bundle) |
| Live AdMob app ID | store (`ADS_MODE=live`) | binary | `GADApplicationIdentifier` matches `^ca-app-pub-\d{16}~\d{10}$` and is not the sample ID (`docs/14` step 7) |
| Real ad IDs absent | test | config + binary | the FINAL 23 unit test `ads-config.test.ts` (docs/11): for `test`/`off`, `admobPluginOptions` returns Google's sample app ID and `adUnitsExtra` returns `null`; app code never imports `game.config.ts` (docs/02). Step 7 of `docs/14` checks that `GADApplicationIdentifier` is the sample ID in test builds |
| StoreKit test artefacts absent | store | binary | no `*.storekit`, no `*.xctest` in the IPA; `codesign -d --entitlements - --xml` has no `get-task-allow` (`docs/14` step 7) |
| StoreKit test code absent | store | JS | no `StoreKitTest` / `SKTestSession` strings in shipped modules (the harness is Swift in a test bundle; this guards against a JS shim) |
| No OTA / ATS exceptions / banned plugin options; ATT text in every language | store | config | layer E (`trackingProblems`) |
| App ID `io.applander.*`, no `com.example.*` or other placeholder, no scaffold placeholder AdMob ID, privacy host or support address (`example.com`, `support@example.com`) | store | config + binary | `docs/14` preflight and step 7 (FINAL H.4, H.20) |
| Privacy manifest complete | all | native | `audit:privacy` |
| SKAdNetwork list current | store | config | `refresh-skadnetwork.ts --check` (`docs/11`) |
| fa/ckb review listed (owner step R3, never a gate; FINAL H.20) | store | catalogs | `review-sheet.ts` writes the review CSVs and prints the count; the release goes on (`docs/10`) |

---

## 4. Checklist

- [ ] `npm run lint` clean with the N3 rules of `docs/04` (layer A).
- [ ] `npm run audit:network` passes for every app: no first-party hits, no new JS or native finding without a reasoned baseline entry, trunk pods exactly `Google-Mobile-Ads-SDK`, `GoogleUserMessagingPlatform`, `openiap`, no config problem, no banned package.
- [ ] `npm run audit:privacy` passes after the latest prebuild; the App Privacy answers match its "collected" output, with Device ID used for tracking (section 3.4, FINAL H.1).
- [ ] `npm run audit:licenses` passes.
- [ ] The E2E smoke flow shows "network attempts: 0" and the socket sampler found no non-loopback connection (Release, test variant, `ADS_MODE=off`).
- [ ] Store build: release audit green (sentinel absent, sample IDs only in the AdMob library, live `GADApplicationIdentifier`, no `.storekit`/`.xctest`/`get-task-allow`).
- [ ] Test build: none of the game's real ad IDs present.
- [ ] No key material or tokens in the repo, logs or reports; `.p8` still mode 600; `git grep -n "BEGIN PRIVATE KEY"` finds nothing.
- [ ] Any baseline or allowlist change carries a `Gate-Change:` trailer and the owner's approval.

---

## 5. Sources

- Expo privacy manifests: https://docs.expo.dev/guides/apple-privacy/
- Apple privacy manifest files: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- Apple required-reason APIs: https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api
- NSPrivacyTracking: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytracking
- NSPrivacyTrackingDomains: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytrackingdomains
- App Tracking Transparency, `requestTrackingAuthorization(completionHandler:)`: https://developer.apple.com/documentation/apptrackingtransparency/attrackingmanager/requesttrackingauthorization(completionhandler:)
- AdMob and ATT: https://developers.google.com/admob/ios/ios14
- App Review Guidelines (5.1.1, 5.1.2): https://developer.apple.com/app-store/review/guidelines/
- App privacy details on the App Store: https://developer.apple.com/app-store/app-privacy-details/
- Google Mobile Ads iOS data disclosure: https://developers.google.com/admob/ios/privacy/data-disclosure
- ASIdentifierManager (IDFA without ATT): https://developer.apple.com/documentation/adsupport/asidentifiermanager/advertisingidentifier
- Expo CLI export: https://docs.expo.dev/more/expo-cli/#exporting
- expo-modules-autolinking: https://github.com/expo/expo/tree/main/packages/expo-modules-autolinking
- NetInfo default reachability configuration: https://github.com/react-native-netinfo/react-native-netinfo/blob/master/src/internal/defaultConfiguration.ts
- expo-network: https://docs.expo.dev/versions/latest/sdk/network/
- npm config (`min-release-age`, `allow-scripts`): https://docs.npmjs.com/cli/v11/using-npm/config
- Claude Code permissions: https://code.claude.com/docs/en/permissions
- App Store Connect API keys: https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api

---

## Verified

On 2026-09-26 (macOS, Node 26.4.0, npm 11.17.0, CocoaPods 1.15.2, Xcode 26.6, Expo SDK 57.0.25, RN 0.86.3):

- **Code** (re-checked by the reviewer in `scratchpad/rn/verify-services-i18n`). Every TypeScript file in this doc compiled in docs/04's tsconfig layout (tooling with Node types, the network guard with the app config). It passed docs/04's `eslint.config.mjs` plus docs/05's additions (`--max-warnings 0`) and Prettier 3.9.9. Jest ran the network-guard and lsof-parser tests green, plus a probe of layer E: a bare `'expo-iap'` passes, while `{ module: 'onside' }`, an empty options object and `ios.onside.enabled` fail. Under Node type stripping, `audit-network.ts` ran on a probe root: it reported banned `axios` (direct) and `@react-native-community/netinfo` (transitive) through docs/01's `banned-packages.ts` and skipped `apps/.DS_Store`. `audit-privacy.ts` exited 1 with "no prebuilt app", and `sample-sockets.ts` ran without a matching process and wrote nothing. The canonical config caught the Node-code `Date.now` rule and void-returning arrows in the writer's versions.
- **End to end.** `audit-network.ts` ran against a copy of the services spike app (Expo SDK 57 with `react-native-google-mobile-ads` 17.2.0 and `expo-iap` 5.8.0, prebuilt): `expo export` (768 modules), layers B–E and the store-bundle checks gave the findings reported in section 3.2, and the run failed only on the spike's missing `updates.enabled: false`. `audit-privacy.ts` read 28 pod manifests with `plutil` and reported the reasons and collected data in sections 3.3–3.4, failing on the spike's missing DiskSpace reason.
- **Bundle facts.** String literals are findable in the Hermes-bytecode `main.jsbundle` with `grep -a`; `kit.openiap.dev` and the sample publisher ID are present in every bundle that imports the two libraries.
- **Licences** of the shipped JS packages (27) and of the lockfile's production closure, from the same app.
- **npm 11.17.0** config definitions for `min-release-age`, `min-release-age-exclude` and `allow-scripts` read in its source.
- **Claude Code** permission semantics read in the current permissions documentation.
- **Not verified:** layer F end to end in this session (the `lsof` approach was verified by the quality research on a booted simulator; the parser is unit-tested); the App Privacy questionnaire itself (web UI, human); the pilot app's own baselines (generated on its first `audit:network` run).

On 2026-09-30 (FINAL H.1, reading only): Apple's `NSPrivacyTracking`, `NSPrivacyTrackingDomains` and ATT pages re-read; the GMA 13.6.0 xcframework's `PrivacyInfo.xcprivacy` read with `plutil` (Device ID linked and tracking; no `NSPrivacyTracking` key; no tracking domains); `expo-tracking-transparency` 57.0.2's JS and Swift read (no network code). `trackingProblems` and `appTrackingProblems` are new and have not been compiled or run yet.

**Re-verify** (the SDKs change): after any change to `react-native-google-mobile-ads`, `expo-iap`, Expo SDK or a native dependency, run `npx expo prebuild --platform ios --clean`, `npm run audit:privacy -- --app <game-id>`, `npm run audit:network`, and review every `NEW`/`STALE` line; check `npm view <pkg> version` against `docs/01`.

---

## Open issues

1. **Baselines are per repo, findings per app.** `js-baseline.json` and `native-baseline.json` are shared by all games; a package that only one game uses still needs its entry. If games diverge a lot, split the baselines per app (`network-audit/<game-id>/`).
2. **Resolved (2026-09-30): 5.1.2 vs D4.** The owner chose Apple's rules (O1, FINAL H.1); section 3.4 records the answers.
3. **App Privacy via API.** The questionnaire is believed to be web-only; if the App Store Connect API gains it, a script can fill it from `audit:privacy`'s output.
4. **Resolved: docs/07's `run-e2e-ios.ts` starts the layer F sampler.** It spawns `sample-sockets.ts` before `maestro test`, kills it afterwards, and fails on a non-empty `network.txt`.
5. **Resolved: `ErrorSource` has a `'network'` value** (docs/04 section 6.2, with `'boot'` and `'i18n'`); the test-only guard logs blocked attempts with it.
