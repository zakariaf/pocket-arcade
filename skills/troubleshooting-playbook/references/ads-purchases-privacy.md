# Ads, purchases, audio and privacy

Failures with AdMob and consent, StoreKit purchases, audio and haptics, privacy manifests and the network promise. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- AdMob
- Privacy
- Purchases
- Audio
- Haptics
- Config
- Network audit
- Consent

## AdMob

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `services-ads-error-codes` | Ad error handling breaks after an AdMob update | Legacy error code strings are deprecated (removed in v18) | Branch on error.phase then error.reason | verified | `admob-ads` |
| `services-no-consent-form` | No consent form appears in the EEA on a real device | No published GDPR message in AdMob (owner step), or cached consent | Owner publishes the message (O9); in test builds use debug geography EEA plus AdsConsent.reset() | documented, owner | `admob-ads` |
| `services-debug-geography-ships` | Consent debug settings in a store build | debugGeography and AdsConsent.reset() were not gated by the variant | Reach them only through test-only code; unit-test the gate | verified | `admob-ads` |
| `services-banner-never-shows` | The banner never appears | Offline, Premium, consent not given, ADS_MODE=off, or no fill | Check shouldShowBanner inputs in the debug menu; open the Ad Inspector in a test build | documented | `admob-ads` |
| `services-can-request-ads-false` | canRequestAds stays false | The player refused consent where that blocks ads | Expected; the Ad privacy choices row lets them change it | documented | `admob-ads` |
| `services-interstitial-over-result` | An interstitial covers the Result screen | The call sits in the result effect instead of the button handler | Only the Next / Replay / Try again handlers call showInterstitialIfDue | documented | `admob-ads` |
| `services-banner-size-undefined` | A banner test passes undefined as the size | The mock lacked BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER (ANCHORED_ADAPTIVE_BANNER is deprecated) | The root mock lists both sizes | verified | `admob-ads` |
| `services-ad-already-used` | Ad error reason ad-already-used | A fullscreen ad object was shown twice | Use each ad object once and destroy it after CLOSED | documented | `admob-ads` |
| `services-zero-height-banner` | A banner inside a zero-height container may never load | Unverified whether GMA loads a collapsed banner | Use the off-screen transparent fallback until the first ADS_MODE=test smoke settles it | open | `admob-ads` |
| `services-consent-offline` | Consent update fails while offline and no ads show later although consent was given | The UMP request needs the network | Use canRequestAds from the earlier session when the update fails; adPolicy's online input suppresses ads while offline | verified | `admob-ads` |
| `services-two-sdk-adapters` | Lint rejects importing AdsConsent in the consent adapter | The rule was written as "one adapter imports the SDK", but ConsentPort needs the same package | Two adapter files may import it: admob-ads-adapter.ts and admob-consent-adapter.ts | verified | `admob-ads` |
| `services-consent-in-ads-off` | An ADS_MODE=off build contacts Google's consent service at launch (a Google host in the socket report) | Consent was built with createAdmobConsentAdapter directly, ignoring the ads mode | Build it with createConsentPort(adsMode, options); isAdsEnabled is the game's switch AND adsMode !== 'off' (check-ads consent-factory) | verified | `admob-ads` |
| `services-banner-band-hides-ad` | The banner never loads inside the Toybox banner band | The band rendered nothing until the ad was visible, so the native banner never mounted | Never wrap AdBannerSlot; pass the band style as its loadedStyle (useBannerBandStyle), applied only after the ad loads | verified | `admob-ads` |
| `services-ad-preload-before-init` | The first interstitial or rewarded ad after launch never loads | The ad was preloaded before initialize() had resolved | Await initialize (after consent) before any preload; check-ads behaviour scenarios catch it | documented | `admob-ads` |
| `services-interstitial-only-once` | Only one interstitial ever shows: after the first one no interstitial is ever due again, and ads.history.levelsCompletedSinceInterstitial stays 0 | The run end never records a finished level in the ad history: createGameHost gets no extendRunEnd that calls recordLevelEnd, so the policy's minLevelsCompletedBetween is never reached | Pass extendRunEnd: recordAdLevelEnd to createGameHost in create-shell-parts.ts (level runs only, in the same run-end save), with the test that a won level counts in the ad history (game-host-integration and admob-ads templates) | verified | `admob-ads` |

