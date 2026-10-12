# Stop and ask

Stopping is not failing. For each case below, stop that line of work, send the owner one message, and continue with other work if there is any. The owner answers in plain words; make every question answerable in a word.

## Contents

- When to stop and ask
- The owner's human steps (IDs to name)
- Release stops: errors that are never retried (App Store, Google Play)
- How to write the message

## When to stop and ask

| Situation | What to do |
|---|---|
| A human step is needed (the IDs below) | name the step ID and the one action needed; never simulate or skip it |
| A gate looks wrong or blocks: a lint rule, a limit, a threshold, a tolerance, a baseline, an audit finding | do not edit the gate; send the gate note (gate, file and line, message, why it looks wrong, smallest change); edits to gate files prompt the owner anyway |
| A change would touch a gated path (quality gates, goldens, baselines, fixtures, `.npmrc`, network baselines, parity waivers and game facts) other than by an intended, explained change | ask; an agreed change goes in one commit with a `Gate-Change:` trailer |
| The spec is contradicted, ambiguous or silent about something a player would see | quote the spec lines, give the options with a recommended default, keep working; never trade away N1-N12 |
| Two of the project's instructions disagree | follow the one that owns the topic, say so in the report, and name the other so it gets fixed |
| Irreversible or outward-facing actions: an App Store Connect upload, a Google Play upload, submitting for review, promoting a Play build beyond the internal track, creating or changing App Store Connect or Play Console records (Premium product, age rating, tester groups, App content), pushing branches or tags, force-pushing or rewriting pushed history, deleting files, data or simulators this session did not create, sending anything to a third party | ask first, unless the owner asked for exactly this action in this session; submit for review only after the owner says "submit" |
| A release stop (next section) | stop, do not retry, do not switch signing methods; one message with the step and the exact error line |
| Anything that would read, print, copy, move or commit the App Store Connect `.p8` key, the Google Play service-account JSON, an upload keystore (`.jks`), a JWT or a password | never; if a task seems to need it, ask |
| A new dependency outside the documented procedure, a banned package, a held-back major version, an early release-age exception | ask, unless the dependency procedure covers it exactly |
| An open owner decision becomes blocking | use the documented default and say so; ask when the default no longer works |
| The owner's personal checks: the review of the fa and ckb texts, the play-test, listening to the sound previews (G6, G7, G9, R3) | these are not stop-and-ask items: never stop or wait for them; list each under "Owner steps (not blocking)" in every slice and release report (`check-report.mjs` rule `owner-steps-listed`) and keep working |
| Family Sharing for Premium | never turn it on: the owner decided it stays off (it cannot be turned off again) |
| The Stop hook still fails after its 8 continuations | report the failing gate and what was tried |

## The owner's human steps (IDs to name)

Once, per owner and Mac:

| ID | Step |
|---|---|
| O1 | Keep the Apple Developer Program active; accept the Program License Agreement and, in App Store Connect > Business, the Paid Apps Agreement with tax and banking (Premium cannot be sold or reliably sandbox-tested without it) |
| O2 | Declare EU Digital Services Act trader status in App Store Connect (without it, apps leave the EU storefronts, Germany included) |
| O3 | Create or confirm a team App Store Connect API key with the Admin role, save the `.p8` in the agreed private folder, set `ASC_KEY_ID` and `ASC_ISSUER_ID` |
| O4 | Install Xcode and accept its licence with `sudo` (about once a year) |
| O5 | Install TestFlight on the owner's iPhone, signed in as an internal tester |
| O6 | Approve Claude Code's permission prompts when hooks or permission rules are added to `.claude/settings.json` |
| O7 | Fallback only: sign in once in Xcode > Settings > Accounts if the first API-key archive cannot create the development certificate |
| O8 | Only when it happens: unlock the login keychain (`errSecInternalComponent`) |
| O9 | AdMob account and payments profile, the published GDPR/TCF consent message, and blocking controls (A1, A3, A4) |
| O10 | The Google Play developer account (once Android starts): play.google.com/console/signup, a personal or an organisation account, the one-time registration fee and Google's identity verification (an organisation also needs a D-U-N-S number), then a payments profile (Play Console, Setup, Payments profile) so paid in-app products can be sold |

