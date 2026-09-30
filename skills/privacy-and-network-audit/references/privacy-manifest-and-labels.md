# Privacy manifest, App Privacy answers and the 5.1.2 decision

## Contents

- Why the app aggregates every pod's manifest
- PRIVACY_MANIFESTS
- audit:privacy and this skill's audit-privacy-manifest.mjs
- App Privacy questionnaire input
- The 5.1.2 decision (owner, store step)
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

plus `NSPrivacyTracking: false`. The list grows when a pod declares something new (for example when a game adds SQLite, Skia or the audio library): run the audit after every prebuild and add what it reports.

## audit:privacy and this skill's audit-privacy-manifest.mjs

- `npm run audit:privacy [-- --app <game-id>]` (template `packages/tooling/src/audit/audit-privacy.ts`, with `privacy-manifest.ts` for plist reading and reason merging) runs after `npx expo prebuild --platform ios --clean` (prebuild runs pod install). Without `--app` it audits every app that has `ios/Pods`. It fails when the app config lacks a reason a pod declares, when a pod other than Google's declares tracking (`NSPrivacyTracking: true` or tracking domains), or when no app is prebuilt; it prints the aggregated table and the collected data. It reads plists with `plutil` (macOS).
- This skill's `audit-privacy-manifest.mjs` does the same from the skill side, with no project code: it parses the pods' plists itself (binary ones through `plutil`), reads the declared reasons from `privacy-manifest.ts`, also checks that the prebuilt `ios/<App>/PrivacyInfo.xcprivacy` is current (`prebuilt-stale`), and prints the App Privacy input. Verified on the SDK 57 services spike: 28 pod manifests, the four reasons above, and the collected-data table below.

Only the Google ad pods may declare tracking (spec N2 and decision D4). A new pod that declares tracking means an analytics or attribution SDK slipped in: remove the package that brought it.

## App Privacy questionnaire input

The owner fills in App Store Connect's "App Privacy" questionnaire (a human step in the store-pages work; it is believed not to be available in the API). Input, from the verified pod manifests:

| Data type | Pod | Linked to user | Used for tracking | Purposes (Google's disclosure page) |
|---|---|---|---|---|
| Device ID | Google-Mobile-Ads-SDK 13.6.0 | yes | yes | Third-party advertising, analytics |
| Coarse location | GMA; UMP 3.1.0 | yes (GMA), no (UMP) | no | Third-party advertising, analytics |
| Advertising data | GMA | yes | no | Third-party advertising, analytics |
| Product interaction | GMA; UMP | yes (GMA), no (UMP) | no | Third-party advertising, analytics |
| Performance data | GMA; UMP | no | no | Analytics |
| Crash data | GMA | no | no | Analytics |
| Other diagnostic data | GMA | no | no | Analytics |

Our own code collects nothing: no account, no analytics, no crash reporting, no server. Saves, settings, the consent string UMP stores, and Premium stay on the phone. So the store listing can claim "no accounts, no personal data collected by us, fully playable offline", but not "collects no data" (spec 4.2). Google makes the developer responsible for matching the answers to the SDK's disclosures (its data-disclosure page, last updated 2026-09-25).

## The 5.1.2 decision (owner, store step)

App Review Guideline 5.1.2(i): "You must receive explicit permission from users via the App Tracking Transparency APIs to track their activity." The GMA manifest marks Device ID as used for tracking, while decision D4 says no ATT prompt in v1. Without ATT the advertising identifier is all zeros; ads still serve (not personalised by IDFA) and SKAdNetwork attribution still works.

| Option | App Privacy answer for Device ID | Binary | Risk |
|---|---|---|---|
| 1 (default for the first submission) | as the manifest says: linked, used for tracking | no ATT (D4) | review may reject under 5.1.2(i) and ask for ATT |
| 2 | used for tracking | flip D4: publish the AdMob "IDFA explainer" message and add `userTrackingUsageDescription` (localised) | one more system prompt; most consistent |
| 3 | not used for tracking | no ATT | contradicts the SDK manifest Google tells developers to reconcile |

Option 1 keeps the answers consistent with the binary; if App Review objects, option 2 is the planned fallback (a config and console change, no Shell code change). Option 3 is not used. The owner records the choice in the store-pages step; ask, explain the three rows in plain words, and wait.

## Other privacy items

- A privacy-policy URL is required by both stores and by AdMob; the offline copy lives in Settings (S11c). Its link lives in `packages/shell/src/config/external-links.ts`.
- `app-ads.txt` on the developer website is an AdMob step after the first release (handled by the ads work).
