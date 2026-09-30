# Signing, TestFlight and App Store Connect

Failures of the signed archive, export, validation, upload, processing and App Store Connect API calls. Rows marked "owner" are stops: send one message and never retry. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Signing
- Account
- Upload
- Export
- Store gate
- REST
- Secrets
- App Store Connect
- Partial Shell

## Signing

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `release-keychain-locked` | errSecInternalComponent from codesign during archive | The login keychain is locked (SSH or non-GUI session) | Stop (O8): the owner unlocks it (security unlock-keychain ~/Library/Keychains/login.keychain-db) or starts the run from the desktop; never retry; after the owner confirms, rerun with --resume build | documented, owner | `ios-release-testflight` |
| `release-codesign-access-dialog` | A macOS dialog "codesign wants to access key ..." | The key's access list does not include codesign yet | Stop: the owner clicks Always Allow once | documented, owner | `ios-release-testflight` |
| `release-no-profiles` | No profiles for '<bundle id>' were found / Automatic signing is disabled | -allowProvisioningUpdates or the three -authenticationKey* flags are missing, or DEVELOPMENT_TEAM is empty | Pass the auth flags; export APPLE_TEAM_ID before prebuild (withShell writes it to ios.appleTeamId) | documented | `ios-release-testflight` |

## Account

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `release-agreement` | Text containing agreement (altool, App Store Connect) or PLA Update available (xcodebuild) | A new or expired Apple agreement | Stop (R4): the owner accepts it; then rerun with --resume build (same build number) if the stop came before the upload, otherwise a plain rerun | documented, owner | `ios-release-testflight` |
| `release-no-app-record` | print-app-record.ts exits 2, or the upload cannot determine the Apple ID for the bundle ID | The App Store Connect app record does not exist, and the public API cannot create apps | Stop (G2): the owner creates it (My Apps > + > New App), then rerun | documented, owner | `ios-release-testflight` |
| `release-not-authorized` | NOT_AUTHORIZED (401) from altool or the REST API | Wrong key or issuer ID, a revoked key, or clock skew (iat in the future) | Stop (O3): check the env IDs against the key file name without reading it and that the Mac clock is on network time; a revoked key needs a new team key | verified, owner | `ios-release-testflight` |
| `release-forbidden` | FORBIDDEN_ERROR (403), or "not allowed to create distribution certificates" | The key role is below Admin, or it is an individual key | Stop (O3): the owner creates a team key with the Admin role | documented, owner | `ios-release-testflight` |