Per game:

| ID | Step |
|---|---|
| G1 | Confirm the app name (unique on the App Store). The app id is fixed, not asked: `io.applander.<game id without hyphens>`, all lowercase, as the iOS bundle ID and the Android package (Line Siege: `io.applander.linesiege`), and `<bundle ID>.premium` for Premium |
| G2 | Create the app record in App Store Connect with the fixed bundle ID (no API exists for it; about 2 minutes) |
| G3 | Fill in the App Privacy questionnaire with the prepared answers: Device ID collected, linked to the user and used for tracking by the third-party ads SDK (Google Mobile Ads), because the app asks for App Tracking Transparency on iOS; the app itself collects nothing. Give the privacy-policy host and path and the support address for `game.config.ts` `links` (until then `example.com` and `support@example.com`, which every ship gate refuses) |
| G4 | Check (or create) the Premium in-app purchase; the first one is submitted with an app version |
| P1 | Part of G4, both decided by the owner: the price is the EUR 1.99 App Store price point (the app always shows the store's localised price), and Family Sharing stays off: leave it off and never turn it on (it is irreversible once on) |
| G5 | AdMob: create the app and 3 ad units and give the IDs; after release, link the store listing and publish `app-ads.txt` (A2, A5) |
| G6 | Play-test on TestFlight, including the purchase test: buy, cancel, restore after reinstall. The owner does it personally; not blocking: listed under "Owner steps (not blocking)", never waited for |
| G7 | Review the Persian and Sorani texts (Claude writes natural drafts). The owner does it personally; not blocking: listed, never waited for |
| G9 | Listen to the game's sound previews (`reports/sfx/<game-id>/*.wav`) and feel the haptics on a phone. The owner does it personally; not blocking: listed, never waited for |
| G8 | Approve the store listing (texts, screenshots, age rating answers) |

Per game on Google Play (Android follows once the game's iOS version has shipped; ask for them in one message, each with its default):

| ID | Step |
|---|---|
| GP1 | The Play Console app: All apps, Create app, with the app name, default language English (United States), Game, Free; the package `io.applander.<game id without hyphens>` (owner decision O4) is fixed by the first upload. Meanwhile Claude builds and rehearses |
| GP2 | Play App Signing and the upload key: Google holds the app-signing key; Claude generates the upload key with keytool at `~/.android-keys/<game-id>-upload.jks` (chmod 600) and writes its four properties into `~/.gradle/gradle.properties` when the owner says go (or the owner puts their own key there) |
| GP3 | The service account: enable the Google Play Android Developer API in a Google Cloud project, create a service account with a JSON key saved as `~/.android-keys/play-service-account.json` (chmod 600), and invite it in Play Console, Users and permissions, for this app only, with "Release apps to testing tracks" and "View app information". Uploads wait; the build and the gate do not |
| GP4 | App content: privacy policy (the G3 URL), ads yes, app access, the IARC content rating, target audience 13 and over (D8), Data safety (the answers privacy-and-network-audit prints for Android), Advertising ID for advertising |
| GP5 | The AdMob Android app and its 3 ad units (banner, interstitial, rewarded); send the 4 ids. Until then builds use Google's test ids and a live build fails `owner-placeholder` (GP5) |
| GP6 | The Premium product: Monetise with Play, In-app products, product id `<package>.premium` (never reusable), name "Premium", EUR 1.99 (owner decision O2), Activate; possible only after a build with the BILLING permission was uploaded, so after GP7. Until then Premium shows "store unavailable" in Play-installed builds |
| GP7 | Testers and the first upload: the internal testing tester list and License testing (RESPOND_NORMALLY), then the owner uploads the first gated AAB in the Console; the API does every later upload. Meanwhile Claude keeps the gated AAB and its stamp ready |

The Android play-test from the internal track (with the purchase test as a license tester), the TalkBack spot check, the fa and ckb review and the sound previews are the owner's own checks: listed under "Owner steps (not blocking)", never waited for.

Per release:

| ID | Step |
|---|---|
| R1 | Say "ship" or "don't ship" for the TestFlight build: the release tag and the submission leave the Mac, so they wait for this word (the play-test, G6, never does) |
| R2 | VoiceOver spot check (about 15 minutes) |
| R3 | Review the changed Persian and Sorani texts. The owner does it personally; not blocking: listed, never waited for |
| R4 | Accept any new Apple agreement reported as blocking |
| R5 | Submit for review (one click, or tell Claude "submit"); on the first release, add Premium to the version first |
| R6 | Answer App Review messages; choose manual or automatic release after approval |

AdMob console steps: A1 account and payments (once); A2 per game the app and three ad units (banner, interstitial, rewarded); A3 publish the European regulations consent message (English and German) and no IDFA explainer message (the app asks for App Tracking Transparency itself right after Google's form; a published explainer would make Google's UMP run a second tracking prompt); A4 blocking controls (gambling, dating, alcohol, get-rich-quick; maximum rating PG); A5 after the first release, link the store listing and publish `app-ads.txt`; A6 never needed: live-ID device testing (test builds always use test units).

## Release stops: errors that are never retried

Stop, do not retry, do not switch signing methods, and send one message with the step and the exact error line:

- `errSecInternalComponent` from `codesign` (the login keychain is locked: human step O8).
- Any agreement error (`agreement`, `PLA Update available`, a `FORBIDDEN` that mentions an agreement: human step R4, then rerun from the failed step).
- A missing app record (human step G2).
- HTTP 401 (`NOT_AUTHORIZED`: wrong key or issuer ID, revoked key, clock skew) or 403 (`FORBIDDEN_ERROR`: key role below Admin or an individual key; human step O3).
- A processing state `INVALID` or `FAILED` (ask the owner to forward Apple's email; fix, then rebuild with a new build number).

On Google Play (`npm run release:android`), the same: stop, never retry, one message with the step and the exact error line:

- HTTP 401 or 403 from the Android Publisher API (`auth`: the service account is not invited for this app, lacks "Release apps to testing tracks", or its key was deleted: human step GP3).
- The Android Publisher API is not enabled in the service account's project (`api-not-enabled`: human step GP3).
- App not found, HTTP 404 (`app-not-found`: no Play Console app yet, or its first upload is not done: human steps GP1 and GP7).
- Missing policy declarations (`policy-declarations`: App content is incomplete: human step GP4).
- A version code that was already used (`version-code-used`: never lower or reuse the number; a new release run takes the next shared build number).

## How to write the message

- One message, one request, answerable in a word, with the default that applies until the owner answers: "Please create the App Store Connect app record for Flock Tilt (step G2, about 2 minutes). Until then I keep working on the board."
- Name the step ID when there is one, and how long it takes.
- For a release stop: the step, the exact error line, the one action needed (`templates/release-stop.md`).
- For a spec question: quote the spec lines, give the options, and say which default you are using meanwhile (`templates/owner-request.md`).
- Filling `templates/owner-request.md`: for a human step keep the `(step ..., about ... minutes)` part and delete the three bullet lines; for a spec question delete the step part, write "Please answer A or B", and keep the quoted spec lines and the options (print the spec lines with the product-spec skill's lookup, never from memory).
- Before sending, save the message to a file under `reports/` (gitignored) and run `node ${CLAUDE_SKILL_DIR}/scripts/check-report.mjs <file> --kind request`; `examples/owner-requests.md` shows one of each kind.
- Then keep working on whatever does not depend on the answer.
