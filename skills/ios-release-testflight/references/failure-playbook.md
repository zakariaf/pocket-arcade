# Release failure playbook

Match the text of the failing step's log in the first column. **Stop** rows end the run with one message to the owner (the step, the exact error line, the one action needed) and are never retried: retries can lock the account or burn build numbers. The other rows are the agent's to fix. `release-failures.ts` encodes the same table, so `release:ios` prints the right message by itself.

## Contents

- The table
- After a stop
- Open questions to record on the first real release

## The table

| Symptom (match the text) | Cause | Action |
|---|---|---|
| `You have not agreed to the Xcode license agreements` | the pinned Xcode's licence was never accepted (or a new Xcode was installed) | **Stop** (O4). The owner runs `sudo /Applications/Xcode-26.6.0.app/Contents/Developer/usr/bin/xcodebuild -license accept` in Terminal; the agent never runs sudo. Then `--resume build` |
| `errSecInternalComponent` from `codesign` during archive | login keychain locked (SSH or non-GUI session) | **Stop** (O8). The owner runs `security unlock-keychain ~/Library/Keychains/login.keychain-db` in Terminal, or starts the run from the logged-in desktop. The agent never handles the password. Then `--resume build` |
| A macOS dialog "codesign wants to access key ..." | the key's access list does not allow codesign yet | **Stop.** The owner clicks Always Allow once |
| Text containing `agreement` (altool or App Store Connect), `PLA Update available` (xcodebuild), or `FORBIDDEN...` whose detail mentions an agreement | new or expired Apple agreement | **Stop** (R4). The owner accepts it at developer.apple.com and/or App Store Connect > Business; then `--resume build` if the stop came before the upload (same build number), otherwise a plain rerun |
| `print-app-record.ts` exits 2, or the upload says no app record / cannot determine the Apple ID | app record missing | **Stop** (G2). The owner creates it, then rerun |
| `[owner-placeholder] ... (owner step G5)` or `(owner step G3)` lines, then `OWNER STEPS PENDING: G3, G5` (check-release-setup, check-store-artifact, audit-app-bundle, check-sim-app --variant store, or the release's store gate) | `game.config.ts` still holds the scaffold's AdMob ids (G5) or `example.com` links (G3) | **Stop** (G3, G5), the expected result until the owner supplies them: ask once, in one message, for the steps the line names; never type a stand-in value. A rehearsal or a pilot hand-over reports them under "Owner steps (not blocking)" in a slice report. Any other FAIL line next to them is a real problem to fix |
| `NOT_AUTHORIZED` (401) from altool or REST | wrong key or issuer ID, revoked key, or clock skew | **Stop** (O3). Check the env IDs against the key file name (without reading it) and that the Mac clock is on network time; a revoked key needs a new team key |
| `FORBIDDEN_ERROR` (403), "not allowed to create distribution certificates", cloud signing permission errors | key role below Admin, or an individual key | **Stop** (O3). The owner creates a team key with the Admin role |
| Build status `INVALID` or `FAILED` | Apple rejected the binary during processing | **Stop.** Ask the owner to forward Apple's email (the agent cannot read email); fix, then rebuild with a new build number |
| `ITMS-90683: Missing purpose string in Info.plist` naming `NSMicrophoneUsageDescription` | `react-native-audio-api` references record-permission APIs (an expected risk) | Add a neutral `NSMicrophoneUsageDescription` through the audio plugin option `iosMicrophonePermission` (or an `ios.infoPlist` entry; use one of the two), translated in all four languages through `expo.locales`. The app never asks, so users never see it. Rebuild with a **new** build number |
| `ITMS-91053` (missing API declaration), `ITMS-91061` (missing privacy manifest for a listed SDK), `ITMS-91056` (invalid manifest) | the aggregated required-reason APIs are incomplete | `npm run audit:privacy`, add the missing category and reason to `ios.privacyManifests`, prebuild, rebuild with a new build number; ask the owner to paste Apple's email |
| `ITMS-90189: Redundant Binary Upload` | build number reused | never reuse: bump and rebuild. If the earlier upload really succeeded, check its processing state first |
| `ITMS-90062` (version must be higher than the approved one) | `version` not raised after an approval | raise `version` in `game.config.ts` and rebuild |
| `No profiles for '<bundle id>' were found`, `Automatic signing is disabled`, `requires a development team` | `-allowProvisioningUpdates` or the key flags missing, or no `DEVELOPMENT_TEAM` | check the auth arguments and that `APPLE_TEAM_ID` was set **before** prebuild |
| Black screen at launch after building with Xcode 27 on SDK 57 | missing UIScene life cycle | set `ios.enableSceneSupport: true` through `expo-build-properties`, or go back to Xcode 26.6 |
| Store bundle contains `SHELL_TEST_BUILD_ONLY`, `variant=test` shows in a store build, or `EXConstants.bundle/app.config` `extra` differs from the release | Metro cache not keyed on the variant, an imported-constant gate, or variables lost before `xcodebuild` | check `metro.config.js` `cacheVersion`, that test-only code is reachable only via `test-only.ts`, and that the three variables stay exported for the whole run; rebuild with a new build number |
| `pod install` fails downloading a trunk pod or spec | no network at build time, or a CDN problem | retry once after 5 minutes; pods are pinned exactly, never loosen versions |
| `EXPO_PUBLIC_APP_VARIANT=... must equal APP_VARIANT=...` | only one of the two was exported | export both (step 0) |
| Simulator will not boot, or the disk is full | old DerivedData, runtimes, simulators | `rm -rf apps/*/build`, `xcrun simctl delete unavailable`; never erase simulators the tooling did not create |
| `shell-slice.json exists, so the Shell is partial` (preflight), or the gate's `main.jsbundle contains the NotBuiltScreen placeholder` | a partial Shell: screens outside the slice still route to `NotBuiltScreen` | build the missing screens (toybox-screens), point every route at its real screen, delete `shell-slice.json`, check with `check-navigation.mjs . --complete` (navigation-and-routing), commit, then a plain rerun (a new build number if the gate stopped it) |
| `store-artifact gate failed` | a gate check found test code, a test artefact, the wrong ad ID, a stale build number or `get-task-allow` | fix the cause (the message names it), commit the fix, rerun without `--resume` (a new build number); never skip the gate |
| `processing did not reach VALID within 60 minutes` | Apple is slow, or the build is stuck | look in App Store Connect (TestFlight tab); then rerun with `--resume processing` (the upload is done, nothing is uploaded again) |
| `... while waiting for processing` or `reading the processing state failed` | a REST error (401/403, network) after the upload succeeded | a 401 or 403 is a **Stop** (O3); a network error needs the network back. Then rerun with `--resume processing`: the build is already at Apple, so a plain rerun would upload a second one |
| `setting What to Test: App Store Connect answered ...` after `VALID` | a REST error while writing the tester notes | fix the cause (a 401/403 is a stop), then rerun with `--resume processing`; it sets What to Test and tags without a new upload |
| `cannot resume: HEAD is "..."` or `cannot resume: build <n> is already tagged` | a commit came after the bump, or that build already finished | rerun without `--resume`; a new build number is harmless (Apple rejects only duplicates) |

## After a stop

Post one message to the owner with the step, the exact error line, and the one action needed (`stopMessage()` writes it). Once the owner confirms, rerun as the message's `Resume:` line says (the release-pipeline reference has the table): a stop before the bump is a plain rerun, a stop after the bump and before the upload is `--resume build` with the same build number, and an uploaded build is `--resume processing`. A number is never reused once an upload was attempted.

## Open questions to record on the first real release

Unverified because no owner key was used: whether the API key alone can create the Apple Development certificate on this Mac; the altool upload JSON field that holds the delivery ID; whether `--build-status --wait` waits until `VALID` (and what `--upload-package --wait` waits for: the Xcode 26.6 man page says it returns at `PROCESSING`, `altool --help` says "processing completion"; the pipeline polls REST for `VALID` either way); the exact `--beta-app-store-text` folder layout for a build's `whatsNew`; whether `altool --list-apps`, `--validate-app` or `--upload-package` need `--provider-public-id` with API-key auth (the man page synopsis lists it; a team key is believed to imply the provider, and the REST lookup replaces `--list-apps`; if altool asks for a provider, `xcrun altool --list-providers` with the same `--api-key`/`--api-issuer` prints it, then add `--provider-public-id <id>` to `validateArgs` and `uploadArgs`); and the exit code of `security show-keychain-info` on a locked keychain. Write each answer into the matching reference of this skill and into `release-failures.ts` if it changes a message.
