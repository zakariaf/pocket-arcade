# Consent (Google UMP), Apple's tracking prompt (ATT) and the ad gate

## Contents

- What the spec requires (S3, 4.2)
- App Tracking Transparency (owner decision O1)
- ConsentPort and its adapter
- Which ConsentPort a build gets (ADS_MODE=off never calls UMP or ATT)
- The sequence: refresh, form, tracking, initialize, preload
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

## App Tracking Transparency (owner decision O1)

The owner decided on 2026-09-30 to follow Apple's rules (App Review guideline 5.1.2(i), App Tracking Transparency). This replaces the earlier product decision "no ATT prompt in v1" everywhere. Google's ads SDK may use the IDFA (the advertising identifier) for ads, and that counts as tracking, so on iOS the app asks Apple's system prompt before any ad request that could use it:

1. the Shell's S3 consent moment, where Google's form is required;
2. Google's UMP form, where required;
3. Apple's ATT prompt, only while the status is not-determined (`ConsentPort.requestTracking()`), after the form has closed and while the app is active;
4. then `ads.initialize()` and the preloads. So every ad request follows the ATT answer.

When the player declines, when the device restricts tracking (parental controls, a managed device, or "Allow Apps to Request to Track" switched off), or when the status cannot be read, ads still initialize and serve, without the IDFA: Google's SDK sends no IDFA in the ad request. The app never withholds a feature, a reward or Premium for the answer and never asks twice: Apple shows the prompt once per install (in the EU it may be asked again only a year after an answer), and guideline 5.1.2(i) forbids gating anything on it.

Never asked: with `ADS_MODE=off` (every E2E, screenshot and network-audit build), for Premium, offline (the moment retries once online, as for the form), before the tutorial is done, during a level (the prompt, like S3, waits until Home, Levels or Statistics is open), or in the held S3 parity frame.

**No IDFA explainer message in the AdMob console.** UMP can show its own "IDFA explainer" and then run the ATT prompt itself. The owner leaves that message unpublished (console step A3): the Shell's order above asks exactly once, through `expo-tracking-transparency` 57.0.2, which only `admob-consent-adapter.ts` imports.

