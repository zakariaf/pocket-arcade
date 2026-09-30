# Consent (Google UMP) and the ad gate

## Contents

- What the spec requires (S3, 4.2)
- ConsentPort and its adapter
- Which ConsentPort a build gets (ADS_MODE=off never calls UMP)
- The sequence: refresh, form, initialize, preload
- The consent moment (S3)
- When the Shell calls what
- The "Ad privacy choices" row
- Test-only consent tools
- Verified behaviour
- Tests

## What the spec requires (S3, 4.2)

Google requires a consent message for players in the EEA, the UK and Switzerland before it serves personalised ads; Germany is in the EEA. So the Shell includes Google's consent step (screen S3) and a permanent "Ad privacy choices" row in Settings. Spec S3 rules:

- Never shown before the player has finished the tutorial level: the first minute of the game is play, not paperwork.
- Shown before the first ad is ever requested.
- Only in regions where it is required. Everyone else never sees it.
- Offline or Premium: skipped. It is shown later only if an ad is ever about to load.
- Settings has a permanent "Ad privacy choices" row that reopens it (shown only where consent applies).

The form's content comes from Google (the GDPR/TCF message the owner publishes in the AdMob console, step A3); the Shell only decides when it appears. Do not set `requestNonPersonalizedAdsOnly` by hand: the SDK reads the TCF string that UMP writes.

## ConsentPort and its adapter

```ts
// packages/shell/src/services/consent/consent-port.ts
export type ConsentInfo = {
  readonly canRequestAds: boolean;
  readonly isPrivacyOptionsRequired: boolean; // show the "Ad privacy choices" row (S11)
};

export type ConsentPort = {
  readonly refresh: () => Promise<ConsentInfo>; // every launch (not Premium, ads enabled)
  readonly showFormIfRequired: () => Promise<ConsentInfo>; // screen S3
  readonly showPrivacyOptions: () => Promise<ConsentInfo>; // Settings > Ad privacy choices
};
```

`admob-consent-adapter.ts` (with the ads adapter and the test-only debug adapter, one of the three files allowed to import the SDK) maps:

