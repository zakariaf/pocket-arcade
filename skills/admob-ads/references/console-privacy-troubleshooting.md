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
- **A3. Privacy & messaging.** Create and publish the "European regulations" (GDPR/TCF) message for the app, with the privacy-policy URL and the languages English and German (Persian and Sorani are not needed for the EEA). Optionally create the "US state regulations" message. Do not publish an "IDFA explainer" message: the app asks Apple's tracking prompt itself, right after Google's form (owner decision O1), and a published IDFA message would make UMP run a second ATT flow of its own. Without a published GDPR message, real users see no form and `canRequestAds` stays false in the EEA.
- **A4. Blocking controls.** Block sensitive categories that conflict with spec 8.8 (at least gambling and betting; also dating, alcohol, get-rich-quick). Set the maximum ad content rating to PG, matching `MaxAdContentRating.PG` in code. There is no client API for category blocking. Review the Ad review center after launch.
- **A5. After the first release.** Link the AdMob app to the App Store listing. Publish `app-ads.txt` at the root of the developer website with the line AdMob shows under Apps -> app-ads.txt (format `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`). AdMob finds the site through the App Store listing's Marketing URL and can take up to 24 hours to verify. That field can only be edited with a new app version, so the store-pages step must fill it for the first version.
- **A6. Physical-device testing with live IDs** is never needed: test builds always use test units.

## Privacy facts the ads bring

Owned in depth by the privacy-and-network-audit work; the facts this skill must respect:

- Required-reason APIs in the Google pods (GMA 13.6.0, UMP 3.1.0): SystemBootTime `35F9.1`, UserDefaults `CA92.1`, DiskSpace `E174.1` (GMA); UserDefaults `CA92.1` (UMP). They must be declared in the app's `ios.privacyManifests`.
- Data the SDK manifests declare: GMA Device ID (linked, used for tracking); coarse location, advertising data, product interaction (linked, not tracking); performance, crash and other diagnostic data (not linked). UMP: coarse location, performance data, product interaction (not linked, not tracking). The App Privacy answers therefore include **Device ID: collected, linked to the user, used for tracking, by the third-party ads SDK (Google Mobile Ads)**.
- The app's own privacy manifest keeps `NSPrivacyTracking: false` and lists no `NSPrivacyTrackingDomains`: the Shell's code tracks nothing, and Apple fails requests to listed domains for players who decline (which would stop ads for them). Only Google's pods may declare tracking in their own manifests (Apple's `NSPrivacyTracking` page: "your app or third-party SDK"). `ExpoTrackingTransparency` is a no-network system wrapper; the N3 network audit still allows only the ads and store SDKs.
- App Tracking Transparency (owner decision O1, guideline 5.1.2(i)): Apple's prompt comes after Google's form and before the first ad request (references/consent-flow.md). Declined, restricted or unavailable: the advertising identifier is all zeros, ads still serve without it and SKAdNetwork attribution still works. Nothing in the app depends on the answer.
- A privacy-policy URL is required by the App Store and by AdMob; the offline copy lives in Settings (S11c).

## Simulator smoke test (test variant)

Run once per SDK upgrade and before each release, on a fresh simulator of your own (`e07-<purpose>`, every `simctl` and Maestro call naming its UDID, Maestro with its own `--driver-host-port`), with `APP_VARIANT=test ADS_MODE=test`. Install fresh (`xcrun simctl uninstall <udid> <bundleId>`, then `install`) so Google's and Apple's answers start empty, and launch with `xcrun simctl launch <udid> <bundleId>`: Maestro's `launchApp` grants every permission by default, the ATT answer included, and the prompt would then never appear (use `launchApp: { permissions: { all: unset } }` in a flow that must launch).

1. Consent geography EEA (debug menu or a test build made with the EEA debug geography); finish the tutorial.
2. On Home (or Levels, Statistics) the Shell's S3 moment shows first ("Ad privacy", "Choose options"). Tap it: the "Publisher Test Ads" form appears before any ad. Consent.
3. Apple's prompt ("Allow ... to track your activity across other companies' apps and websites?") appears right after the form closes, with the `consent.tracking.usage-description` text. Tap "Ask App Not to Track".
4. The "Test mode" banner still loads (`home.banner-ad`, `levels.banner-ad`): declining costs nothing.
5. Relaunch: neither the form nor the ATT prompt comes back. A second fresh install that taps "Allow" also gets the banner.
6. Win 3 levels; tap Next -> a test interstitial appears; game music is suspended during it.
7. A rewarded hint grants exactly one hint (games with solver hints).
8. **Rewarded continue:** lose level 1, tap "Watch an ad to continue" (`result.continue-ad-button`); the test rewarded ad plays, and after `EARNED_REWARD` the run resumes where it was lost (the continue perk; the E2E Premium continue flow covers the free path in `ADS_MODE=off` builds).
9. Screenshot each step.
10. Debug "Simulate offline": the banner slot collapses, no interstitial, the rewarded button disappears, no message appears.

