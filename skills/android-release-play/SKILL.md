---
name: android-release-play
description: Puts a Pocket Arcade game on Google Play internal testing - AAB via bundleRelease, Play App Signing, upload keystore, versionCode, AAB gate and stamp, Android Publisher API, GP1-GP7. Use when an Android build goes to Google Play or the Play Console. Not for emulator builds (android-emulator-build).
---

# Android release to Google Play

Takes one commit of `apps/<game>` to a signed Android App Bundle on the Google Play internal testing track, with `npm run release:android` and nothing but node, Gradle and the owner's service account. Before anything reaches Google, the store-AAB gate proves what players would receive: the upload key's signature, a fresh versionCode, no test code, the game's own AdMob id, the allowed permissions. Everything that needs a person is asked for, never worked around.

## Rules that must hold

1. **Nothing leaves this Mac without the owner's word in this session.** An upload, a tag push or a track change cannot be undone; ask first, and only ever write the internal track.
2. **The upload key lives outside the repo (`~/.android-keys/<game>-upload.jks`, mode 600) with its passwords in `~/.gradle/gradle.properties`, and is never opened, printed, copied, committed or logged; Google holds the app-signing key (Play App Signing).** Whoever holds the upload key can upload builds as us; only Gradle reads it, through the game's own `E07_<GAME>_UPLOAD_*` properties.
3. **The service-account JSON is treated exactly like the `.p8`: only `play-credentials.ts` reads it, once, into memory.** A leaked service-account key can release apps; the parsed account exposes an e-mail and a sign function, never the key, and no error quotes it.
4. **Build only with `bundleRelease`, through `npm run release:android -- --app <game> --track internal`, from a clean `main` after `npm run verify`, with green Android E2E and screenshots of the same commit.** The pipeline commits the build number before it builds, so only a reviewed, proven commit may start it.
5. **The build number is shared with iOS and equals `versionCode`; it is never reused or rolled back.** Google refuses a used versionCode for good, and one sequence keeps every `<game>/vX.Y.Z+<n>` tag unique across both platforms.
6. **`check-store-aab.mjs` passes on the exact bytes before any upload; uploads go only to the internal track, and promotion is the owner's.** The gate writes a stamp with the AAB's sha256 only on a PASS, and `--resume upload` refuses anything else, so an unchecked or changed bundle never leaves.
7. **The first upload of a new app is the owner's, in the Play Console.** The API cannot create an app, and whether it may upload the very first bundle is verified on the first run; until then the default is the Console upload (GP7).
8. **Stop and ask, never retry, on 401 or 403, an app that is not found, the API not enabled, missing policy declarations, or a used version code.** Each needs a person or a new number; a retry can lock the service account or burn numbers.
9. **Owner steps never block (O6), and a keyless rehearsal is never release evidence.** Until O10 and GP1-GP7 are done, the release ends with the rehearsal (`--unsigned` prints `REHEARSAL: not a release gate`) and a slice report; the gates end with `owner-placeholder` lines and `OWNER STEPS PENDING: G3, GP5` by design.

## Workflow

