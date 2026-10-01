# AdMob console steps, privacy facts, testing and troubleshooting

## Contents

- AdMob console: the owner's steps A1-A6
- Privacy facts the ads bring
- Simulator smoke test (test variant): the ads-smoke flows
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

The smoke test is six Maestro flows in `templates/packages/shell/e2e/ads-smoke/` (copied with e2e-maestro's flows at Shell step 10; e2e-maestro's `check-flows.mjs` checks them: tag `ads-smoke`, no `launchApp`, `geo=` in the first setup link). They run **by hand** on an `ADS_MODE=test` build (`npm run build:ios:sim -- --app <game-id> --variant test --ads test --sim <purpose>`), once per SDK upgrade and before each release, never through `e2e:ios` (its runner refuses ads-on builds and never lists `ads-smoke/`). Use a simulator of your own (`e07-<purpose>`), name its UDID in every `simctl` and Maestro call, and give every Maestro run its own `--driver-host-port`:

```sh
# a fresh install, Google's and Apple's answers empty, started by simctl (Maestro's launchApp would
# grant the ATT answer, so Apple's prompt would never show)
xcrun simctl uninstall <udid> <bundle id>; xcrun simctl install <udid> <app>
xcrun simctl privacy <udid> reset all <bundle id>; xcrun simctl launch <udid> <bundle id>
tools/maestro/bin/maestro --device <udid> --driver-host-port <port> test \
  -e APP_ID=<bundle id> -e APP_SCHEME=<scheme> packages/shell/e2e/ads-smoke/01-consent-eea.yaml
```