## Privacy

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `services-gma-tracking-label` | App Review rejection risk under guideline 5.1.2 | The AdMob SDK's privacy manifest declares DeviceID with tracking=true while the app never shows ATT | Owner decides the App Privacy answers together with the no-ATT choice (G3) | open, owner | `privacy-and-network-audit` |
| `services-att-prompt` | The app asks for tracking permission, or Info.plist has NSUserTrackingUsageDescription | userTrackingUsageDescription was passed to the AdMob plugin, or expo-tracking-transparency was installed | No tracking prompt in v1 (decision D4): remove both; the owner decides any change | documented | `admob-ads` |
| `services-static-pod-manifests` | Apple emails about missing required-reason APIs | Apple does not reliably parse the privacy manifests of static CocoaPods | Aggregate every pod manifest into ios.privacyManifests; audit:privacy fails on a gap | documented | `privacy-and-network-audit` |
| `services-app-privacy-web-only` | The App Privacy questionnaire cannot be filled by the agent | It is believed to be web-only | Owner step G3, using audit:privacy output | open, owner | `privacy-and-network-audit` |
| `services-wkwebview-sockets` | The runtime socket audit sees WebKit traffic | Ads render in WKWebView whose traffic can come from com.apple.WebKit.Networking; StoreKit traffic goes through a system daemon | Run the runtime audit with ADS_MODE=off; StoreKit is allowed | documented | `privacy-and-network-audit` |
| `services-network-baselines-shared` | audit:network flags a package that only one game uses | js-baseline.json and native-baseline.json are shared by all games | Add the entry with a reason; split the baselines per app (network-audit/<game-id>/) if games diverge a lot | open | `privacy-and-network-audit` |
| `services-licence-list-missing` | The S11d licences screen has no list of shipped npm packages | audit:licenses computes the set but does not write it for the app | Emit apps/<game>/assets/generated/npm-licences.json (name, version, SPDX) from audit:licenses | open | `quality-gates` |
| `services-aliased-network-global` | const send = globalThis.fetch (or const Socket = WebSocket) passes lint and the bundle audit | The rules matched only direct calls of the network globals | Never alias network globals; audit-repo reports it as network-global | verified | `privacy-and-network-audit` |
| `services-private-key-prose` | audit-repo reports private-key for a reference that only mentions "BEGIN PRIVATE KEY" | An older rule matched the words instead of PEM armour | Use the current audit-repo: it reports only -----BEGIN … PRIVATE KEY----- armour, in every file including skills/ | verified | `privacy-and-network-audit` |
| `services-audit-network-hoisted-react-native` | npm run audit:network crashes with ENOENT ... apps/<id>/node_modules/react-native (or later on a dangling CocoaPods header symlink under node_modules/@e07/<id>/ios/Pods) | network-native-layer.ts looked for react-native under the app's own node_modules, but npm workspaces hoist it to the root; its package-root guess for a podspec at a package's root also turned into the whole node_modules folder and walked through the workspace symlink into Pods | Use the current privacy-and-network-audit template: it resolves each module with createRequire from the app's package.json, walks up to each module's own package.json, and skips symlinks in the file walk | verified | `privacy-and-network-audit` |

## Purchases

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `services-storekit-xcuitest` | SKTestSession in an XCUITest runner does not control the app; products stay [] | The UI-test runner is a separate process; xcodebuild test ignores the scheme StoreKit configuration | A hosted XCTest bundle (TEST_HOST = the app) arms storekitd for the bundle ID; then launch the app normally | verified | `premium-purchase` |
| `services-storekit-get-task-allow` | StoreKit testing fails silently | The app was built without the get-task-allow entitlement | Debug-only get-task-allow for the harness build; the release gate proves it absent from Release | verified | `premium-purchase` |
| `services-revoke-on-absence` | Premium disappears right after a purchase | A just-bought purchase is briefly missing from Transaction.currentEntitlements; the foreground re-check fires after the sheet closes | Revoke only on a verified transaction with revocationDate; absence keeps the cached state | verified | `premium-purchase` |
| `services-restore-sync-error` | restorePurchases throws ErrorCode 'sync-error' | AppStore.sync failed or the Apple Account prompt was cancelled | Map it to a 'couldn't restore' state, never 'nothing to restore' | verified | `premium-purchase` |
| `services-empty-products` | The Premium price never loads, no error | fetchProducts returns [] silently when StoreKit cannot resolve the product | Map an empty result to 'store unavailable' | verified | `premium-purchase` |
| `services-refund-not-pushed` | A refund in the test store does not reach the running app | The test store did not push an update; only the launch re-check saw the revocation | Handle both paths (Transaction.updates and the launch check) | open | `premium-purchase` |
| `services-fail-transactions-deprecated` | SKTestSession.failTransactionsEnabled is marked deprecated | Deprecated since iOS 17 | Still works for the harness; watch for its replacement | documented | `premium-purchase` |
| `services-entitlements-offline` | Premium might be revoked or missing when checking entitlements offline | Whether Transaction.currentEntitlements is complete offline is not verified | An error keeps the cached Premium state; only a verified revocation removes it | open | `premium-purchase` |
| `services-harness-after-prebuild` | The StoreKitHarness target is missing after a prebuild | prebuild regenerates ios/; the harness is added by storekit-harness.ts (xcodeproj gem) after a fresh test prebuild, not by a config plugin | Run the harness step after every test-variant prebuild; never in store builds | documented | `premium-purchase` |
| `services-store-price-offline` | The Premium screen shows a price while the phone is offline | Nothing linked ConnectivityPort to the store flow | Wrap the purchase port with withConnectivity and reload on reconnect (shouldReloadStore); check-premium store-offline | verified | `premium-purchase` |
| `services-restore-shows-thanks` | After Restore the thank-you screen appears instead of "Premium – active" | onRestoreFinished('owned') left didJustPurchase set | Use the current premium-transitions.ts (a restore clears didJustPurchase and sets didJustRestore) | verified | `premium-purchase` |
| `services-debug-premium-ignored` | The debug switch or link premium=1 changes nothing | The Premium reducer had no action for it | Save first, then dispatch debug-premium-set (test builds only; check-premium debug-only) | verified | `premium-purchase` |