## Upload

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `release-processing-invalid` | Build processing state INVALID or FAILED | Apple rejected the binary during processing | Stop: ask the owner to forward Apple's email; fix, then rebuild with a new build number | documented, owner | `ios-release-testflight` |
| `release-itms-90189` | ITMS-90189: Redundant Binary Upload | The build number was reused | Never reuse or roll back: bump and rebuild (check the earlier upload's processing first) | documented | `ios-release-testflight` |
| `release-itms-90062` | ITMS-90062: version must be higher than the previously approved version | version was not raised after an approval | Raise version in game.config.ts and rebuild | documented | `ios-release-testflight` |
| `release-itms-90683` | ITMS-90683: Missing purpose string in Info.plist (NSMicrophoneUsageDescription) | react-native-audio-api references record-permission APIs | Add a neutral NSMicrophoneUsageDescription through the audio plugin option iosMicrophonePermission, translated through expo.locales; rebuild with a new build number | open | `game-audio-and-haptics` |
| `release-itms-privacy` | ITMS-91053 (missing API declaration), ITMS-91061 (missing privacy manifest for an SDK) or ITMS-91056 (invalid manifest) | The aggregated required-reason APIs are incomplete; Apple does not reliably read static-pod manifests | npm run audit:privacy, add the category and reason to ios.privacyManifests, prebuild, rebuild with a new build number; ask the owner for Apple's email | documented | `privacy-and-network-audit` |
| `release-upload-not-done` | altool --upload-package --wait returned but the build is not in TestFlight | --wait returns once the build is PROCESSING, not VALID | Poll processing (REST processingState) every 60 s for up to 60 minutes; done only at VALID | documented | `ios-release-testflight` |
| `release-processing-timeout` | processing did not reach VALID within 60 minutes | Apple is slow, or the build is stuck | Check the TestFlight tab in App Store Connect, then rerun release:ios with --resume processing (the upload is done; it waits for VALID, sets What to Test and tags without uploading again) | documented | `ios-release-testflight` |
| `release-processing-rest-error` | release:ios stops after the upload with "... while waiting for processing" or "reading the processing state failed" | A REST error (401/403 or no network) while polling processing; the build is already at Apple | A 401 or 403 is an owner stop (O3); otherwise restore the network. Then rerun release:ios with --resume processing; a plain rerun would upload a second build | documented | `ios-release-testflight` |
| `release-cannot-resume` | release:ios --resume stops with: cannot resume: HEAD is "...", not "chore(<game>): build <n>" (or: build <n> is already tagged) | A commit came after the build-number bump (usually the fix itself), or that build already finished and was tagged | Rerun release:ios without --resume; it takes a new build number (gaps are harmless, Apple rejects only duplicates) | documented | `ios-release-testflight` |

## Export

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `release-manage-version-default` | Exported build has other version or build numbers than game.config.ts | manageAppVersionAndBuildNumber defaults to YES in ExportOptions | Set manageAppVersionAndBuildNumber false (both export-options files) | documented | `ios-release-testflight` |
| `release-app-store-method` | xcodebuild warns that method app-store is deprecated | The ExportOptions method was renamed | Use method app-store-connect, destination export, signingStyle automatic | documented | `ios-release-testflight` |

## Store gate

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `release-test-ids-in-bundle` | grep finds 3940256099942544 in every store main.jsbundle | react-native-google-mobile-ads ships its TestIds module (18 occurrences) in every bundle | Check the sample publisher ID on the source-mapped expo export excluding node_modules; the binary gate checks GADApplicationIdentifier and the sentinel instead | verified | `privacy-and-network-audit` |
| `release-gate-failed` | store-artifact gate failed | The exported .ipa has test code, a test artefact (StoreKit file, harness), the sample AdMob ID, a stale build number or get-task-allow | Fix the cause the message names, rebuild with a new build number; never skip the gate | verified | `ios-release-testflight` |
| `release-prereq-scripts-missing` | npm run release:ios stops with Missing script: "audit:privacy" (or "verify", "audit:network") | release:ios runs verify, audit:privacy and audit:network before archiving | Add the three npm scripts (quality-gates, privacy-and-network-audit); check-release-setup reports a missing one as release-prereqs | verified | `ios-release-testflight` |

## REST

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `release-jwt-lifetime` | App Store Connect rejects a token that looks valid | Tokens that expire more than 20 minutes after iat are invalid; a stale clock also breaks iat | createAscJwt uses 15 minutes and a fresh token per request in long waits | documented | `ios-release-testflight` |

## Secrets

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `release-secrets-printed` | A JWT, Authorization header or key text appears in a log, report or commit | Debug output or a copy of the key | Stop and ask the owner to revoke the key, create a new team key, replace the file and update the IDs; check git log -p -S for the key header and reports/ | documented, owner | `ios-release-testflight` |

## App Store Connect

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `release-no-internal-group` | The build is VALID but does not appear in TestFlight on the owner's iPhone | TestFlight shows a build only to testers in a group that has it; the app has no internal tester group with automatic distribution | Owner step (with G2): the app > TestFlight > Internal Testing > +, name Owner, automatic distribution on, add themself; later builds then appear without another step | documented, owner | `ios-release-testflight` |
| `release-no-fa-store-locale` | App Store Connect offers no Persian or Sorani localization for the store page, What to Test or the Premium product | Apple's App Store localization list has neither language | Store texts in en-US and de-DE only; the in-app languages are unaffected | documented | `premium-purchase` |
| `release-first-iap-with-version` | The Premium in-app purchase cannot be submitted on its own | The first non-consumable must be submitted with a new app version | The owner selects Premium on the version page before Submit for Review (step R5); later IAPs can use inAppPurchaseSubmissions | documented, owner | `premium-purchase` |

## Partial Shell

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `release-shell-complete` | check-release-setup or check-store-artifact fails [shell-complete]: shell-slice.json exists, a route still uses NotBuiltScreen, or the bundle contains not-built.screen | A partial Shell never ships: the release gates refuse a repo that still declares a slice or routes a screen to the NotBuiltScreen stand-in | Build the missing screens (toybox-screens), route every screen to its real component, delete shell-slice.json, then rerun the gate | verified | `ios-release-testflight` |
