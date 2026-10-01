# Privacy manifest, App Privacy answers and App Tracking Transparency

## Contents

- Why the app aggregates every pod's manifest
- PRIVACY_MANIFESTS
- audit:privacy and this skill's audit-privacy-manifest.mjs
- App Privacy questionnaire input
- App Tracking Transparency (owner decision O1)
- Other privacy items

## Why the app aggregates every pod's manifest

Apple does not reliably read the privacy manifests of static CocoaPods, so the app's own `PrivacyInfo.xcprivacy` must declare every required-reason API that any pod declares. Expo writes that file from `ios.privacyManifests` in the app config at prebuild; `withShell` sets `ios.privacyManifests: PRIVACY_MANIFESTS`. The fix for a gap is always an entry in `packages/shell/src/config/privacy-manifest.ts`, never an edit of `ios/`. If Apple emails `ITMS-91053` (missing API declaration) after an upload, the audit shows which declaration is missing.

## PRIVACY_MANIFESTS

Verified for Expo SDK 57 + Google Mobile Ads + expo-iap (28 pod manifests, 2026-09-26):

| Category | Reason | Declared by |
|---|---|---|
| `NSPrivacyAccessedAPICategoryUserDefaults` | `CA92.1` | Google-Mobile-Ads-SDK, GoogleUserMessagingPlatform, others |
| `NSPrivacyAccessedAPICategoryFileTimestamp` | `C617.1` | React Native dependencies |
| `NSPrivacyAccessedAPICategorySystemBootTime` | `35F9.1` | Google-Mobile-Ads-SDK |
| `NSPrivacyAccessedAPICategoryDiskSpace` | `E174.1` | Google-Mobile-Ads-SDK |

plus `NSPrivacyTracking: false` and no `NSPrivacyTrackingDomains` (next sections: our code tracks nothing, and a listed domain is blocked for every player who declines ATT). The list grows when a pod declares something new (for example when a game adds SQLite, Skia or the audio library): run the audit after every prebuild and add what it reports.

## audit:privacy and this skill's audit-privacy-manifest.mjs

- `npm run audit:privacy [-- --app <game-id>]` (template `packages/tooling/src/audit/audit-privacy.ts`, with `privacy-manifest.ts` for plist reading and reason merging) runs after `npx expo prebuild --platform ios --clean` (prebuild runs pod install). Without `--app` it audits every app that has `ios/Pods`. It fails when the app config lacks a reason a pod declares, when a pod other than Google's declares tracking (`NSPrivacyTracking: true` or tracking domains), when the app's own manifest declares tracking or tracking domains, or when no app is prebuilt; it prints the aggregated table, the collected data and the tracking answer (`App Privacy: DeviceID collected, linked to the user, used for tracking by the third-party ads SDK Google-Mobile-Ads-SDK (the app asks App Tracking Transparency first)`). It reads plists with `plutil` (macOS).
- This skill's `audit-privacy-manifest.mjs` does the same from the skill side, with no project code: it parses the pods' plists itself (binary ones through `plutil`), reads the declared reasons from `privacy-manifest.ts`, also checks that the prebuilt `ios/<App>/PrivacyInfo.xcprivacy` is current (`prebuilt-stale`), and prints the App Privacy input. Verified on the SDK 57 services spike: 28 pod manifests, the four reasons above, and the collected-data table below.