| Port call | SDK call | On failure (offline) |
|---|---|---|
| `refresh()` | `AdsConsent.requestInfoUpdate(requestOptions)` | `AdsConsent.getConsentInfo()` (last session's answer) |
| `showFormIfRequired()` | `AdsConsent.loadAndShowConsentFormIfRequired()` | cached info |
| `showPrivacyOptions()` | `AdsConsent.showPrivacyOptionsForm()` | cached info |

`isPrivacyOptionsRequired` is `privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED`. Every failure goes to `onError` (the ErrorLogPort) and is never shown. Google requires a consent-info update at every launch and allows the cached `canRequestAds` when the update fails.

`fake-consent.ts` (`createFakeConsent({ afterRefresh, afterForm, calls })`) is what Shell tests use; it records every call in order.

## Which ConsentPort a build gets (ADS_MODE=off never calls UMP)

`consent-factory.ts` mirrors the ads factory: `createConsentPort(readAdsExtra().adsMode, { onError, debugGeography? })` returns

- `off`: a consent port that never touches the SDK and always answers `{ canRequestAds: false, isPrivacyOptionsRequired: false }` (no ads, no privacy row);
- `test` / `live`: `createAdmobConsentAdapter(options)`.

Why: `AdsConsent.requestInfoUpdate` asks Google's servers from the app process. `ADS_MODE=off` builds are the ones used for screenshots, E2E and the runtime network audit, which fails on any non-loopback socket of the app, and a game with `ads.isEnabled: false` must never show Google's form. Nothing else may call `createAdmobConsentAdapter` (`check-ads.mjs` rule `consent-factory`); the test-only debug menu also goes through `createConsentPort`, passing `debugGeography`.

The gate and the policy get the same answer: `isAdsEnabled` is `extra.game.adPolicy.isAdsEnabled && adsMode !== 'off'` (the game's master switch and the build's mode), and it is `false` while the test build's debug "Never show ads" switch is on.

## The sequence: refresh, form, initialize, preload

`ad-gate.ts` is pure orchestration over the two ports:

1. `refreshConsentAtLaunch(deps, input)`: at every launch, after the splash has rendered and never awaited by it. Skipped for Premium or when ads are disabled. Stores `canRequestAds` and the privacy-row flag through `onConsent`.
2. `prepareAds(deps, input)`: before the first ad is ever requested. Returns `false` (and does nothing) when Premium, ads disabled, the tutorial is not done, or offline. Otherwise: `consent.refresh()` -> `onConsent(info)`; if that answer already allows ads (consent given before, or not required in this region) straight to `ads.initialize()`; else the **intro step** `showIntro()` (the Shell's S3 screen, resolved when the player taps Continue) -> `consent.showFormIfRequired()` -> `onConsent(info)` -> if `canRequestAds`: `ads.initialize()` -> `preloadInterstitial()` -> `preloadRewarded()` -> `true`. `PrepareAdsDeps` is `AdGateDeps` plus `showIntro`.

`ads.initialize()` (in the adapter) calls `mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.PG })` and then `mobileAds().initialize()`, once. The library warns that ads may preload at initialisation, so consent always comes first: `setRequestConfiguration` and `initialize` run only when `canRequestAds` is true, and no ad is loaded before `initialize` resolves. No `ageRestrictedTreatment` or child-directed tag is set while decision D8 stays "general audience, not designed for children".

## The consent moment (S3)

Google draws the form; the Shell shows its own moment right before it, so the player knows why a form appears (toybox-screens' `ConsentIntroScreen`: "Ad privacy", the Google note, "Choose options"). Three templates of this skill run it:

- `services/ads/consent-moment-flow.ts` (`createConsentMomentFlow`): plain data, tested without React. It counts the open banner screens (`requestAdMoment()` returns the function that closes one), keeps the gate's latest facts (`updateInput`), runs `prepareAds` once per session while a banner screen is open, and shows the intro only while one is open: the moment never covers a level; if the player taps Play before Google answers, it waits for the next Home, Levels or Statistics visit. Once the player has seen it, it is not shown again this session, whatever the answer; a closed gate (offline, tutorial) retries when a fact changes. `refreshAtLaunch()` refreshes consent once, unless the moment already runs.
- `app/use-consent-moment.ts` (`useConsentMoment`) and `app/consent-moment.tsx` (`ConsentMoment`): the hook feeds the flow (the build's real ads mode, never a parity capture's forced banner, so a screenshot or E2E build never asks Google), saves each answer in the save's ads section, and the component draws `ConsentIntroScreen` full screen over the app (`accessibilityViewIsModal`) while the flow asks for it. Continue calls `continueToForm()`, and only then does `showFormIfRequired` run.
- `app/consent-moment-context.tsx` (`ConsentMomentContext`, `useOptionalConsentMoment`): `useBannerSlot` asks for the ad moment through it, and `useAdContext` reads the live `canRequestAds` from it (the saved answer outside it), so a banner appears as soon as the form allows it.

`ShellFeatures` mounts `<ConsentMoment isHeld={parts.isConsentMomentHeld} debug={debug.services}>` around the navigator (game-host-integration). **Parity (S3):** the capture of `s3-consent-moment` holds the moment. The parity launch passes `ShellLaunch.isConsentMomentHeld` (`request.plan.start === 'Consent' && isHeldParityStart(plan)`), and a held moment shows the intro at once, keeps it on screen, and never refreshes, never asks Google's form (Continue does nothing). `consent-moment.test.tsx` proves the order (intro, form, initialize), the held frame and the debug switch; `consent-moment-flow.test.ts` proves no intro where consent is not required, for Premium, offline or before the tutorial, the wait while no banner screen is open, the retry when online again and the once-per-session rule.

`check-ads.mjs` rule `consent-moment` (due once `packages/shell/src/app/shell-features.tsx` exists, Shell step 7) fails when the host is missing, when no app file renders `<ConsentMoment>`, when anything but the flow calls `prepareAds`, and when `useBannerSlot` does not ask for the ad moment.

## When the Shell calls what

| Moment | Call | Result used for |
|---|---|---|
| App start, once the Shell has rendered (never awaited by it) | `refreshConsentAtLaunch` (the consent moment's `refreshAtLaunch`) | `canRequestAds`, the Settings privacy row |
| A banner screen (Home, Levels, Statistics) is open and `prepareAds` has not run in this session | `prepareAds` with the intro step (the consent moment) | shows S3, then Google's form where required (first time: right after the tutorial, on Home), then initialises and preloads |
| Connectivity changes to online, the tutorial ends or Premium ends while a banner screen is open | `prepareAds` (the flow retries on the new facts) | the deferred S3 of the spec's offline rules |
| Premium becomes true | nothing | ads stop at once through the ad policy; the SDK stays initialised but idle |
| Settings > Ad privacy choices | `consent.showPrivacyOptions()` then `onConsent` | may turn ads off (`canRequestAds` false) |

Never call the form on app start, during a level, or from a `useEffect` that runs before the tutorial is finished.

## The "Ad privacy choices" row

- Visible only when `isPrivacyOptionsRequired` (from the latest `onConsent`) is true; hidden otherwise, never greyed out. Google requires a visible entry point wherever privacy options are required.
- Its handler calls `consent.showPrivacyOptions()` and passes the result to `onConsent`, which may turn ads off (`canRequestAds: false`): banners, interstitials and rewarded buttons then disappear through the ad policy.
- Test ID `settings.ad-privacy-row` (with `.icon`, `.label`, `.description` children, as in the Toybox screen map). Copy keys: `settings.ad-privacy.label` ("Ad privacy choices"), `settings.ad-privacy.description`. The optional pre-form explainer uses `consent.intro.*`. The row's look belongs to the S11 screen work; this skill owns only when it is visible and what its handler calls.

## Test-only consent tools

Only in test builds, reachable only through the Shell's test-only entry (`packages/shell/src/app/test-only.ts`), never in the adapter's store path:

- Debug geography: the debug menu calls `debugServices.createConsent(geography)` (`'eea' | 'regulated-us-state' | 'other'`; e2e-maestro's `packages/shell/src/screens/debug/debug-services.ts`), which passes `debugGeography` in the options of `createConsentPort` (the store variant passes nothing).
- `AdsConsent.reset()` to start over, and `AdsConsent.getUserChoices()` to show the decoded TCF choices.
- `mobileAds().openAdInspector()` to diagnose a missing ad.

These change consent behaviour for real users, so none of them may ship in a store build (the checker fails on them outside test-only files).

## Verified behaviour

On the iOS 26.5 simulator with Google's sample app ID (2026-09-26): after `AdsConsent.reset()`, `requestInfoUpdate({ debugGeography: EEA })` returned `{ status: 'REQUIRED', privacyOptionsRequirementStatus: 'REQUIRED', canRequestAds: false, isConsentFormAvailable: true }`, and `loadAndShowConsentFormIfRequired()` showed the "Publisher Test Ads" TCF form (Consent / Do not consent / Manage options). No test-device hash was needed on the simulator. The real form appears only after the owner publishes a GDPR message in the AdMob console (step A3); without it `canRequestAds` stays false in the EEA.

## Tests

- `ad-gate.test.ts`: refresh -> intro -> form -> initialize -> preload in that order; no intro and no form where consent is not required; no initialize without consent; no intro or form during the tutorial, for Premium, offline or with ads off; the launch refresh shows no form.
- `consent-moment-flow.test.ts` and `consent-moment.test.tsx`: the consent moment (above).
- `admob-consent-adapter.test.ts`: the privacy row flag, the offline fallback to `getConsentInfo`, and that a debug geography is passed only when set. It reads the root mock with `jest.mock('react-native-google-mobile-ads')` + `jest.requireMock(...)`.
- `consent-factory.test.ts`: `ADS_MODE=off` never calls `requestInfoUpdate` or the form; `test` and `live` use the adapter.
- `admob-consent-debug-adapter.test.ts`: the S15 tools reset consent only when asked, read the decoded choices, and open the Ad Inspector (root mock, `jest.requireMock`).