## Audio

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `services-audio-other-playing` | Game music starts over the player's own music | react-native-audio-api has no API for "other audio is playing" | Keep game music off by default (or a small local module reading secondaryAudioShouldBeSilencedHint); never activelyReclaimSession | open | `game-audio-and-haptics` |
| `services-ios-allow-haptics` | Haptics do not change with iosAllowHaptics | The option only affects recording sessions | Leave it at its default with the ambient category | verified | `game-audio-and-haptics` |
| `services-audio-compat-table` | react-native-audio-api's compatibility table stops at RN 0.85 | The docs lag the releases | 0.13.6 built and played on RN 0.86.3 (verified); re-run the audio smoke on every bump | verified | `game-audio-and-haptics` |
| `services-audio-voices-dropped` | The next move's sounds are dropped after a fast move | Cancelled cues kept their voice slots and repeat windows, and cues scheduled out of order got a negative time gap | Use the current voice policy (voices are intervals on the audio clock; cancelPending releases them) | verified | `game-audio-and-haptics` |
| `services-ui-feedback-silent` | Taps, toggles and results make no sound or haptic | Nothing called usePressFeedback or playUiFeedback | Call usePressFeedback() in raised-surface, quiet-button and list-row, playUiFeedback(services, 'win'\|'lose') in the result step and 'toggle' in toggles; check-audio-haptics ui-feedback | open | `game-audio-and-haptics` |
| `services-audio-plugin-unwired` | No sound on a device build although AUDIO_API_PLUGIN is defined | withShell never adds the audio plugin constant to the plugins list | Add AUDIO_API_PLUGIN to withShell; check-audio-haptics audio-plugin | documented | `game-audio-and-haptics` |
| `services-audio-layer-click` | A click in the middle of a synthesised sound | A sound layer that starts after 0 has no fade-in | Give every late-starting layer a fade-in of at least 1 ms (the sound-bank quality check) | verified | `game-audio-and-haptics` |
| `services-slider-percent-scale` | The volume slider sits at full and the save holds fractions like 0.8 | The Toybox Slider works in 0 to 1; the Settings row passed 0 to 100 | Convert percent and fraction at the row and save only when the whole percent changes | verified | `settings-and-preferences` |

## Haptics

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `services-haptics-simulator` | Haptics cannot be felt in the simulator | The simulator has no Taptic Engine | The owner checks haptics on a device; the adapter only proves calls succeed | documented | `game-audio-and-haptics` |

## Config

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `services-null-extra` | null in expo.extra arrives as {} on the device | Expo serialises extra through the manifest | Omit keys instead of null (withShell omits adUnits unless present) | verified | `architecture-and-boundaries` |

## Network audit

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `services-network-native-layer-scandir` | npm run audit:network crashes with ENOENT: no such file or directory, scandir '<repo>/apps/<game>/node_modules/react-native' (or a scandir under node_modules/@e07/<game>/ios/Pods) in network-native-layer.ts | An old copy of the network audit template looked for react-native inside the app folder; npm hoists it to the root, and the old walk followed workspace symlinks | Copy packages/tooling/src/audit/network-native-layer.ts and its test again from privacy-and-network-audit (it resolves react-native from the app's package.json and skips symlinks), then rerun audit:network | verified | `privacy-and-network-audit` |

## Consent

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `services-consent-form-without-intro` | Google's consent form opens at launch (or over a level) without the S3 intro, or check-ads fails [consent-moment] with "prepareAds() is called outside the consent moment" | prepareAds runs somewhere other than admob-ads' consent moment, so the S3 intro step is skipped | Copy admob-ads' consent moment (app/consent-moment.tsx, consent-moment-context.tsx, use-consent-moment.ts and services/ads/consent-moment-flow.ts), mount <ConsentMoment> around the navigator in ShellFeatures, and let screens only ask for the ad moment through useBannerSlot; rerun check-ads.mjs . | verified | `admob-ads` |
| `services-ads-never-initialised` | No ad ever loads in a test build with test ads (no banner, the rewarded offer stays hidden), or check-ads fails [consent-moment] with "nothing prepares ads" | Nothing runs the ad gate's prepareAds: the consent moment is not mounted, or no banner screen asks it for the ad moment, so the SDK is never initialised | Mount admob-ads' <ConsentMoment> in ShellFeatures with consent-moment-flow.ts, and use useBannerSlot on Home, Levels and Statistics (it calls requestAdMoment); rerun check-ads.mjs . | verified | `admob-ads` |