Only the Google ad pods may declare tracking (spec N2). A new pod that declares tracking means an analytics or attribution SDK slipped in: remove the package that brought it. `ExpoTrackingTransparency` (the ATT prompt's pod, from the npm package through a local podspec) declares no tracking and has no network code; it asks Apple's system prompt, nothing more.

## App Privacy questionnaire input

The owner fills in App Store Connect's "App Privacy" questionnaire (owner step G3; it is believed not to be available in the API). Input, from the verified pod manifests:

| Data type | Pod | Linked to user | Used for tracking | Purposes (Google's disclosure page) |
|---|---|---|---|---|
| Device ID | Google-Mobile-Ads-SDK 13.6.0 (the third-party ads SDK) | yes | **yes**: answer "used for tracking"; the app asks App Tracking Transparency before any ad request that could use the IDFA | Third-party advertising, analytics |
| Coarse location | GMA; UMP 3.1.0 | yes (GMA), no (UMP) | no | Third-party advertising, analytics |
| Advertising data | GMA | yes | no | Third-party advertising, analytics |
| Product interaction | GMA; UMP | yes (GMA), no (UMP) | no | Third-party advertising, analytics |
| Performance data | GMA; UMP | no | no | Analytics |
| Crash data | GMA | no | no | Analytics |
| Other diagnostic data | GMA | no | no | Analytics |

Our own code collects nothing: no account, no analytics, no crash reporting, no server. Saves, settings, the consent string UMP stores, the ATT answer (kept by iOS) and Premium stay on the phone. So the store listing can claim "no accounts, no personal data collected by us, fully playable offline", but not "collects no data" (spec 4.2). Google makes the developer responsible for matching the answers to the SDK's disclosures (its data-disclosure page, last updated 2026-09-25).

## App Tracking Transparency (owner decision O1)

On 2026-09-30 the owner chose to follow Apple's rules: guideline 5.1.2(i), "You must receive explicit permission from users via the App Tracking Transparency APIs to track their activity." This replaces the old "no ATT prompt in v1" (the product spec's decision D4) everywhere.

- **Order.** S3 (the Shell's consent intro, when Google's form is required), then Google's UMP form when required, then Apple's system prompt when the tracking status is not determined, then the ads SDK starts. So every ad request follows the ATT answer. The prompt is asked only while the app is active, never with ads mode off (every E2E and screenshot build), never for Premium, never offline (the moment retries online), never before the tutorial or during a level. admob-ads owns the flow (`consent-moment-flow.ts`, `ConsentPort.requestTracking` in `admob-consent-adapter.ts`, the only importer of `expo-tracking-transparency`).
- **Declined, restricted or unavailable.** Ads still initialise and serve; the Google Mobile Ads SDK does not send the IDFA in the ad request.
- **No IDFA explainer message in the AdMob console.** With one published, UMP runs its own ATT flow; the app asks ATT itself after the form, as react-native-google-mobile-ads documents for the manual path.
- **The text.** `NSUserTrackingUsageDescription`: the `expo-tracking-transparency` plugin's `userTrackingPermission` (the en catalog text) in `shell-plugins.ts`, and `withShell`'s `locales.<lang>.ios.NSUserTrackingUsageDescription` for en, de, fa and ckb from the Shell catalogs' `consent.tracking.usage-description` (Expo writes each `<lang>.lproj/InfoPlist.strings` at prebuild). The AdMob plugin's own `userTrackingUsageDescription` stays unset: one source. The fa and ckb texts are the owner's to review (owner decision O6: listed as an owner step, never waited for).
- **The app's privacy manifest.** `NSPrivacyTracking: false` and no `NSPrivacyTrackingDomains`: our code tracks nothing, and Apple fails requests to listed tracking domains for players who have not granted permission, which would stop their ads. Only Google's pods declare tracking, in their own manifests.
- **App Privacy.** Device ID: collected, linked to the user, used for tracking, by the third-party ads SDK (table above).
- **Network.** `expo-tracking-transparency` is a system wrapper with no network code (`assets/privacy-facts.json` `systemWrappers`); N3 still allows only the ads and store SDKs online.

Checks: `audit-repo.mjs` rule `att-config` (plugin, localized text, catalog strings, one source) and the import rule (only the consent adapter), `audit-privacy-manifest.mjs` rule `app-tracking`, `audit-app-bundle.mjs` rule `att-string` (the text in `Info.plist` and in every language of the built app), and the tooling's `network-config-layer.ts` in `npm run audit:network`.

Sources, re-read on 2026-09-30 (the facts above match them):

- Google, AdMob iOS privacy: https://developers.google.com/admob/ios/privacy (last updated 2026-09-29)
- Google, IDFA message and ATT: https://developers.google.com/admob/ios/privacy/idfa ("If a user denies ATT consent, you can still request ads, but the Google Mobile Ads SDK will not send the IDFA in the ad request"; last updated 2026-09-29)
- react-native-google-mobile-ads, European user consent: https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent (an ATT message in AdMob makes UMP handle the alert and show the IDFA explainer; without one, request ATT manually after consent is gathered)
- Apple, `requestTrackingAuthorization(completionHandler:)`: https://developer.apple.com/documentation/apptrackingtransparency/attrackingmanager/requesttrackingauthorization(completionhandler:) (no prompt unless the app is active; `restricted` when tracking is restricted on the device; in the EU one answer per year)
- Apple, `NSUserTrackingUsageDescription`: https://developer.apple.com/documentation/bundleresources/information-property-list/nsusertrackingusagedescription (required; the app crashes if it uses the framework without it)
- Apple, `NSPrivacyTracking`: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytracking and `NSPrivacyTrackingDomains`: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytrackingdomains (requests to listed domains fail without permission)
- Apple, App Review Guidelines 5.1.2(i): https://developer.apple.com/app-store/review/guidelines/
- Expo SDK 57 TrackingTransparency: https://docs.expo.dev/versions/v57.0.0/sdk/tracking-transparency/ (the `userTrackingPermission` plugin option; localise the text through each locale's `ios.NSUserTrackingUsageDescription`, written to `InfoPlist.strings` at prebuild)

## Other privacy items

- A privacy-policy URL is required by both stores and by AdMob; the offline copy lives in Settings (S11c). Its link lives in `packages/shell/src/config/external-links.ts`.
- `app-ads.txt` on the developer website is an AdMob step after the first release (handled by the ads work).
