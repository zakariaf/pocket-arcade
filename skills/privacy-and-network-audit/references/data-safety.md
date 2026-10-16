# Google Play Data safety answers

## Contents

- What the form is and who fills it in
- The answers
- Why each answer is what it is
- A game with ads switched off
- Printing the answers
- When the answers change

## What the form is and who fills it in

Google Play's Data safety form (Play Console, the app, Policy and programs, App content, Data safety) is the Android twin of Apple's App Privacy questionnaire. Spec 4.2 point 1: both "must declare what the ads component collects. That usually includes device identifiers, approximate location from the network, and ad interaction data. ... So we cannot claim 'collects no data'. We CAN claim no accounts, no personal data collected by us, and fully playable offline."

The owner fills the form in at owner step GP4 (the Play Console has no API for it). Claude prints the answers with `npm run audit:privacy -- --platform android [--app <game-id>]` and sends them in the GP4 request; after the first real Android build Claude sends them again if they differ.

## The answers

For a game with ads on (every game today), `data-safety.ts` prints:

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes: the ads SDK (Google Mobile Ads) does; our own code collects nothing |
| Is all of the user data collected by your app encrypted in transit? | Yes |
| Do you provide a way for users to request that their data is deleted? | No: there is no account to delete, and our own code stores nothing off the phone |
| Location > Approximate location | collected and shared by the ads SDK, for advertising |
| Device or other IDs | collected and shared by the ads SDK, for advertising |
| App activity > App interactions | collected and shared by the ads SDK, for advertising |
| App info and performance > Diagnostics | collected and shared by the ads SDK, for advertising |
| Every other data type (personal info, financial info, messages, photos, audio, files, calendar, contacts, health, web browsing) | not collected |
| Advertising ID (App content, a separate declaration) | Yes, the app uses an advertising ID, for advertising |

## Why each answer is what it is

- **Collected and shared by the ads SDK.** Google makes the developer answer for every SDK in the app. Google Mobile Ads reads the advertising ID (the `AD_ID` permission is on the allowlist for it), the network's approximate location, ad interactions and diagnostics, and sends them to Google: that is collection and sharing with a third party, for advertising. The UMP consent form is part of the same ads component.
- **Our own code collects nothing.** Spec N2 and N3: no account, no server, no analytics, no crash reporting; the save, the settings, the consent string and the Premium flag stay on the phone. The network audit (`audit:network`, all layers) is the proof behind this line.
- **Encrypted in transit.** The ads and billing SDKs use HTTPS only, and the app allows no cleartext traffic (rule `android-cleartext`, the merged-manifest audit).
- **No deletion request.** There is no account and no data of ours on any server. Players clear the game's data by uninstalling it; the advertising ID is reset or deleted in Android's settings.
- **Google Play Billing** takes the payment for Premium in Google Play's own purchase screen: the app never sees payment details and keeps only its Premium flag on the phone, so it declares no financial info.
- **The Advertising ID declaration** (App content, separate from Data safety) is "Yes, for advertising" whenever the manifest holds `com.google.android.gms.permission.AD_ID`, which every build with ads does.

## A game with ads switched off

When a game's `game.config.ts` turns ads off (`isAdsEnabled: false`, or the AdMob plugin missing), nothing in the app collects data: the answers are "No" to collection and "No" to the Advertising ID. `audit-privacy.ts --platform android` decides from the store build's config (`npx expo config --type prebuild`, the same reading the network audit uses), so the printed answers follow the game.

## Printing the answers

```bash
npm run audit:privacy -- --platform android --app line-siege
```

It needs no prebuild and prints one block per game (every folder in `apps/` without `--app`). It exits 1 only when there is no app.

## When the answers change

- A new data type or purpose on Google's data-disclosure page for the Google Mobile Ads Android SDK: change `data-safety.test.ts` first, then `data-safety.ts`, and send the owner the new answers. Check the page at each GP4 and after each ads SDK upgrade.
- A new permission or SDK: it must first pass the allowlists (rules 2, 4 and 7, owner approval); a new SDK that collects data adds its own rows here.
- Our own code never adds a row: if it would, the change breaks N2/N3 and is refused.