**The text.** `NSUserTrackingUsageDescription` comes from the copy deck key `consent.tracking.usage-description` in the four Shell catalogs: the `expo-tracking-transparency` plugin entry in `shell-plugins.ts` gets the en text (`userTrackingPermission`), and `withShell` writes `locales.<lang>.ios.NSUserTrackingUsageDescription` for en, de, fa and ckb (Expo writes them to each language's `InfoPlist.strings` at prebuild). Without the key the package stops the app on its first status read, so `check-ads` rule `att-plugin` requires the plugin entry, the four texts and the package in every app. The AdMob plugin's own `userTrackingUsageDescription` option stays unset, so there is one writer. The fa and ckb texts are drafts for the owner's own review (never blocking).

| en | de |
|---|---|
| Google uses this to show you ads that fit your interests. You see ads either way, and the game itself collects no data. | Google nutzt das, um dir Werbung zu zeigen, die zu deinen Interessen passt. Werbung siehst du so oder so, und das Spiel selbst sammelt keine Daten. |

**How Expo reports the status.** `expo-tracking-transparency` 57.0.2 (`TrackingTransparencyPermissionRequester.swift`) maps `ATTrackingManager.AuthorizationStatus` `.authorized` to `granted`, **both `.denied` and `.restricted` to `denied`** (with `canAskAgain` false), and `.notDetermined` to `undetermined`; off iOS both calls answer `granted` without asking. So the adapter returns `authorized`, `denied` (declined or restricted, which behave the same for ads), `not-determined` (the system closed the prompt without an answer, or the app was not active), or `unavailable` (not iOS, or the read failed). `'restricted'` stays in `TrackingStatus` for other adapters and tests. The plugin also adds Android's `com.google.android.gms.permission.AD_ID` permission (for later).

**Sources, verified 2026-09-30:**

- Google, "Get started with UMP" (iOS): https://developers.google.com/admob/ios/privacy (a consent-info update at every launch, `loadAndPresentIfRequired` after it, `canRequestAds` before any ad request).
- Google, "IDFA explainer message": https://developers.google.com/admob/ios/privacy/idfa ("If a user denies ATT, continue to request ads ... The Google Mobile Ads SDK doesn't send IDFA in the ad request"; `NSUserTrackingUsageDescription` is required).
- react-native-google-mobile-ads, "European User Consent": https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent (a configured ATT message makes UMP run the ATT alert itself; otherwise the app asks ATT manually after consent is gathered).
- Apple, `requestTrackingAuthorization(completionHandler:)`: https://developer.apple.com/documentation/apptrackingtransparency/attrackingmanager/requesttrackingauthorization(completionhandler:) (no prompt unless the app is active; none when tracking is restricted or switched off, or a request is pending; in the EU one answer per year; France, Germany, Italy, Poland and Romania see a full-page sheet).
- Apple, `NSUserTrackingUsageDescription`: https://developer.apple.com/documentation/bundleresources/information-property-list/nsusertrackingusagedescription (required; the app crashes without it).
- Apple, `NSPrivacyTracking` and `NSPrivacyTrackingDomains`: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytracking and https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytrackingdomains (requests to a listed domain fail while tracking is not granted).
- Apple, App Review Guidelines 5.1.2(i): https://developer.apple.com/app-store/review/guidelines/ (explicit permission through the ATT APIs; nothing may require it).
- Expo, TrackingTransparency (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/tracking-transparency/ (plugin option `userTrackingPermission`; localise through the `ios` object of each locale).

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
  readonly requestTracking: () => Promise<TrackingStatus>; // Apple's ATT prompt, after the form
};

export type TrackingStatus = 'authorized' | 'denied' | 'restricted' | 'not-determined' | 'unavailable';
```

`admob-consent-adapter.ts` (with the ads adapter and the test-only debug adapter, one of the three files allowed to import the SDK) maps:

| Port call | SDK call | On failure (offline) |
|---|---|---|
| `refresh()` | `AdsConsent.requestInfoUpdate(requestOptions)` | `AdsConsent.getConsentInfo()` (last session's answer) |
| `showFormIfRequired()` | `AdsConsent.loadAndShowConsentFormIfRequired()` | cached info |
| `showPrivacyOptions()` | `AdsConsent.showPrivacyOptionsForm()` | cached info |
| `requestTracking()` | `getTrackingPermissionsAsync()`; while `undetermined` and once `AppState` is `active`, `requestTrackingPermissionsAsync()` (expo-tracking-transparency) | `'unavailable'` (logged, never a rejection); off iOS `'unavailable'` without a call |

`isPrivacyOptionsRequired` is `privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED`. Every failure goes to `onError` (the ErrorLogPort) and is never shown. Google requires a consent-info update at every launch and allows the cached `canRequestAds` when the update fails.

`fake-consent.ts` (`createFakeConsent({ afterRefresh, afterForm, tracking?, trackingAnswer?, calls })`) is what Shell tests use; it records every call in order ('requestTracking' included), answers the scripted ATT status (default `'unavailable'`, as with ads off), shows its "prompt" only while the status is `'not-determined'` (then the answer, default `'denied'`, sticks), and counts the prompts (`trackingPrompts()`). The root mock `__mocks__/expo-tracking-transparency.ts` (jest-expo mocks only the native module, whose calls answer undefined) lets the adapter test script the answers.

## Which ConsentPort a build gets (ADS_MODE=off never calls UMP or ATT)

`consent-factory.ts` mirrors the ads factory: `createConsentPort(readAdsExtra().adsMode, { onError, debugGeography? })` returns

- `off`: a consent port that never touches the SDK and always answers `{ canRequestAds: false, isPrivacyOptionsRequired: false }` (no ads, no privacy row), and whose `requestTracking()` answers `'unavailable'` without asking Apple;
- `test` / `live`: `createAdmobConsentAdapter(options)`.

Why: `AdsConsent.requestInfoUpdate` asks Google's servers from the app process. `ADS_MODE=off` builds are the ones used for screenshots, E2E and the runtime network audit, which fails on any non-loopback socket of the app, and a game with `ads.isEnabled: false` must never show Google's form. Nothing else may call `createAdmobConsentAdapter` (`check-ads.mjs` rule `consent-factory`); the test-only debug menu also goes through `createConsentPort`, passing `debugGeography`.

The gate and the policy get the same answer: `isAdsEnabled` is `extra.game.adPolicy.isAdsEnabled && adsMode !== 'off'` (the game's master switch and the build's mode), and it is `false` while the test build's debug "Never show ads" switch is on.

## The sequence: refresh, form, tracking, initialize, preload

`ad-gate.ts` is pure orchestration over the two ports:

1. `refreshConsentAtLaunch(deps, input)`: at every launch, after the splash has rendered and never awaited by it. Skipped for Premium or when ads are disabled. Stores `canRequestAds` and the privacy-row flag through `onConsent`.
2. `prepareAds(deps, input)`: before the first ad is ever requested. Returns `false` (and does nothing) when Premium, ads disabled, the tutorial is not done, or offline. Otherwise: `consent.refresh()` -> `onConsent(info)`; if that answer already allows ads (consent given before, or not required in this region) no intro and no form; else the **intro step** `showIntro()` (the Shell's S3 screen, resolved when the player taps Continue) -> `consent.showFormIfRequired()` -> `onConsent(info)`. Then, only if `canRequestAds`: `consent.requestTracking()` (Apple's ATT prompt while not-determined; whatever the answer, the gate goes on) -> `ads.initialize()` -> `preloadInterstitial()` -> `preloadRewarded()` -> `true`. `PrepareAdsDeps` is `AdGateDeps` plus `showIntro`.

`ads.initialize()` (in the adapter) calls `mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.PG })` and then `mobileAds().initialize()`, once. The library warns that ads may preload at initialisation, so consent always comes first: `setRequestConfiguration` and `initialize` run only when `canRequestAds` is true, and no ad is loaded before `initialize` resolves. No `ageRestrictedTreatment` or child-directed tag is set while decision D8 stays "general audience, not designed for children".

## The consent moment (S3)

Google draws the form; the Shell shows its own moment right before it, so the player knows why a form appears (toybox-screens' `ConsentIntroScreen`: "Ad privacy", the Google note, "Choose options"). Three templates of this skill run it:

- `services/ads/consent-moment-flow.ts` (`createConsentMomentFlow`): plain data, tested without React. It counts the open banner screens (`requestAdMoment()` returns the function that closes one), keeps the gate's latest facts (`updateInput`), runs `prepareAds` once per session while a banner screen is open, and shows the intro only while one is open: the moment never covers a level; if the player taps Play before Google answers, it waits for the next Home, Levels or Statistics visit. The ATT request goes through the same rule (`trackingOverAdScreen` holds `requestTracking` until a banner screen is open). Once the player has seen it, it is not shown again this session, whatever the answer; a closed gate (offline, tutorial) retries when a fact changes, also when the facts change while the gate is still deciding (a first-run debug link ends the tutorial in the same render that opens Home, and the banner slot's effect runs before the moment's). `refreshAtLaunch()` refreshes consent once, unless the moment already runs.
- `app/use-consent-moment.ts` (`useConsentMoment`) and `app/consent-moment.tsx` (`ConsentMoment`): the hook feeds the flow (the build's real ads mode, never a parity capture's forced banner, so a screenshot or E2E build never asks Google), saves each answer in the save's ads section, and the component draws `ConsentIntroScreen` full screen over the app (`accessibilityViewIsModal`) while the flow asks for it. Continue calls `continueToForm()`, and only then does `showFormIfRequired` run.
- `app/consent-moment-context.tsx` (`ConsentMomentContext`, `useOptionalConsentMoment`): `useBannerSlot` asks for the ad moment through it, and `useAdContext` reads the live `canRequestAds` from it (the saved answer outside it), so a banner appears as soon as the form allows it.

`ShellFeatures` mounts `<ConsentMoment isHeld={parts.isConsentMomentHeld} debug={debug.services}>` around the navigator (game-host-integration). **Parity (S3):** the capture of `s3-consent-moment` holds the moment. The parity launch passes `ShellLaunch.isConsentMomentHeld` (`request.plan.start === 'Consent' && isHeldParityStart(plan)`), and a held moment shows the intro at once, keeps it on screen, and never refreshes, never asks Google's form or Apple's prompt (Continue does nothing). `consent-moment.test.tsx` proves the order (intro, form, ATT, initialize), the held frame and the debug switch; `consent-moment-flow.test.ts` proves no intro where consent is not required, for Premium, offline or before the tutorial, the wait while no banner screen is open (for ATT too), the retry when online again or when the facts changed during a decision, and the once-per-session rule.

`check-ads.mjs` rule `consent-moment` (due once `packages/shell/src/app/shell-features.tsx` exists, Shell step 7) fails when the host is missing, when no app file renders `<ConsentMoment>`, when anything but the flow calls `prepareAds`, and when `useBannerSlot` does not ask for the ad moment.

## When the Shell calls what

| Moment | Call | Result used for |
|---|---|---|
| App start, once the Shell has rendered (never awaited by it) | `refreshConsentAtLaunch` (the consent moment's `refreshAtLaunch`) | `canRequestAds`, the Settings privacy row |
| A banner screen (Home, Levels, Statistics) is open and `prepareAds` has not run in this session | `prepareAds` with the intro step (the consent moment) | shows S3, then Google's form where required (first time: right after the tutorial, on Home), then Apple's ATT prompt while not-determined, then initialises and preloads |
| Connectivity changes to online, the tutorial ends or Premium ends while a banner screen is open | `prepareAds` (the flow retries on the new facts) | the deferred S3 of the spec's offline rules |
| Premium becomes true | nothing | ads stop at once through the ad policy; the SDK stays initialised but idle |
| Settings > Ad privacy choices | `consent.showPrivacyOptions()` then `onConsent` | may turn ads off (`canRequestAds` false) |

Never call the form or the ATT prompt on app start, during a level, or from a `useEffect` that runs before the tutorial is finished. Settings has no ATT row: the player changes the answer in iOS Settings > Privacy & Security > Tracking.

## The "Ad privacy choices" row

- Visible only when `isPrivacyOptionsRequired` (from the latest `onConsent`) is true; hidden otherwise, never greyed out. Google requires a visible entry point wherever privacy options are required.
- Its handler calls `consent.showPrivacyOptions()` and passes the result to `onConsent`, which may turn ads off (`canRequestAds: false`): banners, interstitials and rewarded buttons then disappear through the ad policy.
- Test ID `settings.ad-privacy-row` (with `.icon`, `.label`, `.description` children, as in the Toybox screen map). Copy keys: `settings.ad-privacy.label` ("Ad privacy choices"), `settings.ad-privacy.description`. The optional pre-form explainer uses `consent.intro.*`. The row's look belongs to the S11 screen work; this skill owns only when it is visible and what its handler calls.

## Test-only consent tools

Only in test builds, reachable only through the Shell's test-only entry (`packages/shell/src/app/test-only.ts`), never in the adapter's store path:

- Debug geography: the debug menu calls `debugServices.createConsent(geography)` (`'eea' | 'regulated-us-state' | 'other'`; e2e-maestro's `packages/shell/src/screens/debug/debug-services.ts`), which passes `debugGeography` in the options of `createConsentPort` (the store variant passes nothing).
- `AdsConsent.reset()` to start over, and `AdsConsent.getUserChoices()` to show the decoded TCF choices. Apple's ATT answer has no reset from code: delete the app (a fresh install asks again) or change it in Settings > Privacy & Security > Tracking.
- `mobileAds().openAdInspector()` to diagnose a missing ad.

These change consent behaviour for real users, so none of them may ship in a store build (the checker fails on them outside test-only files).

## Verified behaviour

**ATT on the simulator (2026-09-30, iOS 26.5, Line Siege `ADS_MODE=test` Release build, debug geography EEA):** the order S3 -> Google's form ("Consent") -> Apple's prompt -> a test banner on Levels, and a declined prompt still loads the banner; the record and screenshots are in console-privacy-troubleshooting.md, "Simulator smoke test". Maestro's `launchApp` grants every permission by default, the ATT answer included (`kTCCServiceUserTracking` allowed, so the status reads authorized and no prompt appears): the ATT smoke test launches with `xcrun simctl launch <udid> <bundleId>` or `launchApp: { permissions: { all: unset } }`.

On the iOS 26.5 simulator with Google's sample app ID (2026-09-26): after `AdsConsent.reset()`, `requestInfoUpdate({ debugGeography: EEA })` returned `{ status: 'REQUIRED', privacyOptionsRequirementStatus: 'REQUIRED', canRequestAds: false, isConsentFormAvailable: true }`, and `loadAndShowConsentFormIfRequired()` showed the "Publisher Test Ads" TCF form (Consent / Do not consent / Manage options). No test-device hash was needed on the simulator. The real form appears only after the owner publishes a GDPR message in the AdMob console (step A3); without it `canRequestAds` stays false in the EEA.

## Tests

- `ad-gate.test.ts`: refresh -> intro -> form -> ATT -> initialize -> preload in that order; no intro and no form where consent is not required (ATT still first); declined, restricted and unavailable tracking still initialize, and Apple is asked once; no ATT and no initialize without consent; no intro, form or ATT during the tutorial, for Premium, offline or with ads off; the launch refresh shows no form.
- `consent-moment-flow.test.ts` and `consent-moment.test.tsx`: the consent moment (above).
- `admob-consent-adapter.test.ts`: the privacy row flag, the offline fallback to `getConsentInfo`, and that a debug geography is passed only when set; `requestTracking` asks once while not-determined, never again after an answer (granted gives authorized, denied or restricted gives denied), waits until the app is active, resolves `'unavailable'` (logged) when the read fails, and never touches the module off iOS. It reads the root mocks with `jest.mock(...)` + `jest.requireMock(...)`; React Native's Jest setup makes `AppState.currentState` a function, so the test defines the state it needs and puts the mock back.
- `consent-factory.test.ts`: `ADS_MODE=off` never calls `requestInfoUpdate`, the form or the tracking module; `test` and `live` use the adapter.
- `admob-consent-debug-adapter.test.ts`: the S15 tools reset consent only when asked (never the ATT answer), read the decoded choices, and open the Ad Inspector (root mock, `jest.requireMock`).
- `check-ad-behaviour.mjs` runs the same order against the repo's real gate, flow, adapter and factory with scripted stand-ins (rules `consent-order`, `consent-moment-flow`, `tracking-adapter`, `consent-factory`); `check-ads.mjs` rules `att-adapter-only`, `att-order` and `att-plugin` check the sources statically.
