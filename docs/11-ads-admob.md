# 11 · Ads (AdMob) and consent

> **What this doc decides.** How the Shell shows Google AdMob ads without ever interrupting play (spec N8, 8.8, S3, S4, S7): the `react-native-google-mobile-ads` 17.2.0 setup through its config plugin, the SKAdNetwork list and its refresh script, test IDs and `ADS_MODE`, the `AdsPort` / `ConsentPort` interfaces with their AdMob adapters, the consent sequence (Google UMP, then Apple's App Tracking Transparency prompt), the pure `adPolicy` for spec 8.8, the banner / interstitial / rewarded integration with game-loop pausing, offline behaviour, the privacy notes (App Privacy and guideline 5.1.2), the AdMob-console human steps, and troubleshooting by `error.reason` / `error.phase`.
> **Binding source:** [99-final-decisions.md](99-final-decisions.md) items 19, 23, 24, 27 and D4/D8, as amended by section H (O1 tracking, O4 IDs, L10 the S3 intro only before Google's form, L14 the Shell's consent code). Build variants and the store-artifact gate are owned by `docs/14-ios-build-and-release.md`. Problems found while writing are listed under [Open issues](#open-issues).
> **Related docs:** [02-architecture-and-folders.md](02-architecture-and-folders.md) (port signatures and withShell), [13-privacy-network-security.md](13-privacy-network-security.md) (privacy manifest and 5.1.2), [14-ios-build-and-release.md](14-ios-build-and-release.md) (variants and human steps), [07-testing-and-tdd.md](07-testing-and-tdd.md) (root mock and E2E), [06-navigation-state-persistence.md](06-navigation-state-persistence.md) (the ads section of the save). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

---

## 1. Introduction

Ads are one of only two network-capable components the app may contain (spec N3). Everything else about them is designed so that they can never hurt play:

- **The SDK sits behind two ports.** `AdsPort` (load/show/banner) and `ConsentPort` (Google's UMP consent form and Apple's App Tracking Transparency prompt). Only two vendor-named adapter files import the library. Every Shell test runs against fakes in milliseconds.
- **Every "may an ad appear now?" question is a pure function.** `adPolicy` implements spec 8.8 from explicit inputs (Premium, online, consent, tutorial, counters, time), so each rule has a test.
- **Consent comes first, and the Shell decides when.** Info is refreshed at every launch; Google's form appears after the tutorial and before the first ad request; on iOS, Apple's tracking prompt follows it while the player has not answered it; nothing is initialised or loaded before `canRequestAds` is true and the tracking answer is in.
- **Fullscreen ads pause the game.** On iOS a fullscreen GMA ad does not background the app (AppState stays `active`, per the library's `AGENTS.md`), so the Shell suspends the frame loop and the `AudioContext` itself.
- **Real ad IDs exist only in store builds.** Test builds use Google's sample app ID and `TestIds`; tests and the release gate prove it.

---

## 2. Rules

1. **Install `react-native-google-mobile-ads` at exactly 17.2.0** (`npm install -E`, inside the app workspace; `npx expo install` would write `^17.2.0`). Rollback target: 16.5.0.
   *Why:* v17 is where fixes land; it had three releases in 8 days, so pin exactly (FINAL 23). **Source:** [npm](https://registry.npmjs.org/react-native-google-mobile-ads), [v17.0.0 notes](https://github.com/invertase/react-native-google-mobile-ads/releases/tag/v17.0.0).
2. **Configure it only through its Expo config plugin**, with `iosAppId`, `androidAppId`, `delayAppMeasurementInit: true` and `skAdNetworkItems` (Google's full list). Never pass `userTrackingUsageDescription`: `expo-tracking-transparency`'s plugin is the one writer of `NSUserTrackingUsageDescription` (rule 21).
   *Why:* CNG (no hand-edited `ios/`); a missing `GADApplicationIdentifier` crashes at launch; two plugins writing one Info.plist key fight over it. **Source:** [Expo install guide](https://docs.page/invertase/react-native-google-mobile-ads/installation/expo), plugin source `plugin/src/index.ts` (17.2.0).
3. **Import `react-native-google-mobile-ads` only in `packages/shell/src/services/ads/admob-ads-adapter.ts` and `packages/shell/src/services/consent/admob-consent-adapter.ts`, and `expo-tracking-transparency` only in `admob-consent-adapter.ts`** (plus the Jest root mocks). ESLint `no-restricted-imports` blocks them elsewhere.
   *Why:* FINAL 23 and F (ports and vendor-named adapters). Upgrades touch two files.
4. **Keep the classic create/load/show API in the adapter.** Do not switch to the v17 fullscreen hooks or ad pools.
   *Why:* the Shell preloads at quiet moments and applies caps in pure code. Hooks tie ads to component lifetime. Fullscreen pools start preloading as soon as they are created (on Android they also initialise the SDK), and display pools and multi-format requests need Ad Manager units (library `AGENTS.md`). The library's `AGENTS.md` recommends hooks, so the adapter says in a comment that this is deliberate.
5. **Refresh consent info at every launch, when not Premium and ads are enabled** (`AdsConsent.requestInfoUpdate`). If it fails (offline), use the previous session's `canRequestAds` (`AdsConsent.getConsentInfo`).
   *Why:* Google requires a consent-info update each launch and allows the cached answer when the update fails. **Source:** [UMP iOS guide](https://developers.google.com/admob/ios/privacy).
6. **Show Google's consent form (`loadAndShowConsentFormIfRequired`) only after the tutorial is finished and before the first ad request, and only online.** Never on app start, never during a level.
   *Why:* spec S3. **Source:** [European user consent](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent).
7. **Call `setRequestConfiguration` and `initialize` only when `canRequestAds` is true, and load no ad before `initialize` resolves.**
   *Why:* ads may preload at initialisation; consent must come first (library `AGENTS.md`, Google).
8. **Show the Settings row "Ad privacy choices" only when `privacyOptionsRequirementStatus === 'REQUIRED'`**; it calls `AdsConsent.showPrivacyOptionsForm()`.
   *Why:* Google requires a visible entry point where privacy options are required, and spec S3 shows it "only where consent applies".
9. **Decide every ad appearance with the pure functions in `ad-policy.ts` / `perk-offer.ts`,** fed from game config, the Premium store, `ConnectivityPort`, `ConsentPort` and the persisted `AdHistory`. No ad logic in screens or adapters.
   *Why:* spec 8.8 rules are testable only when they are pure (FINAL 23).
10. **Banners appear only at the bottom of Home, Levels and Statistics**, and only when `shouldShowBanner` is true. The slot has zero height until an ad has loaded.
    *Why:* spec 8.8 and S4 ("no empty box").
11. **Interstitials appear only after the player taps Next / Replay / Try again on the Result screen**, never before the result is visible, and only when `shouldShowInterstitial` is true (not Premium, online, consent handled, tutorial done, at least 3 levels completed in total, at least 3 minutes and 2 completed levels since the last one, never two in a row after losses; numbers from game config).
    *Why:* spec 8.8 and S7.
12. **Rewarded ads are always the player's choice** ("Watch an ad to …"), shown only when `perkOffer` returns `watch-ad`, and the reward is granted only on `RewardedAdEventType.EARNED_REWARD`. While the rewarded ad loads, a continue shows its offer in its loading state (`perkOffer` returns `'loading'`, the screen draws the same offer busy; hints never return `'loading'`); `'hidden'` always means no ad can be served (ads off, offline, a load error, no consent), and then a lost run that no continue can rescue ends at once with its result (lead decision L11, never strand a finished run).
    *Why:* spec 8.8 REWARDED and 8.10.
13. **Suspend the game loop and audio before any fullscreen ad and resume after it closes** (`runFullscreenAd`).
    *Why:* FINAL 19; iOS does not background the app for these ads.
14. **Never show an error, a spinner or a "please connect" message for ads.** A failed load is logged (`ErrorLogPort`) and ignored.
    *Why:* spec 4.1 and 8.8.
15. **Branch on `error.phase` first, then `error.reason`.** Never on the legacy `error.code`.
    *Why:* `code` is deprecated and removed in v18 (`types/AdError.ts`, 17.2.0).
16. **`ADS_MODE` decides the IDs:** `test` → Google's sample app ID + `TestIds.*`; `live` → the game's IDs; `off` → no ads at all. `APP_VARIANT=test` allows only `test`/`off`; `APP_VARIANT=store` only `live`/`off` (matrix in `docs/14`).
    *Why:* spec 8.8 ("development and test builds use only Google's test ads"); invalid-traffic risk on the owner's account.
17. **Real unit IDs reach the runtime only through `expo.extra.adUnits`, which `withShell` fills only when `ADS_MODE=live`.** App code never imports `game.config.ts`.
    *Why:* a test build must not contain the real IDs (spec 8.8); the gate in `docs/14` checks it.
18. **Set `maxAdContentRating: PG` in code and block sensitive categories in the AdMob console.** No `ageRestrictedTreatment` / child-directed tags while D8 stays "general audience".
    *Why:* spec 8.8 (no gambling or sensitive categories); there is no client API for category blocking. **Source:** [AdMob blocking controls](https://support.google.com/admob/answer/2753718).
19. **Refresh the SKAdNetwork list from Google before every release** (`refresh-skadnetwork.ts --check` in `release:ios`).
    *Why:* Google changes the list; the plugin only adds IDs it is given. **Source:** [AdMob iOS quick start](https://developers.google.com/admob/ios/quick-start).
20. **Never ship `AdsConsent.reset()`, a debug geography or the Ad Inspector in a store build.** They are reachable only through the test-only entry (`docs/14`, `TEST_ONLY`).
    *Why:* they change consent behaviour for real users.
21. **On iOS, ask Apple's App Tracking Transparency (ATT) permission before any ad request that could use the IDFA.** Inside `prepareAds`, after Google's form (or with no intro and no form when consent is not required or was given before, FINAL H.16) and only when `canRequestAds` is true, call `consent.requestTracking()` and wait for it before `ads.initialize()`. It shows the system prompt only while the status is `not-determined`, once the app is active. Declined, restricted or unavailable change nothing else: ads load without the IDFA. Install `expo-tracking-transparency` with `npx expo install expo-tracking-transparency@~57.0.2` in every app; its plugin option `userTrackingPermission` writes the base `NSUserTrackingUsageDescription`, and `withShell` localises it for en, de, fa and ckb through `expo.locales` from the copy-deck key `consent.tracking.usage-description`, read straight from the four Shell catalogs (`TRACKING_USAGE_DESCRIPTIONS`, docs/02 section 9.1). `ADS_MODE=off` builds never reach it, because their ConsentPort never runs `prepareAds`.
    *Why:* App Review guideline 5.1.2(i) and the owner's decision O1 (FINAL H.1). Google: "We recommend waiting for the completion callback prior to loading ads so that if the user grants the App Tracking Transparency permission, the Google Mobile Ads SDK can use the IDFA in ad requests." Apple: the app crashes if it uses ATT without `NSUserTrackingUsageDescription`, and the prompt appears only while the status is `notDetermined`, never while tracking is restricted or the app is not active. **Source:** [AdMob iOS 14+](https://developers.google.com/admob/ios/ios14), [requestTrackingAuthorization(completionHandler:)](https://developer.apple.com/documentation/apptrackingtransparency/attrackingmanager/requesttrackingauthorization(completionhandler:)), [NSUserTrackingUsageDescription](https://developer.apple.com/documentation/bundleresources/information-property-list/nsusertrackingusagedescription).

---

## 3. Details

### 3.1 Versions and install

| Item | Version (2026-09-26) | Note |
|---|---|---|
| `react-native-google-mobile-ads` | 17.2.0 exact | peers: `expo >=47`, `react-native >=0.86.0` |
| Google Mobile Ads iOS SDK (pod) | 13.6.0 | resolved by 17.2.0 |
| GoogleUserMessagingPlatform (pod) | 3.1.0 | the UMP consent SDK |
| Android (later) | GMA 25.4.0, UMP 4.0.0, minSdk 24, compile/target 36 | from the package's `sdkVersions` |
| `expo-network` | ~57.0.2 | `ConnectivityPort` adapter (FINAL 27) |
| `expo-constants` | SDK 57 | reads `expo.extra` at runtime |
| `expo-tracking-transparency` | ~57.0.2 (Expo SDK 57 map) | ATT inside the ConsentPort adapter (rule 21). npm `sdk-57` = `latest` = 57.0.2, published 2026-09-11 (past the 7-day age on 2026-09-30); MIT; no network code in its JS or Swift |

```sh
# inside apps/<game>
npm install -E react-native-google-mobile-ads@17.2.0
npx expo install expo-network expo-constants
npx expo install expo-tracking-transparency@~57.0.2   # the table spec, never a bare install
npx expo prebuild --platform ios --clean   # after any plugin option change
```

**Re-verify:** `npm view react-native-google-mobile-ads version time --json` (a new version must be at least 7 days old, `docs/01`), read its release notes, then run the Jest suite, a `ADS_MODE=test` simulator smoke (section 3.14), and `npm run audit:privacy` (the pod manifests change with the SDK).

### 3.2 IDs, `ADS_MODE` and the config plugin

The game's AdMob IDs live in `apps/<game>/game.config.ts` (docs/02 section 8.1 owns the file; this is its `ads` section):

```ts
// apps/line-siege/game.config.ts (ads section)
ads: {
  isEnabled: true, // spec 4.3 master switch; false => ADS_MODE=off for every build
  policy: {
    minLevelsCompletedBeforeFirst: 3,
    minMsBetweenInterstitials: 180_000,
    minLevelsCompletedBetween: 2,
  },
  ids: {
    ios: {
      appId: 'ca-app-pub-1234567890123456~1234567890', // scaffold placeholder; real ID from the owner (A2)
      units: {
        banner: 'ca-app-pub-1234567890123456/1111111111',
        interstitial: 'ca-app-pub-1234567890123456/2222222222',
        rewarded: 'ca-app-pub-1234567890123456/3333333333',
      },
    },
    android: null, // iOS first; filled when Android starts
  },
},
```

The values above are the new-game scaffold's placeholders in the documented format (publisher `1234567890123456`). They look valid, so `assertLiveIds` rejects them by name (FINAL H.4), and so do `check-game-app --stage complete` and the release gates: a game is not complete until the owner supplies the real IDs (step A2, owner step G5 in `docs/14`). The complete stage fails the same way on the scaffold's other owner placeholders, the privacy host `example.com` and the support address `support@example.com` (owner step G3; FINAL H.20, L14). Until the owner supplies real IDs, only `APP_VARIANT=test` (and `store` + `ADS_MODE=off`) can build: `assertLiveIds` throws for anything else.

```ts
// packages/shell/src/config/ads-config.ts
// Runs in Node inside app.config.ts (type stripping): erasable TypeScript, explicit .ts imports.
// ADS_MODE itself is resolved and validated by app-variant.ts (docs/14).
import type { AdsMode } from './app-variant.ts';

export type AdmobUnitIds = {
  readonly banner: string;
  readonly interstitial: string;
  readonly rewarded: string;
};
export type AdmobPlatformIds = { readonly appId: string; readonly units: AdmobUnitIds };
// iOS ships first: the Android AdMob app may not exist yet (null until Android starts).
export type AdmobGameIds = {
  readonly ios: AdmobPlatformIds;
  readonly android: AdmobPlatformIds | null;
};

const GOOGLE_SAMPLE_PUBLISHER = '3940256099942544';
// Google's sample app IDs (developers.google.com/admob/ios/test-ads, .../android/test-ads).
export const GOOGLE_SAMPLE_APP_IDS = {
  ios: `ca-app-pub-${GOOGLE_SAMPLE_PUBLISHER}~1458002511`,
  android: `ca-app-pub-${GOOGLE_SAMPLE_PUBLISHER}~3347511713`,
} as const;

// The new-game scaffold's placeholder publisher: valid in format, never real (FINAL H.4).
const PLACEHOLDER_PUBLISHER = '1234567890123456';

const APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;
const UNIT_ID = /^ca-app-pub-\d{16}\/\d{10}$/;

export function assertLiveIds(ids: AdmobPlatformIds): void {
  const all = [ids.appId, ...Object.values(ids.units)];
  const isValid = APP_ID.test(ids.appId) && all.slice(1).every((unit) => UNIT_ID.test(unit));
  const isSample = all.some((id) => id.includes(GOOGLE_SAMPLE_PUBLISHER));
  const isPlaceholder = all.some((id) => id.includes(PLACEHOLDER_PUBLISHER));
  if (!isValid || isSample || isPlaceholder) {
    throw new Error(`invalid live AdMob ids: ${JSON.stringify(ids)}`);
  }
}

export type AdmobPluginOptions = {
  readonly iosAppId: string;
  readonly androidAppId: string;
  readonly delayAppMeasurementInit: true;
  readonly skAdNetworkItems: readonly string[];
};

// The SDK is linked in every variant, so Info.plist always needs an app ID (missing = crash).
// No userTrackingUsageDescription: expo-tracking-transparency's plugin writes that key (rule 21).
export function admobPluginOptions(
  mode: AdsMode,
  ids: AdmobGameIds,
  skAdNetworkItems: readonly string[],
): AdmobPluginOptions {
  const isLive = mode === 'live';
  if (isLive) assertLiveIds(ids.ios);
  if (isLive && ids.android !== null) assertLiveIds(ids.android);
  return {
    iosAppId: isLive ? ids.ios.appId : GOOGLE_SAMPLE_APP_IDS.ios,
    androidAppId:
      isLive && ids.android !== null ? ids.android.appId : GOOGLE_SAMPLE_APP_IDS.android,
    delayAppMeasurementInit: true,
    skAdNetworkItems,
  };
}

// withShell writes this as expo.extra.adUnits. Real unit IDs reach the runtime ONLY when live.
export function adUnitsExtra(mode: AdsMode, ids: AdmobGameIds): AdmobUnitIds | null {
  return mode === 'live' ? ids.ios.units : null;
}
```

How `withShell` uses it (docs/02 section 9.1 has the complete file): it computes `adsMode = game.ads.isEnabled ? variant.adsMode : 'off'`, its plugin list (`shellPlugins`) passes `admobPluginOptions(adsMode, game.ads.ids, SKADNETWORK_IDS)` to `react-native-google-mobile-ads`, and `extra` gets `appVariant`, `adsMode` and, only when `adUnitsExtra(adsMode, game.ads.ids)` returns units (`ADS_MODE=live`), `adUnits`. The key is omitted otherwise, never `null` (docs/02 rule 10).

What the plugin writes (read in `plugin/src/index.ts` of 17.2.0, and seen in a prebuilt `Info.plist`): `GADApplicationIdentifier`, `GADDelayAppMeasurementInit`, `SKAdNetworkItems` (it only **adds** missing IDs) and, only if given, `NSUserTrackingUsageDescription` (the Shell never gives it; `expo-tracking-transparency`'s plugin writes the key, rule 21). The Android keys (`APPLICATION_ID`, `DELAY_APP_MEASUREMENT_INIT`, `OPTIMIZE_INITIALIZATION`, `OPTIMIZE_AD_LOADING`) are written too; the last two default to `true`. The plugin warns (does not fail) when an app ID is missing, which is why `withShell` always passes one.

Test IDs (platform-aware, from the library's `TestIds`, identical to Google's demo units on 2026-09-26):

| Format | iOS test unit | Android test unit |
|---|---|---|
| Adaptive banner | `ca-app-pub-3940256099942544/2435281174` | `ca-app-pub-3940256099942544/9214589741` |
| Interstitial | `ca-app-pub-3940256099942544/4411468910` | `ca-app-pub-3940256099942544/1033173712` |
| Rewarded | `ca-app-pub-3940256099942544/1712485313` | `ca-app-pub-3940256099942544/5224354917` |

Code never types these: the adapter reads `TestIds.*`. Simulators are test devices automatically; a physical device in a test build still gets test units, so no `testDeviceIdentifiers` are needed.

At runtime the Shell reads the mode and units from `expo.extra` (embedded in the app at build time):

```ts
// packages/shell/src/services/ads/read-ads-extra.ts
import Constants from 'expo-constants';

import type { AdsExtra } from './ads-factory.ts';
import type { AdUnitIds } from './ads-port.ts';

const MODES = ['off', 'test', 'live'] as const;

function isUnitIds(value: unknown): value is AdUnitIds {
  if (typeof value !== 'object' || value === null) return false;
  return ['banner', 'interstitial', 'rewarded'].every(
    (key) => typeof Reflect.get(value, key) === 'string',
  );
}

// expo.extra is embedded in the app at build time (withShell writes adsMode and adUnits).
// Anything unexpected falls back to 'off': a broken config must never show real ads.
export function readAdsExtra(extra: unknown = Constants.expoConfig?.extra): AdsExtra {
  if (typeof extra !== 'object' || extra === null) return { adsMode: 'off', adUnits: null };
  const mode: unknown = Reflect.get(extra, 'adsMode');
  const units: unknown = Reflect.get(extra, 'adUnits');
  const adsMode = MODES.find((candidate) => candidate === mode) ?? 'off';
  return { adsMode, adUnits: isUnitIds(units) ? units : null };
}
```

In test builds the debug menu can override `test` → `off` ("never show ads") at runtime; it can never switch to `live` (spec S15).

### 3.3 SKAdNetwork identifiers and the refresh script

Google publishes the SKAdNetwork IDs of itself and its third-party buyers; the plugin copies whatever list it gets into `Info.plist`. The list is a generated TypeScript module (not JSON, so `app.config.ts` can import it under Node type stripping without import attributes):

```ts
// packages/tooling/src/ads/refresh-skadnetwork.ts
// Usage: node packages/tooling/src/ads/refresh-skadnetwork.ts [--check]
// Rewrites packages/shell/src/config/skadnetwork-ids.ts from Google's AdMob iOS quick-start page.
// --check exits 1 when the committed list is stale (run by release:ios). Dev tooling may use the
// network; the app never does (N3 covers the app bundle, not packages/tooling).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'https://developers.google.com/admob/ios/quick-start';
const TARGET = 'packages/shell/src/config/skadnetwork-ids.ts';
const ID = /\b[a-z0-9]{10}\.skadnetwork\b/g;

async function fetchIds(): Promise<string[]> {
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`${SOURCE}: HTTP ${String(response.status)}`);
  const ids = [...new Set((await response.text()).match(ID) ?? [])];
  if (ids[0] !== 'cstr6suwn9.skadnetwork' || ids.length < 40) {
    throw new Error(`unexpected page content (${String(ids.length)} ids): refusing to overwrite`);
  }
  return ids;
}

function render(ids: readonly string[]): string {
  const lines = ids.map((id) => `  '${id}',`).join('\n');
  return `// ${TARGET}\n// GENERATED by refresh-skadnetwork.ts from ${SOURCE}. Do not edit.\nexport const SKADNETWORK_IDS: readonly string[] = [\n${lines}\n];\n`;
}

async function main(isCheck: boolean): Promise<void> {
  const fresh = await fetchIds();
  const committed: readonly string[] = existsSync(TARGET)
    ? (readFileSync(TARGET, 'utf8').match(ID) ?? [])
    : [];
  const added = fresh.filter((id) => !committed.includes(id));
  const removed = committed.filter((id) => !fresh.includes(id));
  console.error(
    `skadnetwork: ${String(fresh.length)} ids, +${String(added.length)} -${String(removed.length)}`,
  );
  if (isCheck) {
    process.exitCode = added.length + removed.length === 0 ? 0 : 1;
    return;
  }
  writeFileSync(TARGET, render(fresh));
}

await main(process.argv.includes('--check'));
```

- Verified on 2026-09-26: the page yields 50 unique IDs, `cstr6suwn9.skadnetwork` first; the generated file passes `prettier --check`; `--check` then exits 0. The third-party list page (`/admob/ios/3p-skadnetworks`) had the same 50 IDs.
- No separate `AdNetworkIdentifiers` (AdAttributionKit) key is needed: Apple states that `.skadnetwork` IDs are compatible with both. **Source:** [AdAttributionKit ↔ SKAdNetwork interoperability](https://developer.apple.com/documentation/adattributionkit/adattributionkit-skadnetwork-interoperability).
- After a refresh: `npx expo prebuild --platform ios --clean`, rebuild, and commit the generated file with the release.

### 3.4 `AdsPort`, the AdMob adapter, the fake and the factory

```ts
// packages/shell/src/services/ads/ads-port.ts
import type { ReactNode } from 'react';

export type AdUnitIds = {
  readonly banner: string;
  readonly interstitial: string;
  readonly rewarded: string;
};
export type FullscreenResult = 'shown' | 'unavailable';
export type RewardResult = 'rewarded' | 'dismissed' | 'unavailable';
/**
 * Where the rewarded ad stands (L11): 'loading' from the start of a preload until LOADED or a load
 * error; 'ready' after LOADED; 'unavailable' after a load error until the next preload starts, after
 * the loaded ad was shown, with ads off and before initialize. So a hidden offer always means the
 * ad cannot come, never that it is still on its way.
 */
export type RewardedStatus = 'loading' | 'ready' | 'unavailable';
export type BannerSlotProps = {
  readonly onLoaded: () => void; // the slot collapses until this fires (no empty box)
  readonly onFailed: () => void; // failed loads are silent (spec 8.8)
};

// The Shell's view of an ad SDK. Only admob-ads-adapter.ts touches the real SDK.
export type AdsPort = {
  // After consent: request configuration + SDK initialize. Idempotent.
  readonly initialize: () => Promise<void>;
  readonly preloadInterstitial: () => void;
  readonly preloadRewarded: () => void;
  readonly rewardedStatus: () => RewardedStatus;
  // Notifies when rewardedStatus() changes (useSyncExternalStore's subscribe), so the "Watch an ad"
  // offer shows its loading state, turns ready, or goes away.
  readonly subscribeRewardedStatus: (listener: () => void) => () => void;
  // Resolve when the ad CLOSED (or immediately with 'unavailable'). Never reject.
  readonly showInterstitial: () => Promise<FullscreenResult>;
  readonly showRewarded: () => Promise<RewardResult>;
  readonly renderBanner: (props: BannerSlotProps) => ReactNode;
};
```

```ts
// packages/shell/src/services/ads/admob-ads-adapter.ts
// With admob-consent-adapter.ts, the ONLY files allowed to import react-native-google-mobile-ads.
// Deliberate: classic create/load/show API behind AdsPort. Do not "upgrade" to the v17 hooks or
// pools: the Shell preloads at quiet moments and applies frequency caps in pure code (ad-policy.ts).
import { createElement } from 'react';
import mobileAds, {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  MaxAdContentRating,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

import type {
  AdsPort,
  AdUnitIds,
  FullscreenResult,
  RewardedStatus,
  RewardResult,
} from './ads-port.ts';
import type { AdErrorPayload } from 'react-native-google-mobile-ads';

export type AdFailure = Error & AdErrorPayload;
export type AdmobAdsOptions = {
  readonly units: AdUnitIds; // ADMOB_TEST_UNITS when ADS_MODE=test, extra.adUnits when live
  readonly onAdError: (error: AdFailure) => void; // ErrorLogPort; never shown to the player
};

// Google's demo units (ADS_MODE=test). Platform-aware; never hard-code them elsewhere.
export const ADMOB_TEST_UNITS: AdUnitIds = {
  banner: TestIds.ADAPTIVE_BANNER,
  interstitial: TestIds.INTERSTITIAL,
  rewarded: TestIds.REWARDED,
};

type Cell<T> = { readonly get: () => T; readonly set: (value: T) => void };
/** The rewarded status with its listeners (AdsPort.subscribeRewardedStatus). */
type StatusCell = Cell<RewardedStatus> & {
  readonly subscribe: (listener: () => void) => () => void;
};

function cell<T>(initial: T): Cell<T> {
  let value = initial;
  return { get: () => value, set: (next) => (value = next) };
}

// Load-phase no-fill is routine inventory; show-phase failures and real errors are logged.
function reportAdError(error: AdFailure, options: AdmobAdsOptions): void {
  const isNoFill = error.reason === 'no-fill' || error.reason === 'mediation-no-fill';
  if (error.phase === 'show' || !isNoFill) options.onAdError(error);
}

function showInterstitial(slot: Cell<InterstitialAd | null>): Promise<FullscreenResult> {
  const ad = slot.get();
  if (ad?.loaded !== true) return Promise.resolve('unavailable');
  slot.set(null);
  return new Promise((resolve) => {
    const settle = (result: FullscreenResult): void => {
      ad.destroy();
      resolve(result);
    };
    ad.addAdEventListener(AdEventType.CLOSED, () => {
      settle('shown');
    });
    // A failed presentation arrives only as ERROR (phase 'show'): show() has already resolved and
    // CLOSED never comes, so without this listener the game would stay suspended forever.
    ad.addAdEventListener(AdEventType.ERROR, () => {
      settle('unavailable');
    });
    ad.show().catch(() => {
      settle('unavailable'); // not loaded / already showing / platform declined
    });
  });
}

function showRewarded(slot: Cell<RewardedAd | null>, status: StatusCell): Promise<RewardResult> {
  const ad = slot.get();
  if (ad?.loaded !== true) return Promise.resolve('unavailable');
  slot.set(null);
  status.set('unavailable'); // shown once; ad-moments starts the next preload after it closes
  const earned = cell(false);
  return new Promise((resolve) => {
    const settle = (result: RewardResult): void => {
      ad.destroy();
      resolve(result);
    };
    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned.set(true); // grant ONLY on this event, never on CLOSED alone
    });
    ad.addAdEventListener(AdEventType.CLOSED, () => {
      settle(earned.get() ? 'rewarded' : 'dismissed');
    });
    // Failed presentation: ERROR (phase 'show') and no CLOSED; see showInterstitial.
    ad.addAdEventListener(AdEventType.ERROR, () => {
      settle(earned.get() ? 'rewarded' : 'unavailable');
    });
    ad.show().catch(() => {
      settle('unavailable');
    });
  });
}

type Loading = { readonly options: AdmobAdsOptions; readonly isInitialized: Cell<boolean> };

// Ads load only after initialize (which follows consent): an earlier preload starts nothing.
function preloadInterstitial(slot: Cell<InterstitialAd | null>, loading: Loading): void {
  const { options } = loading;
  if (!loading.isInitialized.get() || slot.get() !== null) return;
  const ad = InterstitialAd.createForAdRequest(options.units.interstitial);
  slot.set(ad);
  ad.addAdEventListener(AdEventType.ERROR, (error) => {
    reportAdError(error, options);
    ad.destroy();
    slot.set(null);
  });
  ad.load();
}

// 'loading' from here until LOADED ('ready') or a load error ('unavailable' until the next preload).
function preloadRewarded(
  slot: Cell<RewardedAd | null>,
  loading: Loading,
  status: StatusCell,
): void {
  const { options } = loading;
  if (!loading.isInitialized.get() || slot.get() !== null) return;
  const ad = RewardedAd.createForAdRequest(options.units.rewarded);
  slot.set(ad);
  status.set('loading');
  ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    status.set('ready');
  });
  ad.addAdEventListener(AdEventType.ERROR, (error) => {
    reportAdError(error, options);
    ad.destroy();
    slot.set(null);
    status.set('unavailable');
  });
  ad.load();
}

async function initializeOnce(isInitialized: Cell<boolean>): Promise<void> {
  if (isInitialized.get()) return;
  // D8: general audience, not child-directed -> no ageRestrictedTreatment signal.
  await mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.PG });
  await mobileAds().initialize();
  isInitialized.set(true);
}

/** 'unavailable' until the first preload after initialize; listeners hear every change. */
function createStatusCell(): StatusCell {
  let status: RewardedStatus = 'unavailable';
  const listeners = new Set<() => void>();
  return {
    get: () => status,
    set: (next) => {
      if (next === status) return;
      status = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function createAdmobAdsAdapter(options: AdmobAdsOptions): AdsPort {
  const interstitial = cell<InterstitialAd | null>(null);
  const rewarded = cell<RewardedAd | null>(null);
  const isInitialized = cell(false);
  const loading = { options, isInitialized };
  const status = createStatusCell();
  return {
    initialize: () => initializeOnce(isInitialized),
    preloadInterstitial: () => {
      preloadInterstitial(interstitial, loading);
    },
    preloadRewarded: () => {
      preloadRewarded(rewarded, loading, status);
    },
    rewardedStatus: status.get,
    subscribeRewardedStatus: status.subscribe,
    showInterstitial: () => showInterstitial(interstitial),
    showRewarded: () => showRewarded(rewarded, status),
    renderBanner: ({ onLoaded, onFailed }) =>
      createElement(BannerAd, {
        unitId: options.units.banner,
        size: BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER,
        onAdLoaded: onLoaded,
        onAdFailedToLoad: onFailed,
      }),
  };
}
```

Notes on the adapter:
- The banner is created with `createElement` so the adapter stays one `.ts` file. `ANCHORED_ADAPTIVE_BANNER` is deprecated in 17.2.0 in favour of `LARGE_ANCHORED_ADAPTIVE_BANNER` (typescript-eslint `no-deprecated` flagged it). The earlier spike rendered Google's "Test mode" creative with the anchored adaptive size; the large variant is re-checked in the first simulator smoke.
- `show()` rejects when the ad is not loaded, already showing or declined, and throws synchronously on a destroyed ad or invalid options (library `AGENTS.md`). The adapter checks `loaded` first and turns rejections into `'unavailable'`, so callers never handle exceptions.
- There is no `SHOW_FAILED` event: a show failure arrives as `ERROR` with `phase: 'show'`.
- A fullscreen ad object is used once; after `CLOSED` it is destroyed and the next one is preloaded by the caller (section 3.8).

```ts
// packages/shell/src/services/ads/fake-ads.ts
// Used by Jest, by ADS_MODE=off builds (screenshots, E2E) and by the debug "never show ads".
import type { AdsPort, FullscreenResult, RewardedStatus, RewardResult } from './ads-port.ts';

export type FakeAdsScript = {
  /** What rewardedStatus() answers first; setRewardedStatus changes it and tells subscribers. */
  readonly rewardedStatus: RewardedStatus;
  interstitialResult: FullscreenResult;
  rewardResult: RewardResult;
  readonly calls: string[];
};

/** The scripted port, plus the one way a test moves the rewarded status (loading -> ready...). */
export type FakeAds = AdsPort & { readonly setRewardedStatus: (status: RewardedStatus) => void };

type StatusCell = Pick<FakeAds, 'rewardedStatus' | 'subscribeRewardedStatus' | 'setRewardedStatus'>;

/** The scripted status and its subscribers (useSyncExternalStore). */
function statusCell(initial: RewardedStatus): StatusCell {
  const listeners = new Set<() => void>();
  let status = initial;
  return {
    rewardedStatus: () => status,
    subscribeRewardedStatus: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setRewardedStatus: (next) => {
      status = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}

export function createFakeAds(script: FakeAdsScript): FakeAds {
  const record = (name: string): void => {
    script.calls.push(name);
  };
  return {
    ...statusCell(script.rewardedStatus),
    initialize: () => {
      record('initialize');
      return Promise.resolve();
    },
    preloadInterstitial: () => {
      record('preloadInterstitial');
    },
    preloadRewarded: () => {
      record('preloadRewarded');
    },
    showInterstitial: () => {
      record('showInterstitial');
      return Promise.resolve(script.interstitialResult);
    },
    showRewarded: () => {
      record('showRewarded');
      return Promise.resolve(script.rewardResult);
    },
    renderBanner: () => null,
  };
}
```

```ts
// packages/shell/src/services/ads/ads-factory.ts
// Chooses the AdsPort implementation from expo.extra (written by withShell at build time).
import { ADMOB_TEST_UNITS, createAdmobAdsAdapter } from './admob-ads-adapter.ts';
import { createFakeAds } from './fake-ads.ts';

import type { AdFailure } from './admob-ads-adapter.ts';
import type { AdsPort, AdUnitIds } from './ads-port.ts';

export type AdsExtra = {
  readonly adsMode: 'off' | 'test' | 'live';
  readonly adUnits: AdUnitIds | null; // only when live
};

export function createAdsPort(extra: AdsExtra, onAdError: (error: AdFailure) => void): AdsPort {
  if (extra.adsMode === 'off') {
    // Spec 4.3 / screenshots / E2E: every slot stays empty, nothing is ever requested, and the
    // rewarded status stays 'unavailable' (a lost run with no Premium ends at once, L11).
    return createFakeAds({
      rewardedStatus: 'unavailable',
      interstitialResult: 'unavailable',
      rewardResult: 'unavailable',
      calls: [],
    });
  }
  const units = extra.adsMode === 'live' ? extra.adUnits : ADMOB_TEST_UNITS;
  if (units === null) throw new Error('ADS_MODE=live without extra.adUnits (withShell bug)');
  return createAdmobAdsAdapter({ units, onAdError });
}
```

The ports reach screens through React Context (dependency injection only, FINAL 5), created once in `createShellApp`: `createAdsPort(readAdsExtra(), (error) => { errorLog.record('ads', error); })` (`ErrorLogPort.record(source, error)`, docs/02 section 6.2).

### 3.5 Consent: `ConsentPort`, the adapter and the sequence

```ts
// packages/shell/src/services/consent/consent-port.ts
export type ConsentInfo = {
  readonly canRequestAds: boolean;
  readonly isPrivacyOptionsRequired: boolean; // show the "Ad privacy choices" row (S11)
};

/**
 * Apple's App Tracking Transparency answer (guideline 5.1.2(i)). Only 'authorized' lets Google's
 * SDK read the IDFA; every other status still serves ads, without it. 'unavailable': not iOS, ads
 * off, or the status could not be read.
 */
export type TrackingStatus =
  'authorized' | 'denied' | 'restricted' | 'not-determined' | 'unavailable';

export type ConsentPort = {
  // Every launch (not Premium, ads enabled). Offline: returns the last session's answer.
  readonly refresh: () => Promise<ConsentInfo>;
  // Screen S3: shows Google's form only where required. Offline: returns cached info.
  readonly showFormIfRequired: () => Promise<ConsentInfo>;
  // Settings > Ad privacy choices.
  readonly showPrivacyOptions: () => Promise<ConsentInfo>;
  // After Google's form, before the first ad request: the system ATT prompt, only while the status
  // is not-determined and the app is active; otherwise the status. Never rejects.
  readonly requestTracking: () => Promise<TrackingStatus>;
};
```

The port, the adapter, the fake and `ad-gate.ts` below follow the Shell's code (corrected to it on 2026-10-01, FINAL H.20, L14): the method is `requestTracking`, and `'restricted'` stays in `TrackingStatus` for other adapters and tests even though the Expo module reports it as `'denied'`.

```ts
// packages/shell/src/services/consent/admob-consent-adapter.ts
// Google UMP through react-native-google-mobile-ads. The form content comes from the AdMob
// console (published GDPR/TCF message); the Shell only decides WHEN it appears (spec S3).
// Apple's App Tracking Transparency prompt (guideline 5.1.2(i)) comes through expo-tracking-
// transparency; this file is its only importer. No IDFA explainer message is published in the
// AdMob console (step A3): UMP would then run its own ATT flow next to this one.
import {
  getTrackingPermissionsAsync,
  PermissionStatus,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { AppState, Platform } from 'react-native';
import {
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
} from 'react-native-google-mobile-ads';

import type { ConsentInfo, ConsentPort, TrackingStatus } from './consent-port.ts';
import type { PermissionResponse } from 'expo-tracking-transparency';
import type { AdsConsentInfo } from 'react-native-google-mobile-ads';

/** The consent geography a test build asks UMP to assume (the debug link's geo=eea|other). */
export type DebugGeography = 'eea' | 'other';
export type AdmobConsentOptions = {
  /**
   * Test builds only, and only through debugServices.setConsentGeography (e2e-maestro: the debug
   * link's geo=): UMP answers as for a player in the EEA (S3, then Google's form) or elsewhere
   * (Apple's prompt alone), on any network. Store builds never pass it (check-ads rule
   * debug-geography-test-only).
   */
  readonly debugGeography?: DebugGeography;
  /** Test builds only: UMP test devices (a simulator is one already; a phone needs its id). */
  readonly testDeviceIdentifiers?: readonly string[];
  readonly onError: (error: unknown) => void;
};

const GEOGRAPHY = {
  eea: AdsConsentDebugGeography.EEA,
  other: AdsConsentDebugGeography.OTHER,
} as const;

/** requestInfoUpdate's debug settings: none in a store build. */
function debugSettings(options: AdmobConsentOptions): {
  readonly debugGeography?: number;
  readonly testDeviceIdentifiers?: string[];
} {
  const { debugGeography: geography, testDeviceIdentifiers: devices } = options;
  return {
    ...(geography === undefined ? {} : { debugGeography: GEOGRAPHY[geography] }),
    ...(devices === undefined ? {} : { testDeviceIdentifiers: [...devices] }),
  };
}

function toInfo(info: AdsConsentInfo): ConsentInfo {
  return {
    canRequestAds: info.canRequestAds,
    isPrivacyOptionsRequired:
      info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
  };
}

// Google: if the update fails, still use canRequestAds from the previous session.
async function withCachedFallback(
  action: () => Promise<AdsConsentInfo>,
  onError: (error: unknown) => void,
): Promise<ConsentInfo> {
  try {
    return toInfo(await action());
  } catch (error) {
    onError(error);
    return toInfo(await AdsConsent.getConsentInfo());
  }
}

// expo-tracking-transparency 57.0.2 reports ATTrackingManager's .restricted as 'denied', exactly
// like a declined prompt (TrackingTransparencyPermissionRequester.swift), so this adapter never
// returns 'restricted'; both mean ads without the IDFA.
function toTrackingStatus(response: PermissionResponse): TrackingStatus {
  if (response.status === PermissionStatus.GRANTED) return 'authorized';
  if (response.status === PermissionStatus.DENIED) return 'denied';
  return 'not-determined';
}

// Apple shows the prompt only while the app is active; asked in any other state it answers at
// once without asking, so the request waits for the app to come back.
function whenActive(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise((resolve) => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      subscription.remove();
      resolve();
    });
  });
}

async function requestTracking(onError: (error: unknown) => void): Promise<TrackingStatus> {
  if (Platform.OS !== 'ios') return 'unavailable';
  try {
    const current = toTrackingStatus(await getTrackingPermissionsAsync());
    if (current !== 'not-determined') return current; // asked before: Apple never asks twice
    await whenActive();
    return toTrackingStatus(await requestTrackingPermissionsAsync());
  } catch (error) {
    onError(error);
    return 'unavailable'; // ads still load, without the IDFA
  }
}

export function createAdmobConsentAdapter(options: AdmobConsentOptions): ConsentPort {
  const requestOptions = debugSettings(options);
  return {
    refresh: () =>
      withCachedFallback(() => AdsConsent.requestInfoUpdate(requestOptions), options.onError),
    showFormIfRequired: () =>
      withCachedFallback(() => AdsConsent.loadAndShowConsentFormIfRequired(), options.onError),
    showPrivacyOptions: () =>
      withCachedFallback(() => AdsConsent.showPrivacyOptionsForm(), options.onError),
    requestTracking: () => requestTracking(options.onError),
  };
}
```

`expo-tracking-transparency` 57.0.2 (read in its tarball on 2026-09-30): `requestTrackingPermissionsAsync` calls `ATTrackingManager.requestTrackingAuthorization`; the module maps `authorized` to `granted`, `denied` and `restricted` to `denied` (with `canAskAgain` false), and `notDetermined` to `undetermined`; on Android it always answers `granted` without a prompt (the adapter returns `'unavailable'` there first). Its native `getPermissions` calls `RCTFatal` when `NSUserTrackingUsageDescription` is missing, so a build without the plugin entry crashes on the first status read (section 3.12). The fake (`fake-consent.ts`, `createFakeConsent({ afterRefresh, afterForm, tracking?, trackingAnswer?, calls })`) records every call in order (`'requestTracking'` included), answers a scripted status (default `'unavailable'`, as with ads off), shows its "prompt" only while the status is `'not-determined'` (then the answer, default `'denied'`, sticks) and counts the prompts (`trackingPrompts()`), so the gate's order is tested without the module.

The sequence, as code (pure orchestration over the two ports, tested with fakes):

```ts
// packages/shell/src/services/ads/ad-gate.ts
// Orchestrates consent -> tracking -> initialize -> preload (spec S3: consent before the first ad
// request). Where Google's form is required, the Shell's own consent moment (S3, ConsentIntroScreen)
// comes first: showIntro resolves when the player taps Continue, and only then Google's form opens.
// Once ads may be requested, Apple's App Tracking Transparency prompt comes next (guideline
// 5.1.2(i); the port asks only while the answer is not-determined), so every ad request follows
// the ATT answer. Whatever the answer, ads initialize and serve; without 'authorized' Google's SDK
// sends no IDFA.
import type { AdsPort } from './ads-port.ts';
import type { ConsentInfo, ConsentPort } from '@e07/shell/services/consent/consent-port.ts';

export type AdGateDeps = {
  readonly ads: AdsPort;
  readonly consent: ConsentPort;
  readonly onConsent: (info: ConsentInfo) => void; // stores canRequestAds + privacy-row flag
};

/** prepareAds also needs the consent moment: it shows S3 and resolves on Continue. */
export type PrepareAdsDeps = AdGateDeps & { readonly showIntro: () => Promise<void> };

export type AdGateInput = {
  readonly isPremium: boolean;
  readonly isAdsEnabled: boolean;
  readonly isTutorialDone: boolean;
  readonly isOnline: boolean;
};

// 1. At every launch: refresh consent info. Never blocks the splash.
export async function refreshConsentAtLaunch(deps: AdGateDeps, input: AdGateInput): Promise<void> {
  if (input.isPremium || !input.isAdsEnabled) return;
  deps.onConsent(await deps.consent.refresh());
}

// S3 where consent is required: the Shell's moment, then Google's form.
async function consentThroughIntro(deps: PrepareAdsDeps): Promise<ConsentInfo> {
  await deps.showIntro();
  const info = await deps.consent.showFormIfRequired();
  deps.onConsent(info);
  return info;
}

// 2. Before the first ad is ever requested (Home after the tutorial, or any later ad moment).
export async function prepareAds(deps: PrepareAdsDeps, input: AdGateInput): Promise<boolean> {
  if (input.isPremium || !input.isAdsEnabled || !input.isTutorialDone || !input.isOnline) {
    return false; // S3: skipped offline/Premium; retried the next time an ad is about to load
  }
  const known = await deps.consent.refresh();
  deps.onConsent(known);
  // Consent given before, or not required in this region: no intro and no form.
  const info = known.canRequestAds ? known : await consentThroughIntro(deps);
  if (!info.canRequestAds) return false;
  await deps.consent.requestTracking(); // after Google's form, before the SDK can request an ad
  await deps.ads.initialize();
  deps.ads.preloadInterstitial();
  deps.ads.preloadRewarded();
  return true;
}
```

When the Shell calls them:

| Moment | Call | Result used for |
|---|---|---|
| App start, after the splash has rendered (never awaited by it) | `refreshConsentAtLaunch` | `canRequestAds`, the Settings privacy row |
| Home becomes visible and `prepareAds` has not succeeded in this session | `prepareAds` | where Google's consent is required, shows S3's intro and then Google's form (first time: right after the tutorial); then Apple's tracking prompt while not determined (iOS, on its own when it is the only step due); then initialises and preloads |
| Connectivity changes to online while `prepareAds` has not succeeded | `prepareAds` | the deferred S3 of spec section 9 |
| Premium becomes true | none | ads stop at once through `adPolicy`; the SDK stays initialised but idle |
| Settings → Ad privacy choices | `consent.showPrivacyOptions()` then `onConsent` | may turn ads off (`canRequestAds` false); Apple's tracking answer is changed only in iOS Settings → Privacy & Security → Tracking |

**The S3 intro and the tracking step (FINAL H.16, L10).** The Shell's consent moment (S3) puts its own intro screen in front of Google's form, and only there: the intro appears when `prepareAds`'s own `refresh()` says consent is still needed (`canRequestAds` false, so Google's form follows), and never otherwise, so its footnote "Google's form opens next" is always true. After Continue the order is fixed: Google's form, then Apple's prompt while not determined, then `initialize`. When consent is not required in the region or was given before, there is no intro: Apple's system prompt appears on its own (while not determined), explained by the app's usage text. The prompt text comes from the copy-deck key `consent.tracking.usage-description`, which `shell-plugins.ts` reads from the four Shell catalogs (Info.plist, all four languages; docs/02 section 9.1); the prompt's language follows the device or the iOS per-app language, like the UMP form (docs/10). In France, Germany, Italy, Poland and Romania iOS shows a full-page sheet instead of an alert; an optional `NSUserTrackingMarkdownUsageDescription` could style it and is not set. A player who dismisses the sheet without deciding stays `not-determined` and is asked again the next time `prepareAds` runs (a later session). If the app is not active when the request comes, the adapter waits for it to become active, because Apple answers at once without asking otherwise. `ADS_MODE=off` builds (E2E, screenshots) build a ConsentPort that never runs the moment, so they never show the prompt; parity captures of `s3-consent-moment` hold the moment, so they never reach it either.

Verified on the iOS 26.5 simulator with Google's sample app ID: after `AdsConsent.reset()`, `requestInfoUpdate({ debugGeography: EEA })` returned `{status: 'REQUIRED', privacyOptionsRequirementStatus: 'REQUIRED', canRequestAds: false, isConsentFormAvailable: true}`, and `loadAndShowConsentFormIfRequired()` showed the "Publisher Test Ads" TCF form (Consent / Do not consent / Manage options). No test-device hash was needed on the simulator. The real form appears only after the owner publishes a GDPR message in the AdMob console (human step A3).

Test variant only: the debug link's `geo=eea` or `geo=other` (sent in the first setup link after a fresh install) calls `debugServices.setConsentGeography`, which resets UMP (`AdsConsent.reset()`) and passes `{ debugGeography, testDeviceIdentifiers }` (`DebugGeography = 'eea' | 'other'`) to the next consent request; the debug menu shows `AdsConsent.getUserChoices()` (decoded TCF choices). Those calls live behind `docs/14`'s `TEST_ONLY` gate (`packages/shell/src/app/test-only.ts`), never in the adapter's store path.

Do not set `requestNonPersonalizedAdsOnly` by hand: the SDK reads the TCF string that UMP writes.

### 3.6 `adPolicy`: spec 8.8 as pure functions

```ts
// packages/shell/src/services/ads/ad-policy.ts
// Pure implementation of spec 8.8. No SDK, no clock, no storage: everything is an input.

export type BannerScreen = 'home' | 'levels' | 'stats';
export type LevelOutcome = 'win' | 'lose';

// Per-game numbers from game.config.ts (spec 8.8 "configuration values, not hard-coded").
export type AdPolicyConfig = {
  readonly isAdsEnabled: boolean; // master switch, spec 4.3
  readonly minLevelsCompletedBeforeFirst: number; // 3
  readonly minMsBetweenInterstitials: number; // 180_000
  readonly minLevelsCompletedBetween: number; // 2
};

// Live facts, read at decision time.
export type AdContext = {
  readonly isPremium: boolean;
  readonly isOnline: boolean;
  readonly canRequestAds: boolean; // UMP says consent is handled
  readonly isTutorialDone: boolean;
  readonly levelsCompletedTotal: number; // levels won, all time
};

// Persisted in the save document (ads section), updated by ad-history.ts.
export type AdHistory = {
  readonly lastInterstitialAtMs: number | null;
  readonly levelsCompletedSinceInterstitial: number;
  readonly didLastInterstitialFollowLoss: boolean;
};

export type InterstitialRequest = {
  readonly config: AdPolicyConfig;
  readonly context: AdContext;
  readonly history: AdHistory;
  readonly trigger: { readonly outcome: LevelOutcome; readonly nowMs: number };
};

export const BANNER_SCREENS: readonly BannerScreen[] = ['home', 'levels', 'stats'];

// Common gate for every ad format.
export function canServeAds(config: AdPolicyConfig, context: AdContext): boolean {
  return config.isAdsEnabled && !context.isPremium && context.isOnline && context.canRequestAds;
}

export function shouldShowBanner(
  config: AdPolicyConfig,
  context: AdContext,
  screen: BannerScreen,
): boolean {
  return canServeAds(config, context) && context.isTutorialDone && BANNER_SCREENS.includes(screen);
}

// A clock that went backwards makes the stored time meaningless: ignore it.
function msSinceLast(history: AdHistory, nowMs: number): number | null {
  const last = history.lastInterstitialAtMs;
  return last === null || last > nowMs ? null : nowMs - last;
}

// Called only after the player tapped Next / Replay / Try again on the Result screen.
export function shouldShowInterstitial({
  config,
  context,
  history,
  trigger,
}: InterstitialRequest): boolean {
  if (!canServeAds(config, context) || !context.isTutorialDone) return false;
  if (context.levelsCompletedTotal < config.minLevelsCompletedBeforeFirst) return false;
  if (trigger.outcome === 'lose' && history.didLastInterstitialFollowLoss) return false;
  const elapsed = msSinceLast(history, trigger.nowMs);
  if (elapsed === null) return true;
  return (
    elapsed >= config.minMsBetweenInterstitials &&
    history.levelsCompletedSinceInterstitial >= config.minLevelsCompletedBetween
  );
}
```

```ts
// packages/shell/src/services/ads/ad-history.ts
import type { AdHistory, LevelOutcome } from './ad-policy.ts';

export const EMPTY_AD_HISTORY: AdHistory = {
  lastInterstitialAtMs: null,
  levelsCompletedSinceInterstitial: 0,
  didLastInterstitialFollowLoss: false,
};

// Every finished level, before the Result screen appears (saved with the stars).
export function recordLevelEnd(history: AdHistory, outcome: LevelOutcome): AdHistory {
  return outcome === 'win'
    ? { ...history, levelsCompletedSinceInterstitial: history.levelsCompletedSinceInterstitial + 1 }
    : history;
}

// Only when the interstitial was actually shown (the SDK reported it opened).
export function recordInterstitialShown(shown: {
  readonly nowMs: number;
  readonly outcome: LevelOutcome;
}): AdHistory {
  return {
    lastInterstitialAtMs: shown.nowMs,
    levelsCompletedSinceInterstitial: 0,
    didLastInterstitialFollowLoss: shown.outcome === 'lose',
  };
}
```

```ts
// packages/shell/src/services/ads/perk-offer.ts
import { canServeAds } from './ad-policy.ts';

import type { AdContext, AdPolicyConfig } from './ad-policy.ts';
import type { RewardedStatus } from './ads-port.ts';

/**
 * How a hint or a continue is offered (spec 8.5, 8.8 REWARDED, 8.10, D2, L11). 'loading' is the
 * continue's offer while its rewarded ad is still loading (S7 draws the ad key busy); 'hidden'
 * always means the perk cannot be had, so a lost run whose continue is hidden ends at once (L11).
 */
export type PerkOffer = 'free' | 'watch-ad' | 'loading' | 'hidden';

/**
 * freeHintsLeft: selectFreeHintsLeft(progress, today, extra.hints.freePerDay), as useHintPerk
 * (app/use-ad-context.ts) reads it; a game whose config gives 0 free hints never offers a free one.
 */
export type HintPerk = { readonly kind: 'hint'; readonly freeHintsLeft: number };

export type Perk =
  | HintPerk
  | {
      readonly kind: 'continue';
      readonly isAllowedByGame: boolean;
      readonly isUsedThisLevel: boolean;
    };

export type PerkRequest = {
  readonly config: AdPolicyConfig;
  readonly context: AdContext;
  /** AdsPort.rewardedStatus(), read through subscribeRewardedStatus. */
  readonly rewardedStatus: RewardedStatus;
};

function isPerkAvailable(perk: Perk): boolean {
  return perk.kind === 'hint' || (perk.isAllowedByGame && !perk.isUsedThisLevel);
}

/** A rewarded ad's offer: ready offers it, loading waits (continues only), anything else hides. */
function adOffer(perk: Perk, status: RewardedStatus): PerkOffer {
  if (status === 'ready') return 'watch-ad';
  return status === 'loading' && perk.kind === 'continue' ? 'loading' : 'hidden';
}

export function perkOffer(perk: Perk, { config, context, rewardedStatus }: PerkRequest): PerkOffer {
  if (!isPerkAvailable(perk)) return 'hidden';
  if (context.isPremium) return 'free';
  if (perk.kind === 'hint' && perk.freeHintsLeft > 0) return 'free';
  // Offline, no consent or no ad that can come: hide the offer, never show a broken one.
  return canServeAds(config, context) ? adOffer(perk, rewardedStatus) : 'hidden';
}
```

Interpretations fixed here (tests pin them):
- "Completed levels" means **levels won**; the tutorial level does not count.
- "At least 3 minutes and 2 completed levels since the last one" only applies once an interstitial has been shown; before that, only the "3 levels in total" rule gates.
- "Never twice in a row after losses" means: two consecutive interstitials may not both follow a lost level. With the default numbers this almost never triggers (losses do not add completed levels), but the numbers are configurable.
- `nowMs` comes from `ClockPort` (wall time). If the stored time lies in the future (clock moved back), it is ignored and the level-count rule still applies.
- `AdHistory` is saved in the save document's ads section after every level end and after every shown interstitial, so killing the app does not reset the caps.

The tests (complete file; `perk-offer.test.ts` and `ad-history` are covered the same way):

```ts
// packages/shell/src/services/ads/ad-policy.test.ts
import fc from 'fast-check';

import { EMPTY_AD_HISTORY, recordInterstitialShown, recordLevelEnd } from './ad-history.ts';
import { shouldShowBanner, shouldShowInterstitial } from './ad-policy.ts';

import type { AdContext, AdHistory, AdPolicyConfig, InterstitialRequest } from './ad-policy.ts';

const CONFIG: AdPolicyConfig = {
  isAdsEnabled: true,
  minLevelsCompletedBeforeFirst: 3,
  minMsBetweenInterstitials: 180_000,
  minLevelsCompletedBetween: 2,
};
const READY: AdContext = {
  isPremium: false,
  isOnline: true,
  canRequestAds: true,
  isTutorialDone: true,
  levelsCompletedTotal: 10,
};
const T0 = 1_000_000_000;
const SHOWN_AT_T0 = recordInterstitialShown({ nowMs: T0, outcome: 'win' });
const AFTER_TWO_WINS: AdHistory = recordLevelEnd(recordLevelEnd(SHOWN_AT_T0, 'win'), 'win');

function request(overrides: Partial<InterstitialRequest> = {}): InterstitialRequest {
  return {
    config: CONFIG,
    context: READY,
    history: EMPTY_AD_HISTORY,
    trigger: { outcome: 'win', nowMs: T0 },
    ...overrides,
  };
}

function at(history: AdHistory, outcome: 'win' | 'lose', nowMs: number): InterstitialRequest {
  return request({ history, trigger: { outcome, nowMs } });
}

describe('shouldShowInterstitial', () => {
  it('allows the first interstitial once 3 levels are completed', () => {
    expect(shouldShowInterstitial(request())).toBe(true);
    const early = { ...READY, levelsCompletedTotal: 2 };
    expect(shouldShowInterstitial(request({ context: early }))).toBe(false);
  });

  it.each([
    ['premium', { isPremium: true }],
    ['offline', { isOnline: false }],
    ['consent not handled', { canRequestAds: false }],
    ['tutorial running', { isTutorialDone: false }],
  ] as const)('blocks when %s', (_label, change) => {
    expect(shouldShowInterstitial(request({ context: { ...READY, ...change } }))).toBe(false);
  });

  it('requires 3 minutes AND 2 completed levels since the last one', () => {
    expect(shouldShowInterstitial(at(AFTER_TWO_WINS, 'win', T0 + 179_999))).toBe(false);
    expect(shouldShowInterstitial(at(AFTER_TWO_WINS, 'win', T0 + 180_000))).toBe(true);
    const oneWin = recordLevelEnd(SHOWN_AT_T0, 'win');
    expect(shouldShowInterstitial(at(oneWin, 'win', T0 + 999_999))).toBe(false);
  });

  it('blocks a second interstitial in a row after losses', () => {
    const afterLoss = { ...AFTER_TWO_WINS, didLastInterstitialFollowLoss: true };
    expect(shouldShowInterstitial(at(afterLoss, 'lose', T0 + 999_999))).toBe(false);
    expect(shouldShowInterstitial(at(afterLoss, 'win', T0 + 999_999))).toBe(true);
  });

  it('allows the first interstitial at exactly 3 completed levels', () => {
    const exactly = { ...READY, levelsCompletedTotal: 3 };
    expect(shouldShowInterstitial(request({ context: exactly }))).toBe(true);
  });

  it('blocks an interstitial in the same millisecond as the last one', () => {
    expect(shouldShowInterstitial(at(AFTER_TWO_WINS, 'win', T0))).toBe(false);
  });

  it('ignores a last-shown time in the future (clock moved backwards)', () => {
    expect(shouldShowInterstitial(at(AFTER_TWO_WINS, 'win', T0 - 5))).toBe(true);
  });

  it('hides every ad from a Premium player (property)', () => {
    const facts = fc.record({
      isOnline: fc.boolean(),
      isTutorialDone: fc.boolean(),
      levelsCompletedTotal: fc.nat(),
    });
    fc.assert(
      fc.property(facts, fc.nat(), (fact, nowMs) => {
        const context = { ...READY, ...fact, isPremium: true };
        expect(
          shouldShowInterstitial(request({ context, trigger: { outcome: 'win', nowMs } })),
        ).toBe(false);
        expect(shouldShowBanner(CONFIG, context, 'home')).toBe(false);
      }),
      { seed: 42, numRuns: 200 },
    );
  });
});

describe('shouldShowBanner', () => {
  it('shows banners only on Home, Levels and Statistics', () => {
    expect(shouldShowBanner(CONFIG, READY, 'home')).toBe(true);
    expect(shouldShowBanner(CONFIG, READY, 'stats')).toBe(true);
    expect(shouldShowBanner({ ...CONFIG, isAdsEnabled: false }, READY, 'levels')).toBe(false);
  });
});
```

### 3.7 Banner integration

```tsx
// packages/shell/src/ui/ad-banner-slot.tsx
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ReactNode } from 'react';

// Same shape as AdsPort's BannerSlotProps. ui/ is presentational and never imports services
// (docs/05 UI_BOUNDARY), so the screen passes `ads.renderBanner` in.
export type BannerCallbacks = { readonly onLoaded: () => void; readonly onFailed: () => void };

export type AdBannerSlotProps = {
  readonly renderBanner: (callbacks: BannerCallbacks) => ReactNode; // ads.renderBanner
  readonly isAllowed: boolean; // shouldShowBanner(config, context, screen)
  readonly testID: string; // '<screen>.banner-ad', e.g. 'home.banner-ad'
};

// Bottom of Home, Levels and Statistics only. Zero height until an ad has loaded,
// so a failed or offline load leaves no empty box (spec S4).
export function AdBannerSlot({ renderBanner, isAllowed, testID }: AdBannerSlotProps): ReactNode {
  const [isLoaded, setIsLoaded] = useState(false);
  if (!isAllowed) return null;
  return (
    <View style={isLoaded ? styles.shown : styles.collapsed} testID={testID}>
      {renderBanner({
        onLoaded: () => {
          setIsLoaded(true);
        },
        onFailed: () => {
          setIsLoaded(false);
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shown: { alignItems: 'center' },
  collapsed: { height: 0, overflow: 'hidden' },
});
```

- The screen renders `<AdBannerSlot renderBanner={ads.renderBanner} isAllowed={…} testID="home.banner-ad" />`; `levels.banner-ad` and `stats.banner-ad` follow docs/03's `<screen>.<element>` rule, and docs/07's offline flow asserts that `home.banner-ad` is not visible.
- Place the slot below the screen's scroll content and above the bottom safe-area inset, never overlapping controls (spec 8.8 "accidental taps must be impossible").
- `isAllowed` is recomputed from the stores on every render, so buying Premium, going offline or withdrawing consent removes the banner at once.
- The collapsed state mounts the native banner with zero height so it can load. Confirm in the first `ADS_MODE=test` simulator smoke that a zero-height container still receives `onAdLoaded`; if not, render it off-screen with `position: 'absolute'` and `opacity: 0` until loaded (Open issue 2).

### 3.8 Interstitial and rewarded integration, with lifecycle

```ts
// packages/shell/src/services/ads/fullscreen-ad.ts
// iOS does not background the app for GMA fullscreen ads, so AppState never changes:
// the Shell must pause the game loop and audio itself (FINAL-DECISIONS 19).
export type GameLifecycle = {
  readonly suspend: (reason: 'fullscreen-ad') => void; // stop frame callbacks, suspend AudioContext
  readonly resume: (reason: 'fullscreen-ad') => void; // resume with clamped dt
};

export async function runFullscreenAd<T>(
  lifecycle: GameLifecycle,
  show: () => Promise<T>,
): Promise<T> {
  lifecycle.suspend('fullscreen-ad');
  try {
    return await show();
  } finally {
    lifecycle.resume('fullscreen-ad');
  }
}
```

```ts
// packages/shell/src/services/ads/ad-moments.ts
// The two places a fullscreen ad may appear: after a Result-screen tap, and a rewarded perk.
import { recordInterstitialShown } from './ad-history.ts';
import { shouldShowInterstitial } from './ad-policy.ts';
import { runFullscreenAd } from './fullscreen-ad.ts';

import type { AdHistory, InterstitialRequest } from './ad-policy.ts';
import type { AdsPort } from './ads-port.ts';
import type { GameLifecycle } from './fullscreen-ad.ts';

export type AdMomentDeps = { readonly ads: AdsPort; readonly lifecycle: GameLifecycle };

// After Next / Replay / Try again (never before the player has seen the result, spec S7).
// Returns the new history to save; the caller then navigates on.
export async function showInterstitialIfDue(
  deps: AdMomentDeps,
  request: InterstitialRequest,
): Promise<AdHistory> {
  if (!shouldShowInterstitial(request)) return request.history;
  const result = await runFullscreenAd(deps.lifecycle, deps.ads.showInterstitial);
  deps.ads.preloadInterstitial(); // the next one loads in the background while the player plays
  return result === 'shown' ? recordInterstitialShown(request.trigger) : request.history;
}

// "Watch an ad to get a hint / continue". True only when the reward was earned.
export async function earnRewardedPerk(deps: AdMomentDeps): Promise<boolean> {
  const result = await runFullscreenAd(deps.lifecycle, deps.ads.showRewarded);
  deps.ads.preloadRewarded();
  return result === 'rewarded';
}
```

The Result-screen flow (S7), step by step:
1. The level ends. The game session saves stars, statistics and `recordLevelEnd(history, outcome)` **before** the Result screen appears (spec S7).
2. The player reads the result and taps Next / Replay / Try again.
3. The button handler calls `showInterstitialIfDue(deps, { config, context, history, trigger: { outcome, nowMs: clock.nowMs() } })`, saves the returned history, then navigates. No ad is ever shown on top of the result.
4. `lifecycle.suspend` stops frame callbacks and suspends the `AudioContext` through `AudioPort`; `resume` restarts them with a clamped `dt` (docs/08 owns the loop and `useGameLifecycle`). Real-time games stay paused after an ad and show the Pause overlay, as after backgrounding.

Rewarded perks:
- The hint and continue buttons render from `perkOffer(perk, { config, context, rewardedStatus })`. `rewardedStatus` is `ads.rewardedStatus()` (`'loading'` from the start of a preload until LOADED or a load error, `'ready'` after LOADED, `'unavailable'` after a load error until the next preload, with ads off, and before `initialize`), re-read whenever `ads.subscribeRewardedStatus` fires, so a continue shows its offer busy while the ad loads and its key once the ad is ready. The game host's `LoseResult.continueOffer` is `'ad' | 'ad-loading' | 'premium' | null`; `isLossStranded(view, continueOffer)` (`game-host/run-end-policy.ts`) is true for a lost run whose continue is offered, whose summary is null and whose offer is `'hidden'`, and the Game screen's model then sends `{ type: 'finish' }` once, so the run end is recorded and the result shows at once (L11). `'free'` runs the perk directly; `'watch-ad'` shows "Watch an ad to get a hint" and calls `earnRewardedPerk`; the perk runs only if it returns `true`. A dismissed ad changes nothing and says nothing.
- A hint during play pauses the level before the ad (the lifecycle does it) and returns to the same state.
- Rewarded reward amount/type in the AdMob console are ignored by the Shell (one ad = one hint or one continue).

Preloading happens at quiet moments only: `prepareAds` (Home), after each fullscreen ad, and when a level starts if nothing is loaded. Play never waits for an ad.

### 3.9 Offline behaviour

`ConnectivityPort` (FINAL 27) drives `isOnline`:

```ts
// packages/shell/src/services/connectivity/connectivity-port.ts
export type ConnectivityPort = {
  readonly isOnline: () => boolean; // last known value; false until the first report
  readonly subscribe: (listener: (isOnline: boolean) => void) => () => void;
};
```

```ts
// packages/shell/src/services/connectivity/expo-network-connectivity-adapter.ts
// NWPathMonitor under the hood: no HTTP probe (unlike @react-native-community/netinfo, banned).
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';

import type { ConnectivityPort } from './connectivity-port.ts';
import type { NetworkState } from 'expo-network';

const isUsable = (state: NetworkState): boolean =>
  state.isConnected === true && state.isInternetReachable !== false;

export function createExpoNetworkConnectivityAdapter(): ConnectivityPort {
  let isOnline = false;
  const listeners = new Set<(isOnline: boolean) => void>();
  const report = (isNowOnline: boolean): void => {
    isOnline = isNowOnline;
    listeners.forEach((listener) => {
      listener(isNowOnline);
    });
  };
  const update = (state: NetworkState): void => {
    report(isUsable(state));
  };
  getNetworkStateAsync()
    .then(update)
    .catch(() => {
      report(false); // unknown network state counts as offline (no ad, no store; spec 4.1)
    });
  addNetworkStateListener(update);
  return {
    isOnline: () => isOnline,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

`expo-network` 57.0.2 uses `NWPathMonitor` on iOS (read in `ios/NetworkModule.swift`) and makes no HTTP request. In test builds the debug switch "Simulate offline" wraps this port and forces `false` (spec S15); the ads and store adapters then behave as offline.

| Situation | Banner | Interstitial | Rewarded button | Consent |
|---|---|---|---|---|
| Online, consent handled, not Premium | shown when loaded | per `adPolicy` | shown when loaded | refreshed at launch |
| Offline | slot collapsed, no message | never | hidden (a lost run's result shows at once, L11) | refresh fails → cached `canRequestAds`; form deferred |
| Premium | never | never | perks free | not requested |
| `canRequestAds` false | never | never | hidden (perks need an ad) | privacy row lets the player change it |
| `ADS_MODE=off` / `isEnabled: false` | never | never | hidden (hints: free allowance only) | never requested |

Apple's tracking prompt follows the Consent column: it is asked only inside `prepareAds`, so never offline, never for Premium, never while `canRequestAds` is false and never with `ADS_MODE=off`. A declined or restricted answer changes no cell of this table.

### 3.10 Privacy manifest, App Privacy and ATT (guideline 5.1.2)

- **Required-reason APIs** from the Google pods (verified in the 13.6.0 / 3.1.0 manifests): SystemBootTime `35F9.1`, UserDefaults `CA92.1`, DiskSpace `E174.1` (GMA); UserDefaults `CA92.1` (UMP). They must appear in `ios.privacyManifests` of the app config; `npm run audit:privacy` aggregates all pod manifests and fails on a gap (`docs/13`, section 3.3).
- **Collected data declared by the SDK manifests** (verified with the aggregation script):

| Pod | Data type | Linked | Tracking |
|---|---|---|---|
| Google-Mobile-Ads-SDK 13.6.0 | Device ID | yes | **yes** |
| | Coarse location, Advertising data, Product interaction | yes | no |
| | Performance data, Crash data, Other diagnostic data | no | no |
| GoogleUserMessagingPlatform 3.1.0 | Coarse location, Performance data, Product interaction | no | no |

- Neither manifest sets `NSPrivacyTracking` or tracking domains (GMA 13.6.0 re-read with `plutil` on 2026-09-30: Device ID linked and tracking, everything else not tracking, no `NSPrivacyTracking` key, no `NSPrivacyTrackingDomains`). The app's own manifest keeps `NSPrivacyTracking: false` and lists no tracking domains: our code neither tracks nor contacts any domain (N3), the tracking Device ID is declared by Google's own manifest, and iOS fails requests to listed tracking domains for players who have not allowed tracking, so listing Google's ad domains would stop ads for everyone who declines (`docs/13` rule 9). **Source:** [NSPrivacyTracking](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytracking), [NSPrivacyTrackingDomains](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytrackingdomains).
- **ATT (owner decision O1, FINAL H.1).** The app asks for tracking permission on iOS before the first ad request (rule 21, section 3.5). Allowed: the SDK may use the IDFA. Declined or restricted: the advertising identifier is all zeros; ads still serve (not personalised by IDFA) and SKAdNetwork attribution still works. **Source:** [ASIdentifierManager.advertisingIdentifier](https://developer.apple.com/documentation/adsupport/asidentifiermanager/advertisingidentifier).
- **Guideline 5.1.2(i), resolved.** Apple: "You must receive explicit permission from users via the App Tracking Transparency APIs to track their activity." GMA's manifest marks Device ID as used for tracking, and the app now asks through ATT, so the App Privacy answers declare Device ID as **linked and used for tracking, by the third-party ads SDK**, matching the manifest ("developers are responsible for checking and updating their app's data disclosures", Google data-disclosure page). `docs/13` section 3.4 has the full answer list (human step G3 in `docs/14`).
- A privacy policy URL is required by both the App Store and AdMob; the offline copy lives in S11c. **Source:** [App Review Guidelines 5.1.1(i)](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage).

### 3.11 AdMob console: human steps

Numbered for reference from `docs/14` (step O9/G5):

- **A1. Account (once).** Create the AdMob account with the owner's Google account; complete the payments and tax profile. Add the developer website (the same domain as the privacy policy).
- **A2. Per game: app and ad units.** Apps → Add app → iOS → "not published yet" (link to the store listing later). Create three ad units: **Banner** (adaptive), **Interstitial**, **Rewarded** (reward: amount 1, type `perk`; server-side verification off). Give the app ID and the three unit IDs to the agent, who writes them into `game.config.ts`.
- **A3. Privacy & messaging.** Create and **publish** the "European regulations" (GDPR/TCF) message for the app, with the privacy-policy URL and languages English and German (Persian/Sorani are not needed for the EEA). Optionally create the "US state regulations" message. Do **not** create the "IDFA explainer" message: the Shell's S3 intro gives the context before Google's form, the app's own usage text explains Apple's prompt, and the app asks for ATT itself right after Google's form, or on its own when no form is due (rule 21); with an explainer published, UMP would present ATT inside its own flow as well. Without a published GDPR message, real users see no form and `canRequestAds` stays false in the EEA.
- **A4. Blocking controls.** Block sensitive categories that conflict with spec 8.8 (at least gambling and betting; also dating, alcohol, get-rich-quick). Set the maximum ad content rating to **PG**, matching the code. Review the "Ad review center" after launch.
- **A5. After the first release.** Link the AdMob app to the App Store listing. Publish `app-ads.txt` at the root of the developer website with the line AdMob shows under Apps → app-ads.txt (format `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`). AdMob finds the site through the App Store listing's **Marketing URL** and can take up to 24 hours to verify. That field can only be edited with a new app version, so the store-pages step must fill it for the **first** version. **Source:** [AdMob app-ads.txt](https://support.google.com/admob/answer/9363762).
- **A6. Physical-device testing with live IDs** is never needed: test builds always use test units.

### 3.12 Troubleshooting

Error handling reads `error.phase` then `error.reason` (`AdErrorPayload` in 17.2.0; the reason list is open-ended):

| `phase` | `reason` | Meaning | Action |
|---|---|---|---|
| `load` | `no-fill`, `mediation-no-fill` | no ad available (routine) | nothing; not logged; preload again later |
| `load` | `network-error`, `timeout` | offline or slow network | nothing visible; `adPolicy` usually already blocked it |
| `load` | `invalid-request`, `invalid-argument`, `invalid-ad-string` | wrong unit ID or request | log; check `extra.adUnits` / `TestIds` and the mode |
| `load` | `app-id-missing` | `GADApplicationIdentifier` missing or wrong | check the plugin options and prebuild |
| `load` | `internal-error`, `server-error` | Google side | log; retry at the next quiet moment |
| `show` | any | the ad could not be presented | log; `showInterstitial` resolves `'unavailable'`; continue navigation |
| any | `ad-already-used` | a fullscreen ad object was shown twice | bug: each object is used once and destroyed after `CLOSED` |

Common problems:

| Symptom | Cause | Fix |
|---|---|---|
| Crash at launch mentioning `GADApplicationIdentifier` | plugin missing or no `iosAppId` | `withShell` always passes an app ID; `npx expo prebuild --clean` |
| Crash on the first ads moment: "This app is missing 'NSUserTrackingUsageDescription' so tracking transparency will fail" (`RCTFatal`) | the `expo-tracking-transparency` plugin entry is missing from `shellPlugins`, or `ios/` predates it | add the entry (docs/02 section 9.1); `npx expo prebuild --platform ios --clean` |
| Apple's tracking prompt never appears | the status is no longer `not-determined` (answered before, tracking restricted, or "Allow Apps to Request to Track" off in iOS Settings), Maestro's `launchApp` granted every permission (the status reads authorized), or the build is `ADS_MODE=off` | expected; to see it again on a simulator, delete and reinstall the app (the answer is kept per install) or erase the simulator, and launch with `xcrun simctl launch` or `launchApp: { permissions: { all: unset } }`. A request made while the app is not active waits for it to become active |
| Tracking prompt shown twice, or a Google explainer before it | an "IDFA explainer" message is published in AdMob (A3) | unpublish it; the app asks for ATT itself |
| Ads load but are never personalised on iOS | the player declined tracking or it is restricted | expected (rule 21); ads carry no IDFA |
| `TurboModuleRegistry.getEnforcing(...): 'RNGoogleMobileAdsModule' could not be found` in Jest | a test imported the real library | the root mock `__mocks__/react-native-google-mobile-ads.ts` must exist (section 3.14) |
| No consent form in the EEA on a real device | no **published** GDPR message (A3), or cached consent | publish the message; in a test build use debug geography EEA + `AdsConsent.reset()` |
| `canRequestAds` false forever | the player chose "Do not consent" in a region where that blocks ads | expected; the privacy row lets them change it |
| Banner never appears | offline, Premium, consent not handled, `ADS_MODE=off`, or no fill | check `shouldShowBanner` inputs in the debug menu; open the Ad Inspector (test builds: `mobileAds().openAdInspector()`) |
| Real ads in a test build / test ads in a store build | wrong `ADS_MODE` pair | impossible by construction (`docs/14` matrix + `assertLiveIds`); the store-artifact gate checks `GADApplicationIdentifier` |
| Interstitial shown over the Result screen | the call was placed in the result effect instead of the button handler | only the Next / Replay / Try again handlers call `showInterstitialIfDue` |

When filing a library issue, attach the RN/Expo/library versions, whether test IDs were used, and the Ad Inspector result (the library's `AGENTS.md` lists the rest).

### 3.13 ESLint entries

docs/04's `eslint.config.mjs` already enforces rule 3; do not add copies. `VENDOR_SDK_PATHS` bans `react-native-google-mobile-ads` ("AdsPort/ConsentPort"), `expo-tracking-transparency` ("ConsentPort") and `expo-network` in all runtime code. The `ADAPTERS` block (`packages/shell/src/services/*/*-adapter.ts`) lifts the ban for `admob-ads-adapter.ts`, `admob-consent-adapter.ts` and `expo-network-connectivity-adapter.ts`. `expo-tracking-transparency` is no longer in `BANNED_PACKAGE_PATHS` (FINAL H.1), and the `__mocks__/**` block exempts the root mocks from `import/no-default-export`.

### 3.14 Testing

- **Unit (Jest):** `ad-policy.test.ts`, `perk-offer.test.ts`, `ad-gate.test.ts` (order refresh → intro → form → tracking → initialize → preload where consent is required; no intro and no form when the refresh already allows ads, so tracking comes on its own; no initialize without consent; no tracking prompt when `canRequestAds` is false; `initialize` still runs after `'denied'`; no form or prompt during the tutorial, for Premium or offline; launch refresh shows neither), `admob-consent-adapter.test.ts` (the ATT mapping: granted → `'authorized'`, denied (also restricted) → `'denied'`, undetermined → asks once, after the app is active; no request when already answered; an error → `'unavailable'` and `onError`; `'unavailable'` off iOS), `ad-moments.test.ts` (suspend → show → resume → preload; history recorded; perk only when earned), `ads-factory.test.ts` (off never shows; live without units throws), `ads-config.test.ts` (sample IDs in test/off, live IDs in live, sample or malformed IDs rejected, iOS-only games accepted). All pass (section Verified).
- **Root mocks:** docs/07 section 3.6 owns `__mocks__/react-native-google-mobile-ads.ts` and `__mocks__/expo-tracking-transparency.ts`. Jest applies them to every test without a `jest.mock` call, and they keep imports of the two adapters safe; Shell tests use `fake-ads.ts` and `fake-consent.ts` (with a scripted `TrackingStatus`). The mock's `BannerAdSize` lists `LARGE_ANCHORED_ADAPTIVE_BANNER` next to `ANCHORED_ADAPTIVE_BANNER`, because the adapter uses the large size (without it a banner test would pass `undefined` as the size).
- **Mutation:** Stryker on `ad-policy.ts` left two survivors (docs/07 section 3.8.6); the two boundary cases above ("exactly 3 completed levels", "the same millisecond as the last one") kill them, and the file passed Jest, docs/04's ESLint and Prettier with them in the integration pass on 2026-09-26.
- **Simulator smoke (test variant, `ADS_MODE=test`, one per SDK upgrade and before each release):** six Maestro flows (`packages/shell/e2e/ads-smoke/01` to `06`, tag `ads-smoke`), run by hand, each after a fresh install started with `xcrun simctl launch` (Maestro's `launchApp` grants the ATT answer), never by `e2e:ios`, with no `ads=` in a setup link: (1) `geo=eea`: S3, Google's form, Apple's tracking prompt declined, the "Test mode" banner on Home; (2) a relaunch without prompts; (3) Next with a test interstitial; (4) the rewarded continue, which asserts that the board redraws (`game.board-frame` settled for the continue's seq); (5) offline: the banner slot collapses, no interstitial, the continue offer hidden and the result shown at once; (6) on its own fresh install, `geo=other`: no GDPR form, then Apple's prompt with the app's usage text (a test build runs on Google's sample AdMob app, whose IDFA explainer shows before the prompt; the owner's app shows Apple's prompt alone).
- **Screenshots and E2E** run with `ADS_MODE=off`, so images are deterministic, the runtime network audit sees no ad traffic (`docs/13`, layer F), and neither Google's form nor Apple's tracking prompt ever appears.

---

## 4. Checklist

- [ ] `react-native-google-mobile-ads` is exactly 17.2.0 (or a newer version that passed section 3.1's re-verification) and appears only in the two adapters and the root mock.
- [ ] The plugin receives an app ID in every variant, `delayAppMeasurementInit: true`, the committed SKAdNetwork list, and no `userTrackingUsageDescription`.
- [ ] `expo-tracking-transparency` is `~57.0.2` (the SDK 57 map), its plugin entry carries the en `userTrackingPermission`, `expo.locales` carries `NSUserTrackingUsageDescription` in de, fa and ckb, and only `admob-consent-adapter.ts` imports it.
- [ ] On iOS, Apple's tracking prompt appears after Google's form (or on its own, with no S3 intro, when no form is due) and before `initialize`, only while not determined; the S3 intro appears only before Google's form; a declined answer still shows ads; `ADS_MODE=off` builds never show it.
- [ ] Live builds hold no scaffold placeholder (`1234567890123456`) or sample AdMob ID (`assertLiveIds`).
- [ ] `refresh-skadnetwork.ts --check` passes; `SKADNETWORK_IDS` has 50 IDs (or whatever Google lists today).
- [ ] Store builds: `extra.adsMode` is `live` (or `off`), `extra.adUnits` holds valid IDs, `GADApplicationIdentifier` is the game's; test builds: sample app ID and no `adUnits` key (`withShell` omits it; `null` in `extra` arrives as `{}`, docs/02 rule 10).
- [ ] No ad code runs before `canRequestAds` and the tracking answer; the consent form appears only after the tutorial and before the first ad.
- [ ] "Ad privacy choices" row visible only when required, and it works.
- [ ] Banners only on Home, Levels, Statistics; collapsed until loaded; never over controls.
- [ ] Interstitials only after Next/Replay/Try again; `AdHistory` saved; Premium/offline/consent/tutorial/count/time/loss rules pass their tests.
- [ ] Rewarded perks only on the player's tap; reward only on `EARNED_REWARD`; a continue's offer busy while its ad loads, hidden only when no ad can be served, and then the lost run's result shown at once (L11).
- [ ] The game loop and audio are suspended during fullscreen ads.
- [ ] No ad-related message ever reaches the player; errors go to `ErrorLogPort`.
- [ ] `npm run audit:privacy` passes with the GMA/UMP reasons declared.
- [ ] The owner has completed A1–A4 for this game (A5 after release).

---

## 5. Sources

- react-native-google-mobile-ads: https://docs.page/invertase/react-native-google-mobile-ads (Expo install `/installation/expo`, consent `/european-user-consent`, `/consent-basics`, testing `/testing`, migration `/migrating-to-v17`, agents `/ai-agents`)
- npm registry: https://registry.npmjs.org/react-native-google-mobile-ads
- Releases: https://github.com/invertase/react-native-google-mobile-ads/releases/tag/v17.0.0, https://github.com/invertase/react-native-google-mobile-ads/releases/tag/v17.2.0
- Google AdMob iOS quick start (SKAdNetwork list): https://developers.google.com/admob/ios/quick-start
- Third-party SKAdNetwork IDs: https://developers.google.com/admob/ios/3p-skadnetworks
- Test ads: https://developers.google.com/admob/ios/test-ads
- UMP / privacy: https://developers.google.com/admob/ios/privacy
- Google data disclosure (iOS): https://developers.google.com/admob/ios/privacy/data-disclosure
- iOS 14+ / ATT with AdMob: https://developers.google.com/admob/ios/ios14
- AdMob IDFA explainer message (not used): https://developers.google.com/admob/ios/privacy/idfa
- Apple `requestTrackingAuthorization(completionHandler:)`: https://developer.apple.com/documentation/apptrackingtransparency/attrackingmanager/requesttrackingauthorization(completionhandler:)
- Apple `NSUserTrackingUsageDescription`: https://developer.apple.com/documentation/bundleresources/information-property-list/nsusertrackingusagedescription
- Apple `NSPrivacyTracking` / `NSPrivacyTrackingDomains`: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytracking
- expo-tracking-transparency: https://docs.expo.dev/versions/latest/sdk/tracking-transparency/
- AdMob blocking controls: https://support.google.com/admob/answer/2753718
- AdMob app-ads.txt: https://support.google.com/admob/answer/9363762
- AdAttributionKit / SKAdNetwork interoperability: https://developer.apple.com/documentation/adattributionkit/adattributionkit-skadnetwork-interoperability
- ASIdentifierManager: https://developer.apple.com/documentation/adsupport/asidentifiermanager/advertisingidentifier
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Expo privacy manifests: https://docs.expo.dev/guides/apple-privacy/
- expo-network: https://docs.expo.dev/versions/latest/sdk/network/

---

## Verified

On 2026-09-26 (macOS, Node 26.4.0, npm 11.17.0, Xcode 26.6, iOS 26.5 simulator, Expo SDK 57.0.25, RN 0.86.3):

- **All code in this doc** (re-checked by the reviewer in `scratchpad/rn/verify-services-i18n`) compiled with TypeScript 6.0.3 in docs/04's tsconfig layout against the real type definitions of `react-native-google-mobile-ads` 17.2.0, `expo-network` 57.0.2 and `expo-constants` (SDK 57). It passed docs/04's `eslint.config.mjs` plus docs/05's additions (`--max-warnings 0`) and Prettier 3.9.9. The six Jest suites named in section 3.14 passed under docs/07's `jest.config.js` with docs/07's root mock. The canonical config caught two problems, both fixed above: a floating `void` promise in the connectivity adapter, and the banner slot importing `services/` from `ui/` (docs/05 `UI_BOUNDARY`). `ads-config.ts` also loaded under Node's type stripping and produced the expected plugin options.
- **Library source read** (17.2.0 tarball): `AdsConsent.ts` (methods, `gatherConsent` = update + form), the consent types, `AdError.ts` (`reason`, `phase`, deprecated `code`), `BannerAdSize.ts` (`ANCHORED_ADAPTIVE_BANNER` deprecated), `TestIds.ts`, `RequestConfiguration.ts` (`tagFor*` deprecated in favour of `ageRestrictedTreatment`), `MobileAds.ts`, the Expo plugin, and the shipped `AGENTS.md`.
- **SKAdNetwork:** the refresh script fetched Google's page and produced 50 IDs, `cstr6suwn9` first; the reviewer's `--check` run later the same day exited 0 (`+0 -0`).
- **Quoted sources re-read:** Google's data-disclosure page (the quoted sentence, "Last updated 2026-09-25"), App Review Guideline 5.1.2(i), and AdMob's app-ads.txt help (Marketing URL field, editable only with a new version, up to 24 hours).
- **Services spike (same day, Release build):** pods resolved to Google-Mobile-Ads-SDK 13.6.0 and GoogleUserMessagingPlatform 3.1.0; a test adaptive banner rendered with the "Test mode" label; the EEA debug-geography consent flow behaved as in section 3.5.
- **Pod privacy manifests** (GMA 13.6.0, UMP 3.1.0) read with `plutil` through the aggregation script (`docs/13`).
- **Bundle facts** (`expo export` of a Release JS bundle that imports the library): `3940256099942544` appears in `react-native-google-mobile-ads/src/TestIds.ts` and `src/types/RequestOptions.ts`, so every bundle contains it; the release checks attribute it by module (`docs/13`, `docs/14`).
- **2026-09-30 (O1, reading only):** Google's ATT guidance and Apple's `requestTrackingAuthorization(completionHandler:)`, `NSUserTrackingUsageDescription`, `NSPrivacyTracking` and `NSPrivacyTrackingDomains` pages re-read; `expo-tracking-transparency` 57.0.2 tarball read (`src/TrackingTransparency.ts`, the Swift permission requester, the plugin); the GMA 13.6.0 xcframework's `PrivacyInfo.xcprivacy` read with `plutil`. The ATT code first written here was not compiled or run. **2026-10-01 (FINAL H.20, L14):** sections 3.5 and 3.14 now follow the Shell's own consent code (port, adapter, fake and `ad-gate.ts`), which passed Jest and `npm run verify` in the round-4 integration repo, and whose order was seen on the iOS 26.5 simulator on 2026-09-30 (`ADS_MODE=test`, debug geography EEA, fresh install launched with `xcrun simctl launch`): S3, Google's test form, then Apple's prompt with the en text; after "Ask App Not to Track" the test banner loaded; a relaunch showed neither.
- **Not verified:** `LARGE_ANCHORED_ADAPTIVE_BANNER` rendering and loading inside a zero-height container; the interstitial and rewarded test ads end to end in the Shell (the adapter was type-checked, not run on a device); consent-form language for in-app fa/ckb; Android.

**Re-verify** (versions age): `npm view react-native-google-mobile-ads version`, the SDK versions in its `package.json` `sdkVersions`, `node packages/tooling/src/ads/refresh-skadnetwork.ts --check`, `npm run audit:privacy`, the Jest suites above, and the simulator smoke in section 3.14.

---

## Open issues

1. **Two files import the SDK, not one.** FINAL 23 says "only the adapter file imports it (AdsPort)", and docs/01 ADR-11 repeats it. FINAL F also makes `ConsentPort` a separate canonical port, whose adapter needs `AdsConsent` from the same package. docs/04's `ADAPTERS` glob and docs/02's port table already allow `admob-ads-adapter.ts` and `admob-consent-adapter.ts`; the spirit (vendor code only in vendor-named adapters) is unchanged.
2. **Collapsed banner loading.** Whether a banner inside a zero-height container still loads was not verified; the fallback (off-screen, transparent) is written in section 3.7. Resolve in the first `ADS_MODE=test` simulator smoke and update this doc.
3. **Interpretation of spec 8.8.** "Completed levels" = levels won; "never twice in a row after losses" = two consecutive interstitials may not both follow a loss. If the owner meant "no interstitial after two consecutive lost levels", only `shouldShowInterstitial` and its test change.
4. **Resolved (2026-09-30): 5.1.2 vs D4.** The owner chose Apple's rules (O1, FINAL H.1): the app asks for ATT, and the App Privacy answers declare Device ID as used for tracking (section 3.10, `docs/13` section 3.4).
5. **Resolved: docs/07's root mock lists `BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER`** (section 3.14).
6. **Resolved (2026-10-01, FINAL H.16, L10): the S3 intro's footnote names only Google's form.** The copy-deck text `consent.intro.footnote` says "Google's form opens next". The intro now appears only before Google's form, so the footnote is always true; when only Apple's tracking prompt is due, the prompt appears on its own, explained by `consent.tracking.usage-description`. The copy deck needs no second footnote.
