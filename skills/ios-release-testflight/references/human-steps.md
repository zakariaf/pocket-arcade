# Human steps and the release checklist

Everything only the owner can do (a password, sudo, an Apple or Google login, a legal choice, a judgement), with the step IDs the agent uses when it asks. Then the checklist before and after a release, and what "Android later" will need.

## Contents

- How to ask
- Once per owner and Mac (O1-O10)
- Per game (G1-G8)
- Per release (R1-R6)
- Release checklist
- Android later

## How to ask

One message, one request answerable in a word or one action: the step ID, the exact click path or command, why it blocks, and what the agent does meanwhile. Then continue with work that does not depend on the answer. Never retry an owner stop.

## Once per owner and Mac (O1-O10)

- **O1.** Keep the Apple Developer Program active. Accept the current Program License Agreement (developer.apple.com). In App Store Connect > Business, accept the **Paid Apps Agreement** and complete tax and banking. Premium cannot be sold or reliably sandbox-tested without it.
- **O2.** Declare **EU Digital Services Act trader status** in App Store Connect. Apps without it are removed from EU storefronts (Germany included).
- **O3.** Create (or confirm) a **team** App Store Connect API key with the **Admin** role. Save the `.p8` as `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8` with `chmod 600`, and put `ASC_KEY_ID` and `ASC_ISSUER_ID` in `~/.zshenv` (`APPLE_TEAM_ID` too if missing).
- **O4.** Install Xcode 26.6 and accept its licence with `sudo` (already done on this Mac). Repeat about once a year when a new Xcode is required.
- **O5.** Install TestFlight on the owner's iPhone and sign in with the Account Holder's Apple Account, which is an internal tester.
- **O6.** Approve Claude Code's permission prompts when the agent adds hooks or permission rules to `.claude/settings.json`.
- **O7.** *Fallback only:* if the first API-key archive cannot create the Apple Development certificate, sign in once in Xcode > Settings > Accounts.
- **O8.** *Only when it happens:* unlock the login keychain (`errSecInternalComponent`).
- **O9.** AdMob: the account and payments profile, the published GDPR/TCF message, and blocking controls.
- **O10.** *Later:* the Google Play developer account.

## Per game (G1-G8)

- **G1.** Approve the app name and the bundle ID the agent proposes. The bundle ID must match `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$` (valid on iOS and Android: no hyphens) and the name must be unique on the App Store.
- **G2.** Create the **app record** in App Store Connect (My Apps > + > New App: iOS, name, primary language, the bundle ID, SKU = the game slug). The public API cannot create apps. In the same visit, create the **internal tester group**: the app > TestFlight > Internal Testing > +, name it `Owner`, turn on automatic distribution, and add yourself. TestFlight shows a build only to testers in a group that has it; with automatic distribution every processed build reaches the group without another step. About 3 minutes.
- **G3.** Fill in the **App Privacy** questionnaire (web). Decide it together with the no-ATT choice: the Google Mobile Ads SDK's manifest declares DeviceID with tracking=true while the app never shows ATT, a guideline 5.1.2 risk.
- **G4.** Check the **Premium** in-app purchase the agent created through the API, or create it in the web UI. The first IAP must be submitted together with an app version.
- **G5.** AdMob: create the app and its 3 ad units and give the IDs to the agent (they go into `game.config.ts`). After release, link the AdMob app to the store listing and publish `app-ads.txt`.
- **G6.** Play-test on TestFlight, including the purchase test: buy, cancel, restore after reinstall (the sandbox does not charge).
- **G7.** Have a native speaker read the Persian and Sorani texts.
- **G8.** Approve the store listing (texts, screenshots, age-rating answers).

## Per release (R1-R6)

- **R1.** Play the TestFlight build and answer "ship" or "don't ship".
- **R2.** VoiceOver spot check.
- **R3.** Native-speaker read of changed fa/ckb strings.
- **R4.** Accept any new Apple agreement the agent reports as blocking.
- **R5.** Submit for review: one click in App Store Connect, or tell the agent "submit". The agent never submits without that message.
- **R6.** Answer App Review messages (Resolution Center); choose manual or automatic release after approval.

## Release checklist

Before `npm run release:ios -- --variant store`:

- [ ] `npm run verify` is green (it includes the network audit, licence audit, i18n verify, coverage, `npx expo install --check` and `expo-doctor` for every app).
- [ ] `npm run e2e:ios` and `npm run screenshots:ios` are green on a test-variant simulator build of **this** commit, and the screenshot diffs were reviewed.
- [ ] `version` in `game.config.ts` is correct and higher than the last approved version.
- [ ] `game.config.ts` holds the real AdMob app and unit IDs and the Premium product ID (the unit test "production IDs never contain 3940256099942544" passes).
- [ ] The SKAdNetwork list was refreshed from Google's page.
- [ ] The Paid Apps Agreement and the other agreements are current; the app record exists; the Premium IAP exists (first release: attached to the version).
- [ ] The owner play-tested the latest **test** build of this commit (R1), including the purchase test on a game's first release.
- [ ] Changed fa/ckb strings are native-speaker reviewed (R3).

After the upload:

- [ ] Every store-artifact gate check passed; `--validate-app` and the upload returned success.
- [ ] Processing reached `VALID`, and What to Test is set.
- [ ] The build tag exists (pushed only by the owner's rule); the owner has the report.
- [ ] On "ship": the release tag is set, the owner submits (or tells the agent to), and the store listing is complete.

## Android later

Prepared now: `android.package` equals the bundle ID (valid on both platforms because of the pattern above), `android.versionCode` equals `buildNumber`, `android/` is only generated by prebuild and gitignored, safe-area insets are used everywhere, hardware Back is handled by React Navigation, Java 17 is present, and the AdMob Android sample app ID `ca-app-pub-3940256099942544~3347511713` is in the variant logic for non-live builds.

When Android starts:

1. **Owner:** Google Play developer account (fee plus identity verification) and whatever closed-testing period Google requires of new personal accounts at that time.
2. Install the Android SDK and NDK (Skia needs the NDK); smoke build `npx expo prebuild --platform android --clean && (cd android && ./gradlew bundleRelease)` (Play takes AAB files, so `bundleRelease`).
3. The agent generates the **upload key** with `keytool` outside the repo (`~/.android-keys/<game>-upload.jks`, chmod 600); its passwords go in `~/.gradle/gradle.properties`, never the repo. Enrol in Play App Signing.
4. Add `expo-system-ui` to every app (Android ignores `userInterfaceStyle: 'automatic'` without it), a `jest-expo/android` Jest project, and E2E on an emulator.
5. Play Billing through `expo-iap` (license testers and an internal testing track; billing works only for builds installed from Play).
6. **Owner:** Data safety form, content rating questionnaire, the AdMob Android app with 3 units, and the first upload of each app in the Play Console.
7. Automate uploads with the Google Play Developer API and a service account the owner creates; treat its JSON exactly like the `.p8`.
