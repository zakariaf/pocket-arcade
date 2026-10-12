# Human steps for Google Play

Everything only the owner can do for an Android release, with its id, why it is needed, the exact click path, and what Claude does meanwhile. None of these blocks other work (owner decision O6): until they are done, a release ends with the keyless rehearsal and a slice report, and the gates end with `owner-placeholder` lines and `OWNER STEPS PENDING: ...`. Ask for them in one message (git-commits-and-reporting's request form), each with its default.

## Contents

- Once per owner: O10
- Per game: GP1 to GP7
- The order
- What the owner sends back, and what never goes into the chat
- The owner's own checks (not blocking)

## Once per owner: O10

**O10, the Google Play developer account.** play.google.com/console/signup: choose a personal or an organisation account, pay the one-time registration fee, and pass Google's identity verification (an organisation also needs a D-U-N-S number). Set up a payments profile (Play Console, Setup, Payments profile) so paid in-app products can be sold. New personal accounts must run a closed test with testers for a period before the first production release; that is publishing (step 9), not this release.

## Per game: GP1 to GP7

| Id | Step | Click path | Default meanwhile |
|---|---|---|---|
| GP1 | The Play Console app | Play Console, All apps, Create app: App name "Line Siege", Default language English (United States) - en-US, App or game: Game, Free or paid: Free; accept the declarations; Create app. The package `io.applander.linesiege` (owner decision O4) is fixed by the first upload. In-app purchases are declared under App content (GP4) and the product comes in GP6 | Claude builds and rehearses |
| GP2 | Play App Signing and the upload key | Nothing to click for the default: Play App Signing is on for new apps, with Google holding the app-signing key; the upload key's certificate is registered by the first upload (GP7). Claude generates the upload key with keytool at `~/.android-keys/line-siege-upload.jks` (chmod 600) and writes its four properties into `~/.gradle/gradle.properties`; to use the owner's own key, say "no" and put the `.jks` there yourself | Claude generates the key when the owner says go |
| GP3 | The service account | Google Cloud console (any project the owner owns): APIs and services, Library, "Google Play Android Developer API", Enable; IAM and admin, Service accounts, Create service account ("e07-play-release"), no roles; Keys, Add key, JSON, which downloads the key. Save it as `~/.android-keys/play-service-account.json` and `chmod 600` it. Then Play Console, Users and permissions, Invite new users: the service account's e-mail, App permissions: Line Siege only, with "Release apps to testing tracks" and "View app information"; Invite user | Uploads wait; the build and the gate do not |
| GP4 | App content | Play Console, Line Siege, Policy and programs, App content: Privacy policy (the G3 URL); Ads: "Yes, my app contains ads"; App access: all functionality available without special access; Content ratings: the IARC questionnaire (game, no violence beyond mild fantasy, no gambling, ads); Target audience and content: 13 and over, not designed for children (D8); Data safety: the answers privacy-and-network-audit prints for Android (the AdMob SDK collects device and app identifiers, approximate location, app interactions and diagnostics for advertising, encrypted in transit; our own code collects nothing; no account to delete); Advertising ID: yes, for advertising; Government apps, Financial features, Health: none | Claude prints the Data safety answers for the owner (sent again after the first real build if they differ) |
| GP5 | The AdMob Android app | admob.google.com, Apps, Add app, Android, "Is the app listed on a supported app store?" No, App name "Line Siege", Add app; then Ad units, Add ad unit: Banner, Interstitial, Rewarded, one each. Send the 4 ids (the app id `ca-app-pub-...~...` and the three unit ids `ca-app-pub-.../...`) | Builds use Google's test ids; a live build fails `owner-placeholder` (GP5) |
| GP6 | The Premium product | Play Console, Line Siege, Monetise with Play, Products, In-app products (one-time products), Create product: Product ID `io.applander.linesiege.premium` (never reusable), Name "Premium", Description "No ads, ever. One-time purchase.", Default price EUR 1.99 (owner decision O2) with Google's local prices for the other countries; Save, Activate. Google allows products only after a build with the BILLING permission has been uploaded, so GP6 follows GP7 | Premium shows "store unavailable" in Play-installed builds |
| GP7 | Testers and the first upload | Play Console, Line Siege, Test and release, Testing, Internal testing, Testers: create an e-mail list with the testers; Setup, License testing: the same accounts, licence response RESPOND_NORMALLY. Then Internal testing, Create new release: upload the AAB Claude built and gated (`apps/line-siege/android/app/build/outputs/bundle/release/app-release.aab`), release name, notes, Next, Save and publish to internal testing | Claude keeps the gated AAB and its stamp ready |

Whether the Play API can upload the very first bundle of a new app is verified on the first real run; the default is that the owner does the first upload (GP7) in the Console, and the API does every later one.

## The order

1. O10 (once), then GP1, GP3 and GP5 in any order, and GP2's go.
2. Claude builds and gates the signed AAB (`npm run release:android`, then `check-store-aab.mjs --stamp`).
3. GP4 before the first release to testers can be reviewed, then GP7 (the first upload, by the owner).
4. GP6 after GP7 (the BILLING permission is now known to Google).
5. From then on, `npm run release:android -- --app line-siege --resume upload` uploads each gated build to the internal track; promoting it further is the owner's step.

## What the owner sends back, and what never goes into the chat

- Sent in the chat: "done" for each step, the 4 AdMob ids (GP5), the privacy-policy URL and support address (G3).
- Never in the chat: the service-account JSON, the keystore, any password. They go to `~/.android-keys/` and `~/.gradle/gradle.properties` on this Mac, and nothing ever reads them except Gradle (the key) and `play-credentials.ts` (the JSON, into memory).

## The owner's own checks (not blocking)

Listed under "Owner steps (not blocking)" in every Android release or slice report, never waited for: the Android play-test from the internal track, the purchase test (buy, cancel, pending, restore after a reinstall, as a license tester), the TalkBack spot check, the fa and ckb review, and listening to the sound previews.