Screenshots and E2E flows run with `ADS_MODE=off`, so images are deterministic, the runtime network audit sees no ad traffic, and neither Google's form nor Apple's prompt ever shows.

**Recorded run, 2026-09-30** (Line Siege, `ADS_MODE=test` Release build, simulator `e07-r4-host-att`, iOS 26.5, debug geography EEA): a fresh install launched with `xcrun simctl launch`, then the first-run debug link to Home: S3 showed over Home at once; "Choose options" opened the "Publisher Test Ads" form; "Consent" closed it and Apple's prompt appeared right away with the en text ("Google uses this to show you ads that fit your interests. ..."; the base `Info.plist` and the four `<lang>.lproj/InfoPlist.strings` held the four texts); "Ask App Not to Track" (TCC `kTCCServiceUserTracking` = denied) and the "Test mode" adaptive banner loaded on Home. A relaunch showed neither S3 nor the prompt, with the banner. A second fresh install answered "Allow" (TCC allowed) and got the banner too. The rewarded continue: `action=lose-level` on level 1, `result.continue-ad-button`, the test rewarded video, Close: the run resumed on the Game screen (`game.screen`, no Result), score 85 kept, the monsters pushed back. One finding: after the rewarded ad the board stayed on the continue animation's first frame (the restored heart small, the redrawn tray empty) until the next move drew the right state; the Premium continue animated in full. Reported to the board-rendering owner; the state and the save were right. An earlier run started with Maestro's `launchApp`, which granted the ATT answer, so no prompt appeared: hence the `simctl launch` rule above.

## Jest root mock

`templates/__mocks__/react-native-google-mobile-ads.ts` is a root manual mock: Jest applies it to every test without a `jest.mock` call, so importing an adapter never touches native code (without it, Jest fails with `TurboModuleRegistry.getEnforcing(...): 'RNGoogleMobileAdsModule' could not be found`). It lists `BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER` next to `ANCHORED_ADAPTIVE_BANNER`, because the adapter uses the large size (without it a banner test would pass `undefined` as the size). Shell tests use `fake-ads.ts` and `fake-consent.ts`; an adapter test that asserts on the SDK calls `jest.mock('react-native-google-mobile-ads')` plus `jest.requireMock(...)`. `templates/__mocks__/expo-tracking-transparency.ts` does the same for the tracking module (jest-expo mocks only its native module, whose calls answer undefined): by default the status is `undetermined` and a request answers `denied`. The mock lives in `__mocks__/`, which the lint config exempts from the no-default-export rule (the library's `mobileAds` is a default export).

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
| Apple's tracking prompt never appears on the simulator | Maestro's `launchApp` granted every permission (the status reads authorized), the app was not active, or the answer was given before | launch with `xcrun simctl launch`, or `launchApp: { permissions: { all: unset } }`; delete and reinstall the app to ask again |
| The app stops at the first ATT status read ("missing 'NSUserTrackingUsageDescription'") | the `expo-tracking-transparency` plugin entry or the prebuild is missing | `check-ads` rule `att-plugin`; add the entry to `shell-plugins.ts`, then `npx expo prebuild --platform ios --clean` |
| Two tracking prompts, or UMP's own explainer before Apple's | an IDFA explainer message was published in AdMob | unpublish it (step A3): the app asks ATT itself |
| Banner never appears | offline, Premium, consent not handled, `ADS_MODE=off`, or no fill | check the `shouldShowBanner` inputs in the debug menu; open the Ad Inspector (test builds only) |
| Real ads in a test build / test ads in a store build | wrong `ADS_MODE` pair | impossible by construction (`resolveBuildVariant` + `assertLiveIds`); the store-artifact gate checks `GADApplicationIdentifier` |
| Interstitial shown over the Result screen | the call sits in a Result effect instead of the button handler | only the Next / Replay / Try again handlers call `showInterstitialIfDue` |
| `SKAdNetworkItems` entries without `.skadnetwork` | a hand-edited or wrongly generated list | regenerate with `refresh-skadnetwork.ts`; each entry is `xxxxxxxxxx.skadnetwork` |

When filing a library issue, attach the RN, Expo and library versions, whether test IDs were used, and the Ad Inspector result.