1. **Before the first release in a repo:** read [references/human-steps.md](references/human-steps.md) (O10 and GP1-GP7 with click paths) and [references/signing-and-keys.md](references/signing-and-keys.md) (the two keys, generating the upload key with keytool, the Gradle properties, the service-account key, the leak response). Ask the owner for every missing step in one message with its default (git-commits-and-reporting's request form).
2. **Install the templates** (each to the same path in the repo; the first line names it). This is Android step 8 of pocket-arcade-index's Android order:

   | Template | Goes to |
   |---|---|
   | `templates/packages/tooling/src/release-android/` | same path: `release-android.ts` (the CLI), `release-android-plan.ts`, `version-code.ts`, `aab-signing.ts`, `play-credentials.ts`, `play-client.ts`, each with its test |
   | `templates/packages/shell/src/config/upload-signing.ts` + `upload-signing.test.ts` | same paths (`addUploadSigning`, the release signing config); already copied at Android step 2 with `withShell` |
   | `templates/packages/shell/plugins/with-upload-signing.ts` | same path, already copied at Android step 2: `withShell`'s Android plugins list it as `['@e07/shell/plugins/with-upload-signing.ts', { game: game.id }]` (architecture-and-boundaries owns `withShell`) |

   Copy each test before its module against a typed stub and see it fail on an assertion (tdd-workflow). They reuse `build/game-id.ts`, `release/build-number.ts`, `ios/tool-step.ts`, `clock/system-clock.ts` and android-emulator-build's `android/toolchain.ts` and `build/emu-build-plan.ts`. Root script, byte for byte: `"release:android": "node packages/tooling/src/release-android/release-android.ts"`. Then `npm run -s check:fast`.
3. **Check the setup:** `node ${CLAUDE_SKILL_DIR}/scripts/check-release-setup-android.mjs .` from the repo root. Fix every `FAIL` line and rerun. Until the owner supplies G3 and GP5 it ends with the `owner-placeholder` lines, `OWNER STEPS PENDING: G3, GP5` and `RESULT: FAIL`, by design; any other FAIL line is real.
4. **Without the owner's key or ids yet**, rehearse: [references/release-pipeline.md](references/release-pipeline.md), "Rehearsal without the owner's key", builds a store/off bundle and runs `check-store-aab.mjs --unsigned`; it uploads nothing, proves everything but the signature, and hands over with a slice report.
5. **Build:** with the owner's go, `npm run release:android -- --app <game> --notes "<what testers should check>"`. It runs the preflight, commits the next build number, prebuilds the store/live variant, runs `bundleRelease` and prints the gate command. Read the release-pipeline reference for each step and how to run one by hand.
6. **Gate:** `node ${CLAUDE_SKILL_DIR}/scripts/check-store-aab.mjs --aab apps/<game>/android/app/build/outputs/bundle/release/app-release.aab --variant store --ads live --version <x.y.z> --build <n> --game <game> --stamp apps/<game>/build/release/aab-gate.json .` must print `RESULT: PASS` (it writes the stamp only then).
7. **Upload:** with the owner's word in this session, `npm run release:android -- --app <game> --resume upload`. The calls are in [references/play-api.md](references/play-api.md). The first upload of a new app is the owner's (GP7).
8. **On any failure**, match the message in [references/failure-playbook.md](references/failure-playbook.md). A stop goes to the owner as one message (step, the exact error line, the one action); never retry it.
9. **Report:** the release report (git-commits-and-reporting): game, version, versionCode, the gate's RESULT line, the track and the local tag, one question, and "Owner steps (not blocking)": the Android play-test with the purchase test, TalkBack, the fa and ckb review, the sound previews.

## Definition of done

- [ ] The owner agreed to the upload in this session; nothing was pushed, promoted or submitted without their word.
- [ ] `release:android` ran from a clean `main` after a green `verify`: build number committed, bundle built with `bundleRelease`, gate passed with a stamp, uploaded to the internal track, tag created locally.
- [ ] No key, password, JSON or token appears in the repo, a log or the report; the keystore and the JSON were never opened.
- [ ] Before the owner's steps: the rehearsal printed `REHEARSAL: not a release gate`, and the report is a slice report listing O10 and GP1-GP7 under "Owner steps (not blocking)".
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-store-aab.mjs --aab <aab> --variant store --ads live --version <x.y.z> --build <n> --game <game> .` prints `RESULT: PASS` without `--unsigned`.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-release-setup-android.mjs .` prints `RESULT: PASS`, or only `owner-placeholder` lines, then `OWNER STEPS PENDING: ...`, while the owner's steps are pending

## Anti-patterns

- **`keytool -list -keystore ~/.android-keys/...` "to check the key".** That opens it; check its place and mode with `stat`, and who signed a bundle with `keytool -printcert -jarfile <aab>`.
- **Passing the store password with `-Pandroid.injected.signing.store.password=...`.** It lands in the process list and logs; Gradle reads the game's properties from `~/.gradle/gradle.properties` by itself.
- **Retrying the upload after a 403.** It needs the owner (GP3); send the stop message and wait.
- **Lowering `buildNumber` after "version code already used".** A number is spent; a new run takes the next one.
- **Uploading a bundle the gate never saw, or one rebuilt after the gate.** The stamp's sha256 refuses it; run the gate on these bytes.
- **Writing the production, beta or alpha track.** Promotion is the owner's in the Play Console.
- **Citing a `--unsigned` run as the store gate.** It is a rehearsal; the report puts it under "Not tested or not verified".
- **Typing stand-in AdMob ids to get past `owner-placeholder`.** The ids come from the owner (GP5); until then the FAIL is the expected result.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/human-steps.md](references/human-steps.md) | O10 and GP1-GP7 with click paths, the order, what the owner sends back, the owner's own checks | Workflow step 1, and before asking the owner |
| [references/signing-and-keys.md](references/signing-and-keys.md) | Play App Signing's two keys, generating the upload key, the Gradle properties, the release signing config, the service-account key, what may be done, the leak response | Workflow step 1, and on any signing error |
| [references/release-pipeline.md](references/release-pipeline.md) | Run 1 (build), the gate, run 2 (upload), steps by hand, the keyless rehearsal, numbers, tags, resuming | Workflow steps 4-7 |
| [references/play-api.md](references/play-api.md) | The JWT and token, the four edit calls, the answers and stops, what the API cannot do | Workflow step 7, and when an upload stops |
| [references/failure-playbook.md](references/failure-playbook.md) | Symptom, cause and action for setup, build, gate, upload and after-upload failures | Workflow step 8 |
| `templates/packages/tooling/src/release-android/` | The CLI and its five tested modules: plan (args, preflight, stamp, owner steps), version code, signing paths, credentials, Play client | Workflow step 2 |
| `templates/packages/shell/src/config/` | `upload-signing.ts` (the release signing config for `app/build.gradle`) and its test | Workflow step 2 |
| `templates/packages/shell/plugins/with-upload-signing.ts` | The config plugin that applies it at prebuild | Workflow step 2 |
| `scripts/check-release-setup-android.mjs` | Checks the repo: script and tooling, the upload key outside the repo, secrets ignored and denied, the service-account file read in one place, owner values (G3, GP5), a complete Shell | Workflow step 3 and the definition of done |
| `scripts/check-store-aab.mjs` | The store-AAB gate: signature, versionCode against the tags, package, test code, variant, AdMob id, owner placeholders, permissions, debuggable, target SDK, Shell; `--unsigned` for the rehearsal, `--stamp` after a PASS | Workflow step 6 and the definition of done |
| `scripts/lib/aab.mjs` | Zip reader, the protobuf manifest decoder and the signature check | Never by hand |
| `scripts/lib/ship-placeholders.mjs` | The placeholders a ship gate refuses, with their owner steps (G3, G5, GP5) and the `OWNER STEPS PENDING` line (synced from the library; do not edit here) | Never by hand |
| `assets/permission-allowlist.json` | The permissions a Pocket Arcade bundle may hold, each with who declares it (synced from the library, the same list android-emulator-build and privacy-and-network-audit check; do not edit here) | When check-store-aab reports `permission` |
| `scripts/selftest.mjs` | Proves the stamp and both checkers on good fixtures and every planted bug (settings and key files planted in a temporary copy) | After changing a checker, the allowlist or a template |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | `release-setup/` repo trees and `store-aab/` bundles with their tags and flags | When adding a rule to a checker |

## Related skills

- `android-emulator-build` - the toolchain, the variants and the emulator builds a release is proven on first.
- `ios-release-testflight` - the iOS twin; the build number and the placeholders are shared.
- `premium-purchase` - the Premium product on Google Play (GP6) and billing on Android.
- `privacy-and-network-audit` - the Data safety answers (GP4) and the key-safety audit.
- `admob-ads` - the AdMob Android app and its units (GP5).
- `git-commits-and-reporting` - the build commits, tags, the release report and stop messages.
