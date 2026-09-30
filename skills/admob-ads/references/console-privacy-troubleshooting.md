# AdMob console steps, privacy facts, testing and troubleshooting

## Contents

- AdMob console: the owner's steps A1-A6
- Privacy facts the ads bring
- Simulator smoke test (test variant)
- Jest root mock
- Troubleshooting by error phase and reason
- Common problems

## AdMob console: the owner's steps A1-A6

These are human steps. Ask the owner, explain in plain words what to click, and wait for the result; never guess IDs.

- **A1. Account (once).** Create the AdMob account with the owner's Google account; complete the payments and tax profile. Add the developer website (the same domain as the privacy policy).
- **A2. Per game: app and ad units.** Apps -> Add app -> iOS -> "not published yet" (link to the store listing later). Create three ad units: Banner (adaptive), Interstitial, Rewarded (reward amount 1, type `perk`; server-side verification off). The owner gives the app ID and the three unit IDs to Claude, who writes them into `apps/<game>/game.config.ts`.
- **A3. Privacy & messaging.** Create and publish the "European regulations" (GDPR/TCF) message for the app, with the privacy-policy URL and the languages English and German (Persian and Sorani are not needed for the EEA). Optionally create the "US state regulations" message. Do not create the "IDFA explainer" (decision D4: no tracking prompt in v1). Without a published message, real users see no form and `canRequestAds` stays false in the EEA.
- **A4. Blocking controls.** Block sensitive categories that conflict with spec 8.8 (at least gambling and betting; also dating, alcohol, get-rich-quick). Set the maximum ad content rating to PG, matching `MaxAdContentRating.PG` in code. There is no client API for category blocking. Review the Ad review center after launch.
- **A5. After the first release.** Link the AdMob app to the App Store listing. Publish `app-ads.txt` at the root of the developer website with the line AdMob shows under Apps -> app-ads.txt (format `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`). AdMob finds the site through the App Store listing's Marketing URL and can take up to 24 hours to verify. That field can only be edited with a new app version, so the store-pages step must fill it for the first version.
- **A6. Physical-device testing with live IDs** is never needed: test builds always use test units.

## Privacy facts the ads bring

Owned in depth by the privacy-and-network-audit work; the facts this skill must respect:

- Required-reason APIs in the Google pods (GMA 13.6.0, UMP 3.1.0): SystemBootTime `35F9.1`, UserDefaults `CA92.1`, DiskSpace `E174.1` (GMA); UserDefaults `CA92.1` (UMP). They must be declared in the app's `ios.privacyManifests`.
- Data the SDK manifests declare: GMA Device ID (linked, used for tracking); coarse location, advertising data, product interaction (linked, not tracking); performance, crash and other diagnostic data (not linked). UMP: coarse location, performance data, product interaction (not linked, not tracking). Neither sets `NSPrivacyTracking`; the app's own manifest keeps `NSPrivacyTracking: false`.
- No ATT in v1 (D4): without authorization the advertising identifier is all zeros; ads still serve (not personalised by IDFA) and SKAdNetwork attribution still works. The App Review guideline 5.1.2(i) question this raises is an owner decision in the store step. If D4 flips later: publish the IDFA explainer in AdMob, pass `userTrackingUsageDescription` (localised), and only then allow `expo-tracking-transparency` if its status API is needed.
- A privacy-policy URL is required by the App Store and by AdMob; the offline copy lives in Settings (S11c).

## Simulator smoke test (test variant)

Run once per SDK upgrade and before each release, on a fresh simulator, with `APP_VARIANT=test ADS_MODE=test`:

1. Debug menu -> consent geography EEA -> reset consent.
2. Finish the tutorial; the "Publisher Test Ads" form appears before any ad. Consent.
3. Home shows the "Test mode" banner (`home.banner-ad`).
4. Win 3 levels; tap Next -> a test interstitial appears; game music is suspended during it.
5. A rewarded hint grants exactly one hint.
6. Screenshot each step.
7. Debug "Simulate offline": the banner slot collapses, no interstitial, the rewarded button disappears, no message appears.

Screenshots and E2E flows run with `ADS_MODE=off`, so images are deterministic and the runtime network audit sees no ad traffic.

## Jest root mock

`templates/__mocks__/react-native-google-mobile-ads.ts` is a root manual mock: Jest applies it to every test without a `jest.mock` call, so importing an adapter never touches native code (without it, Jest fails with `TurboModuleRegistry.getEnforcing(...): 'RNGoogleMobileAdsModule' could not be found`). It lists `BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER` next to `ANCHORED_ADAPTIVE_BANNER`, because the adapter uses the large size (without it a banner test would pass `undefined` as the size). Shell tests use `fake-ads.ts` and `fake-consent.ts`; an adapter test that asserts on the SDK calls `jest.mock('react-native-google-mobile-ads')` plus `jest.requireMock(...)`. The mock lives in `__mocks__/`, which the lint config exempts from the no-default-export rule (the library's `mobileAds` is a default export).

## Troubleshooting by error phase and reason

`AdErrorPayload` (17.2.0) carries `phase` and `reason`; the reason list is open-ended.

| `phase` | `reason` | Meaning | Action |
|---|---|---|---|
| `load` | `no-fill`, `mediation-no-fill` | no ad available (routine) | nothing; not logged; preload again later |
| `load` | `network-error`, `timeout` | offline or slow network | nothing visible; the policy usually already blocked it |
| `load` | `invalid-request`, `invalid-argument`, `invalid-ad-string` | wrong unit ID or request | log; check `extra.adUnits` / `TestIds` and the mode |
| `load` | `app-id-missing` | `GADApplicationIdentifier` missing or wrong | check the plugin options and prebuild |
| `load` | `internal-error`, `server-error` | Google side | log; retry at the next quiet moment |
| `show` | any | the ad could not be presented | log; `showInterstitial` resolves `'unavailable'`; continue navigation |
| any | `ad-already-used` | a fullscreen ad object was shown twice | bug: each object is used once and destroyed after `CLOSED` |

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| Crash at launch mentioning `GADApplicationIdentifier` | plugin missing or no `iosAppId` | `admobPluginOptions` always passes an app ID; `npx expo prebuild --platform ios --clean` |
| `RNGoogleMobileAdsModule could not be found` in Jest | the root mock is missing | add `__mocks__/react-native-google-mobile-ads.ts` from the template |
| No consent form in the EEA on a real device | no published GDPR message (A3), or cached consent | publish the message; in a test build use debug geography EEA + reset |
| `canRequestAds` false forever | the player chose "Do not consent" where that blocks ads | expected; the privacy row lets them change it |
| Banner never appears | offline, Premium, consent not handled, `ADS_MODE=off`, or no fill | check the `shouldShowBanner` inputs in the debug menu; open the Ad Inspector (test builds only) |
| Real ads in a test build / test ads in a store build | wrong `ADS_MODE` pair | impossible by construction (`resolveBuildVariant` + `assertLiveIds`); the store-artifact gate checks `GADApplicationIdentifier` |
| Interstitial shown over the Result screen | the call sits in a Result effect instead of the button handler | only the Next / Replay / Try again handlers call `showInterstitialIfDue` |
| `SKAdNetworkItems` entries without `.skadnetwork` | a hand-edited or wrongly generated list | regenerate with `refresh-skadnetwork.ts`; each entry is `xxxxxxxxxx.skadnetwork` |

When filing a library issue, attach the RN, Expo and library versions, whether test IDs were used, and the Ad Inspector result.