| Flow | Starts from | Proves |
|---|---|---|
| `01-consent-eea.yaml` | a fresh install | the setup link carries `geo=eea` (debugServices.setConsentGeography: Google's UMP answers as in the EEA on any network); on Home the Shell's S3 moment shows first, then Google's "Publisher Test Ads" form ("Consent"), then Apple's prompt; "Ask App Not to Track"; the "Test mode" banner still loads (declining costs nothing). Apple's alert follows the Consent tap and may appear while Google's form is still drawn behind it (iOS 26.5); the form is gone after the answer, so the flow waits for the alert's button, never for the form to disappear |
| `02-relaunch.yaml` | `xcrun simctl terminate`, then `launch` | neither S3, the form nor the prompt comes back; the banner loads |
| `03-next-interstitial.yaml` | flow 2 | levels 1 and 2 won and left with Next show no ad (pacing: 3 levels before the first); the third Next shows Google's test interstitial ("Test mode"), and once it is closed level 4's board is settled (`game.board-frame`) |
| `04-rewarded-continue.yaml` | flow 3 | level 1 on `seed=42` from Home, `action=lose-level`, the continue offer ready (not its loading state, L11), "Continue - watch an ad" (`result.continue-ad-button`), Google's test rewarded ad watched to "Reward granted" and closed: the run plays on (`game.screen`, no Result) and `game.board-frame` reads `{"seq":<opened seq + 2>,"settled":true}` (below) |
| `05-offline.yaml` | flow 4 | `offline=1`: no banner, a lost level offers no continue, so the lose result shows at once (L11), Try again shows no ad and no message; then `offline=0` |
| `06-geo-other.yaml` | a new fresh install | `geo=other`: Google's GDPR form never opens and Apple's prompt carries the app's usage text (`consent.tracking.usage-description`). In a test build the app runs on Google's sample AdMob app, whose console publishes an IDFA explainer for that region ("Our app wants to stay free for you"), so S3 opens before it (L10: the intro shows only before a Google form), then the explainer, then Apple's prompt. The owner's app publishes no explainer (step A3), so there Apple's prompt shows alone (L10); `check-ad-behaviour.mjs` proves that path ("prepareAds where consent is not required (no intro, no form, ATT still first)") |

Flows 1 to 5 run in that order on one install; 6 needs its own fresh install. Do not add `ads=test` to a setup link: it is S15's "Always show test ads", which drops the pacing rules flow 3 proves and is kept across launches. Screenshots and E2E flows run with `ADS_MODE=off`, so images are deterministic, the runtime network audit sees no ad traffic, and neither Google's form nor Apple's prompt ever shows; there a lost run without Premium has no continue and ends at once (L11).

**The board after a rewarded ad (R4G-G08).** Flow 4's last step is the regression test of the round-4 freeze: after the rewarded ad closed, the board stayed on the continue animation's first frame (Line Siege: the hearts drawn as outlines, the three tray slots empty) until the next move, while the Premium continue animated in full and the state and save were right. Cause class A, traced on the simulator with the board-clock perf-log entries (board-rendering-skia, references/timeline-and-clock.md): `runFullscreenAd`'s `finally` resumes the board, the continue is pushed a few milliseconds later, the resume's frame for the old scene reports done after the push, and the round-4 clock compared that with a JS read of the scene shared value that still returned the old seq, so it stopped the continue scene before its first frame. It is a race: whether the UI thread runs a frame between the resume and the push decides it. The fix is board-rendering-skia's `board-clock-state.ts` (a done message names the run it ended), and the order around the ad stays as it is. The troubleshooting playbook's entry is `engine-board-freeze-rewarded-continue`.

**Recorded run, 2026-10-01** (Line Siege, `ADS_MODE=test` Release build of these templates, simulator `e07-r5-continue-board-ads`, iOS 26.5, Maestro 2.10 on its own driver port, a Berlin network): flows 1 to 5 passed on one fresh install. Flow 1: S3, "Publisher Test Ads", "Consent", Apple's prompt, "Ask App Not to Track", the banner. Flow 3: no ad after the first two Next taps, the test interstitial after the third, level 4 settled after Close. Flow 4 (three passes): "Reward granted", Close, the run on the Game screen with `{"seq":2,"settled":true}`, the tray with its three pieces and one heart restored; the board-clock trace shows the stale done ignored (`resume run 5 seq 1`, `push run 6 seq 2`, `frame run 5 seq 1`, `done run 5 isStale true`, then frames of run 6 from elapsed 0 to 556 ms and `done run 6`). Flow 5: no banner, the lose result at once with no continue offer, no ad. Flow 6 on a new fresh install: S3, Google's IDFA explainer, Apple's prompt with "Google uses this to show you ads that fit your interests. ...", the banner, and the UMP state `IABTCF_gdprApplies = 0`. The same flow 4 on the round-4 templates (the debug link of that build knows no `geo=`, so its setup links left it out) failed at its last step in one of its two runs that reached the ad (and the same build froze in both rewarded continues traced earlier that day): `{"seq":2,"settled":false}`, the hearts outlined and the tray empty, with the trace `resume run 4 seq 1`, `push run 5 seq 2`, `frame run 4 seq 1`, `done ... stopped`, and no frame of seq 2. On the fixed build the Premium continue on the same seed, an ordinary move, Pause and Resume, and Home in the middle of the continue animation with the app reopened 10 s later (one frame at resume, `settled: true`) all settled too.

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
| No consent form in the EEA on a real device | no published GDPR message (A3), or cached consent | publish the message; in a test build send the debug link's `geo=eea` (it resets Google's answer and keeps the geography) |
| Google's "Our app wants to stay free for you" before Apple's prompt in a test build outside the EEA (`geo=other`) | Google's sample AdMob app publishes an IDFA explainer for that region | expected in `ADS_MODE=test` builds only; the owner's app publishes none (A3), so its players outside the EEA see Apple's prompt alone (L10) |
| After a rewarded continue the board stays on the continue animation's first frame until the next move (`game.board-frame` `settled: false`) | the board clock stopped by a stale done message (cause class A) | board-rendering-skia's `board-clock-state.ts` in `use-board-clock.ts` (`check-board-code` rule `clock-runnable`); `ads-smoke/04-rewarded-continue.yaml` proves it |
| `canRequestAds` false forever | the player chose "Do not consent" where that blocks ads | expected; the privacy row lets them change it |
| Apple's tracking prompt never appears on the simulator | Maestro's `launchApp` granted every permission (the status reads authorized), the app was not active, or the answer was given before | launch with `xcrun simctl launch`, or `launchApp: { permissions: { all: unset } }`; delete and reinstall the app to ask again |
| The app stops at the first ATT status read ("missing 'NSUserTrackingUsageDescription'") | the `expo-tracking-transparency` plugin entry or the prebuild is missing | `check-ads` rule `att-plugin`; add the entry to `shell-plugins.ts`, then `npx expo prebuild --platform ios --clean` |
| Two tracking prompts, or UMP's own explainer before Apple's | an IDFA explainer message was published in AdMob | unpublish it (step A3): the app asks ATT itself |
| Banner never appears | offline, Premium, consent not handled, `ADS_MODE=off`, or no fill | check the `shouldShowBanner` inputs in the debug menu; open the Ad Inspector (test builds only) |
| Real ads in a test build / test ads in a store build | wrong `ADS_MODE` pair | impossible by construction (`resolveBuildVariant` + `assertLiveIds`); the store-artifact gate checks `GADApplicationIdentifier` |
| Interstitial shown over the Result screen | the call sits in a Result effect instead of the button handler | only the Next / Replay / Try again handlers call `showInterstitialIfDue` |
| `SKAdNetworkItems` entries without `.skadnetwork` | a hand-edited or wrongly generated list | regenerate with `refresh-skadnetwork.ts`; each entry is `xxxxxxxxxx.skadnetwork` |

When filing a library issue, attach the RN, Expo and library versions, whether test IDs were used, and the Ad Inspector result.
