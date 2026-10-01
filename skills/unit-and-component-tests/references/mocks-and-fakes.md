# Root mocks, adapter tests and fakes

How vendor SDKs stay out of tests, how an adapter is tested against its mock, and how everything above the adapters is tested through fakes of the ports.

## Contents

- The rule in one paragraph
- Root manual mocks
- Testing an adapter against the mock
- Fakes: real small implementations with a call log
- Testing services over fakes
- Testing policies (ads, limits)
- Lint notes for mocks

## The rule in one paragraph

Only the adapter files (`packages/shell/src/services/*/*-adapter.ts`) import `react-native-google-mobile-ads`, `expo-iap` or `expo-tracking-transparency` (the last only in `services/consent/admob-consent-adapter.ts`, which asks for App Tracking Transparency after Google's consent form). The root `__mocks__/` files keep those adapters importable in Jest. Everything else is tested through the port with `fake-<port>.ts`. Both SDKs crash on import in Jest (`TurboModuleRegistry.getEnforcing(...): 'RNGoogleMobileAdsModule' could not be found`, `Cannot find native module 'ExpoIap'`, verified), and fakes make the ad and Premium rules millisecond tests.

## Root manual mocks

Jest applies a file in `<rootDir>/__mocks__/` automatically to the node module of the same name, in every project, without `jest.mock` (scoped packages: `__mocks__/@scope/name.ts`). The three templates:

- `templates/__mocks__/react-native-google-mobile-ads.ts` mirrors 17.2.0's public surface: `mobileAds()` (default export and `MobileAds`), `AdsConsent` (`requestInfoUpdate`, `loadAndShowConsentFormIfRequired`, `showPrivacyOptionsForm`, `getConsentInfo` resolving to "obtained", `getUserChoices` for the debug menu's TCF view, `reset`), the enums `AdsConsentStatus`, `AdsConsentPrivacyOptionsRequirementStatus`, `AdsConsentDebugGeography`, `MaxAdContentRating`, `AdEventType`, `RewardedAdEventType`, `BannerAdSize`, the iOS `TestIds`, `InterstitialAd`/`RewardedAd.createForAdRequest` returning a mock ad, and a `BannerAd` that renders nothing.
- `templates/__mocks__/expo-iap.ts` mocks `initConnection`, `endConnection`, `fetchProducts`, `requestPurchase`, `finishTransaction`, `restorePurchases`, `getAvailablePurchases`, `purchaseUpdatedListener`, `purchaseErrorListener`, and re-exports the real `ErrorCode` from `expo-iap/build/types.js` (plain JS, so the mock can never drift from it). Banned APIs (`kitApi`, `verifyPurchaseWithProvider`, …) are deliberately not mocked: calling one throws.
- `templates/__mocks__/expo-tracking-transparency.ts` mocks `getTrackingPermissionsAsync` (answers `undetermined`: nothing asked yet), `requestTrackingPermissionsAsync` (answers `denied`: the player declines), `getAdvertisingId`, `isAvailable` and the `PermissionStatus` values. jest-expo 57 mocks only the native module `ExpoTrackingTransparency`, whose functions answer `undefined`, so the package's own JavaScript would crash on `response.status`; the root mock replaces the package. The consent adapter's test scripts other answers with `jest.mock('expo-tracking-transparency')` and `jest.requireMock(...)` (`tracking.getTrackingPermissionsAsync.mockResolvedValueOnce({ status: 'granted' })`). Everything above the adapter uses the consent port's fake, `createFakeConsent`, whose scripted tracking status and request count prove the order S3 intro, Google's form, then the tracking prompt, then the first ad request.

Keep them in sync on every SDK upgrade: compare the mock's names with the library's `index.d.ts`, and the `TestIds` with the library's iOS values. The ads and Premium work (`admob-ads`, `premium-purchase`) ship the same files; they must stay byte-identical to these templates, so change all copies together. An adapter that starts calling a new SDK member adds it to the mock in the same commit (a missing member is `undefined` in Jest and fails as "is not a function"). A third root mock, `__mocks__/react-native-audio-api.ts`, extends that library's own Jest mock for the audio adapter; the audio work owns it.

`clearMocks` + `restoreMocks` in `jest.config.js` reset call counts before each test while keeping the implementations given to `jest.fn(impl)` in these files.

## Testing an adapter against the mock

Lint bans importing the SDK in tests too. The adapter's own test reads the mock with `jest.requireMock`, typed locally with only what the assertions need, after an explicit `jest.mock('<sdk>')`. Without the explicit `jest.mock`, `requireMock` returns a second instance, not the one the adapter imported, and every assertion sees zero calls (verified).

```ts
import { createAdmobConsentAdapter } from './admob-consent-adapter.ts';

jest.mock('react-native-google-mobile-ads');

type MockedSdk = {
  readonly AdsConsent: {
    readonly requestInfoUpdate: jest.Mock<Promise<unknown>>;
    readonly getConsentInfo: jest.Mock<Promise<unknown>>;
  };
};

const { AdsConsent } = jest.requireMock<MockedSdk>('react-native-google-mobile-ads');
```

Typing the mock locally also avoids `@typescript-eslint/unbound-method` on `expect(sdk.method)` for library-typed methods. `examples/admob-consent-adapter.test.ts` is a complete adapter test (mapping, offline fallback to the last session's answer, debug geography, and `requestTracking`: asked once while not-determined, never again after an answer, only while the app is active, restricted reported as denied); `templates/adapter.test.ts` is the fill-in version.

## Fakes: real small implementations with a call log

A fake is `fake-<port>.ts` beside the port: a real, small implementation of the port with test controls, not a bag of `jest.fn()`. It records an ordered call log (`script.calls`) that other fakes and stubs can share, so one `toStrictEqual` on the log proves cross-service order ("persist Premium, then finish the transaction"). The S15 debug menu of test builds reuses the same fakes (toggle Premium, simulate offline), and `ADS_MODE=off` builds use the ads fake.

```ts
// packages/shell/src/services/ads/fake-ads.ts
import type { AdsPort, FullscreenResult, RewardResult } from './ads-port.ts';

export type FakeAdsScript = {
  isRewardedLoaded: boolean;
  interstitialResult: FullscreenResult;
  rewardResult: RewardResult;
  readonly calls: string[];
};

export function createFakeAds(script: FakeAdsScript): AdsPort {
  const record = (name: string): void => {
    script.calls.push(name);
  };
  return {
    initialize: () => {
      record('initialize');
      return Promise.resolve();
    },
    showInterstitial: () => {
      record('showInterstitial');
      return Promise.resolve(script.interstitialResult);
    },
    // ...every other port member, each recording its call
  };
}
```

The script object is mutable on purpose: the test changes `script.product` or `script.restoreResult` between steps, and an event fake exposes `emit(event)` to push listener events (`createFakePurchase` does both).

## Testing services over fakes

- One test per state of the flow (for Premium: every S12 state, including "persist Premium before `finishTransaction`", pending, cancel, error codes, empty product list, restore `sync-failed`, and "revoke only on an explicit revocation date").
- Let promise callbacks settle with `await flushMicrotasks()` (`setImmediate` under the hood), never fake timers.
- Assert order with the shared call log:

```ts
port.emit({ type: 'transaction', transaction: BOUGHT });
await flushMicrotasks();
const tail = script.calls.slice(script.calls.indexOf('requestPurchase'));
expect(tail).toStrictEqual(['requestPurchase', 'persist:true', 'finish:t1']);
```

`examples/premium-service.test.ts` is the complete example.

## Testing policies (ads, limits)

- A table of "blocks when …" cases with `it.each`.
- Every numeric limit as its own example at exactly the limit (3 completed levels, 180 000 ms, 2 levels since the last ad), plus one in the same millisecond. Boundaries are where mutants survive (see `coverage-and-mutation.md`).
- One property for the promise that must never break ("a Premium player never sees an ad").
- Run Stryker on the policy when it changes.

## Lint notes for mocks

- The lint config turns `@typescript-eslint/naming-convention` off for `__mocks__/**` (the GMA mock mirrors PascalCase library exports such as `AdsConsent`, `TestIds`) and exempts `__mocks__` from `no-default-export` (the library exports `mobileAds` as default).
- `jest/unbound-method` is the general fix for `expect(sdk.method)`; typing the `requireMock` result locally avoids the problem entirely.
