---
name: ios-release-testflight
description: Ships a Pocket Arcade game to TestFlight - API-key signing, archive, export, store-artifact gate, altool validate/upload, VALID wait, What to Test, build numbers, tags, owner steps. Use when releasing, uploading or signing a build or an upload fails. Not for simulator builds (ios-simulator-build).
---

# iOS release to TestFlight

Takes one commit of `apps/<game>` to a processed TestFlight build with one command, `npm run release:ios -- --app <game> --variant test|store`, using only Apple's command-line tools and the owner's team API key. Before anything reaches Apple, the store-artifact gate proves that what players receive has no debug code, no test ads and no StoreKit test files. Everything that needs a person is asked for, never worked around.

## Rules that must hold

1. **Nothing leaves this Mac without the owner's word in this session.** Uploading, tagging, pushing and submitting are outward-facing and cannot be undone; ask first, and never submit for review until the owner says "submit".
2. **Never open, print, copy, move, commit or log the `.p8` key, a JWT or an `Authorization` header.** Tools get only `ASC_KEY_ID`, `ASC_ISSUER_ID` and `APPLE_TEAM_ID`; only `asc-credentials.ts` reads the key, into memory. A leaked team key can publish apps.
3. **Sign only with the team API key** (`-allowProvisioningUpdates` + the three `-authenticationKey*` flags, automatic signing, cloud-managed distribution). No `.p12`, no hand-made profiles, no switching signing method to get past an error.
4. **Build only through `npm run release:ios`, from a clean tree on `main`, after `npm run verify`** (and, for store builds, green E2E and screenshots on a test build of the same commit). It bumps `buildNumber` in `game.config.ts`, commits, then archives from a clean prebuild.
5. **A build number is never reused or rolled back; `version` lives only in `game.config.ts`.** Apple rejects duplicates (ITMS-90189) and lower versions (ITMS-90062); a failed upload still consumes its number.
6. **Test builds use `export-options-test.plist` (`testFlightInternalTestingOnly: true`); store builds use the store file.** An internal-only build can never reach external testers or the App Store.
7. **The store-artifact gate passes on the exported `.ipa` before `--validate-app`.** It is the only proof that the debug menu, the StoreKit harness and test ads are absent from what players get.
8. **An upload is done only when processing reaches `VALID`.** `altool --upload-package --wait` returns at PROCESSING.
9. **Stop and ask, never retry, on `errSecInternalComponent`, the Xcode licence, any agreement error, a missing app record, HTTP 401/403, or `INVALID`/`FAILED` processing.** Each needs a person or a credential; retries can lock the account or burn build numbers.
10. **Tag every uploaded build `<slug>/v<version>+<build>` and the shipped version `<slug>/v<version>`.** Each TestFlight build then traces back to its commit; tags are pushed only with the owner's word.
11. **Select Xcode 26.6 through `DEVELOPER_DIR`, never `xcode-select` or `sudo`.** `/Applications/Xcode.app` is Xcode 27 on this Mac, and `check-store-artifact.mjs` rejects any build whose `DTXcode` is not 2660.
12. **A partial Shell never ships, in either variant:** no `shell-slice.json`, no route on `NotBuiltScreen`, no `not-built.screen` in the bundle. The preflight, `check-release-setup.mjs` and the gate each stop it. Testers and players would open a placeholder instead of a screen.
13. **Every game ships as `io.applander.<game id without hyphens>` with no scaffold placeholder** (owner decision O4): Premium is `<bundle id>.premium`; the gates refuse `com.example.*`, the AdMob placeholders `ca-app-pub-1234567890123456~1234567890` and `/1111111111`, `/2222222222`, `/3333333333` (until owner step G5), and the links `example.com` and `support@example.com` (until owner step G3) by name. Each checker exports its `PLACEHOLDERS` list. Why: a placeholder AdMob id passes a format check, and a wrong bundle id has no app record.
14. **Every build carries Apple's tracking prompt text in `Info.plist` and in `en`, `de`, `fa` and `ckb`** (owner decision O1, App Tracking Transparency; the gate's rule `att-string`). Why: iOS kills an app that asks for tracking without the text.
15. **Owner steps never block a release** (owner decision O6): the fa/ckb review (R3, G7), the play-test (R1, G6) and listening to the sound previews are listed in the report under "Owner steps (not blocking)"; the preflight prints the texts waiting for review and goes on. Only the owner's "ship" and "submit" gate what happens next.
16. **A keyless rehearsal is never release evidence.** `check-store-artifact.mjs --unsigned` (and privacy-and-network-audit's `audit-app-bundle.mjs --unsigned`) exists only for an archive built with `CODE_SIGNING_ALLOWED=NO`: it prints `REHEARSAL: not a release gate`, reports only the signing rule as `SKIP` and keeps every other rule strict; `release-ios.ts` never passes it.

## Workflow

1. **Before the first release in a repo:** read [references/signing-and-keys.md](references/signing-and-keys.md) and [references/human-steps.md](references/human-steps.md). Ask the owner for every missing once-only step (O1-O3, O5) in one message, and per game for G1, G2 (the app record and its internal tester group, or nobody sees the build in TestFlight) and G5 (real AdMob IDs are needed for `--ads live`).
2. **Install the templates that are missing** (each to the same path in the repo): `templates/packages/tooling/config/export-options-{test,store}.plist`, `templates/packages/tooling/src/release/` (the CLI `release-ios.ts`, its steps and pure modules with tests), `templates/packages/tooling/src/asc/` (JWT, credentials, REST client, app lookup, What to Test), `templates/packages/tooling/src/clock/system-clock.ts` (adds `nowEpochSeconds`), and, if the simulator build is not set up yet, `templates/packages/tooling/src/ios/toolchain.ts` and `templates/packages/shell/src/config/app-variant.ts`. Root script: `"release:ios": "node packages/tooling/src/release/release-ios.ts"`. The pipeline also runs `npm run verify`, `audit:privacy` and `audit:network` (set up with the `quality-gates` and `privacy-and-network-audit` skills) and, for store builds, i18n-strings-and-catalogs' `packages/tooling/src/i18n/review-sheet.ts` (without `--release`: it only lists the fa/ckb texts waiting for the owner, never stops the release). Then `npm run -s check:fast`.
3. **Check the setup:** `node ${CLAUDE_SKILL_DIR}/scripts/check-release-setup.mjs .` from the repo root; fix every `FAIL` line and rerun until `RESULT: PASS`.
4. **Prepare the commit:** `npm run verify` green; for a store release also a test-variant simulator build with green `npm run e2e:ios` and `npm run screenshots:ios` of this commit, the version raised above the last release tag, and `game.config.ts` with the fixed bundle id, the owner's AdMob ids (G5) and links (G3). The owner's play-test (R1), the fa/ckb review (R3) and the sound previews are owner steps listed in the report, never waited for. The checklist is in the human-steps reference.
   **Without the owner's key yet** (O3 not done), rehearse instead: [references/release-pipeline.md](references/release-pipeline.md), "Rehearsal without the owner's key", builds an unsigned store/off archive and runs both gates with `--unsigned`; it uploads nothing and proves everything but the signature.
5. **Release:** with the owner's go-ahead, `npm run release:ios -- --app <game> --variant test` (internal testers) or `--variant store` (add `--notes "..."` for what testers should check, `--known-issue "..."`). Read [references/release-pipeline.md](references/release-pipeline.md) for what each of the 12 steps does and how to run one by hand.
6. **Prove the upload:** `node ${CLAUDE_SKILL_DIR}/scripts/check-store-artifact.mjs --ipa apps/<game>/build/export/<App>.ipa --variant <v> --ads <m> --version <x.y.z> --build <n> --game <game> .` must print `RESULT: PASS`, and the run must have printed `processed (VALID)`. The last argument is the repo root the build came from (rule `shell-complete`).
7. **On any failure**, read the message `release:ios` printed (it already matched [references/failure-playbook.md](references/failure-playbook.md)). A stop goes to the owner as printed, without the `(log: ...)` and `Resume:` lines, which are for you. After the owner confirms or your fix is committed, rerun as the `Resume:` line says: the same command, `--resume build` (same build number, nothing was uploaded) or `--resume processing` (the upload is done). REST errors are explained in [references/app-store-connect-api.md](references/app-store-connect-api.md).
8. **Report and wait:** send the owner one message shaped like [examples/release-messages.md](examples/release-messages.md) (game, version, build, variant, gate result, What to Test, the one question, and the block "Owner steps (not blocking)"). On "ship": `git tag <slug>/v<version>`; submission only on "submit". Record any answer to the open questions in the playbook reference.

## Definition of done

- [ ] The owner agreed to this upload in this session; nothing was pushed or submitted without their word.
- [ ] `release:ios` finished: build number bumped and committed, gate passed, validated, uploaded, processing `VALID`, What to Test set, build tag created.
- [ ] No key material, token or signing file appears in the repo, logs or report; the key was never opened.
- [ ] The owner has one report message with the build, the evidence, the one question (ship or not) and the owner steps that do not block (fa/ckb review, play-test, sound previews).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-store-artifact.mjs --ipa <ipa> --variant <v> --ads <m> --version <x.y.z> --build <n> --game <game> .` prints `RESULT: PASS` without `--unsigned` (a `REHEARSAL` result never counts).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-release-setup.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Retrying `release:ios` after `errSecInternalComponent`, a 401 or an agreement error.** Send the stop message and wait.
- **`cat ~/.appstoreconnect/private_keys/AuthKey_*.p8` "to check the key".** Check the path and mode with `stat`; the file is never opened.
- **Switching to manual signing or importing a `.p12` when automatic signing fails.** Follow the playbook row (missing flags, `APPLE_TEAM_ID` before prebuild, key role) or stop.
- **Reusing build 8 after a failed upload.** A number is spent once an upload was attempted; rerun without `--resume` so it bumps again.
- **Rerunning a plain `release:ios` after the build was uploaded "because processing timed out".** That uploads a second build; use `--resume processing`.
- **Announcing "uploaded" after altool returns.** Wait for `VALID`; `INVALID` needs Apple's email and a new build.
- **Skipping the gate "because the simulator store build was clean".** The gate checks the signed export players receive.
- **Uploading a test-variant build with the store export options.** Test builds are internal-only by construction.
- **Submitting for review because the owner said "ship".** "Ship" tags the release; "submit" submits.
- **Holding a release until the fa/ckb texts are reviewed, or turning the review sheet's `--release` back on.** The owner reviews them personally; list them as an owner step and go on.
- **Citing an `--unsigned` run as the store gate, or passing `--unsigned` in `release-ios.ts`.** A rehearsal proves the build, never what players receive.
- **Editing a scaffold placeholder into "something real-looking" to pass the gate.** The AdMob ids and links come from the owner (G5, G3); ask.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/signing-and-keys.md](references/signing-and-keys.md) | What signs what, team key and Admin role, env vars, key and token rules, keychain, entitlements, leak response, verified vs not | Workflow step 1, and on any signing error |
| [references/release-pipeline.md](references/release-pipeline.md) | Steps 0-12 with every command, ExportOptions keys, the gate commands, processing wait, What to Test, resuming a stopped run, version/build/tag policy, after "ship" | Workflow steps 5 and 7, and to run a step by hand |
| [references/app-store-connect-api.md](references/app-store-connect-api.md) | REST endpoints and when to use them, JWT rules, the ASC modules, error codes | When a REST call fails or a new one is needed |
| [references/human-steps.md](references/human-steps.md) | Owner steps O1-O10, G1-G8, R1-R6, the release checklist, Android later | Workflow steps 1 and 4 |
| [references/failure-playbook.md](references/failure-playbook.md) | Symptom, cause, action for every known release failure; stops; open questions | Workflow step 7 |
| [examples/release-messages.md](examples/release-messages.md) | A finished-release report, a stop message and a G2 request, plus bad versions | Workflow step 8 |
| `templates/packages/tooling/config/` | `export-options-test.plist` and `export-options-store.plist` | Workflow step 2 |
| `templates/packages/tooling/src/release/` | `release-ios.ts` (CLI, with `--resume build\|processing`), `release-preflight.ts` (+ test: the bundle id check, the non-blocking fa/ckb owner step), `translation-review.ts` (+ test), `release-build.ts`, `release-upload.ts`, `release-runner.ts`, pure `release-options.ts`, `release-failures.ts`, `store-gate.ts` (the app id, placeholders, tracking text; `PLACEHOLDERS`, `appIdOf`), `processing.ts`, `what-to-test.ts`, `build-number.ts`, `bump-build-number.ts`, and their tests | Workflow step 2 |
| `templates/packages/tooling/src/asc/` | `asc-jwt.ts` (+ test), `asc-credentials.ts`, `asc-client.ts`, `find-app.ts`, `print-app-record.ts` (`--app <game>`), `beta-notes.ts` | Workflow step 2 |
| `templates/packages/tooling/src/clock/system-clock.ts` | `nowEpochSeconds()` and `todayIso()`, the only wall-clock reader | Workflow step 2 |
| `templates/packages/tooling/src/ios/` | `toolchain.ts` (Xcode 26.6 via DEVELOPER_DIR) and its test (synced from the library, identical to ios-simulator-build's copy; do not edit here) | Workflow step 2, if missing |
| `templates/packages/shell/src/config/` | `app-variant.ts` (variant rules) and its test (synced from the library; do not edit here) | Workflow step 2, if missing |
| `scripts/check-release-setup.mjs` | Checks ExportOptions, game.config.ts numbers, the fixed bundle and Premium ids and no scaffold placeholder (`game-config`), npm script and the verify/audit scripts it runs, API-key signing, key reads, printed tokens, key material (outside `skills/`, `.claude/` and generated folders), .gitignore, Claude deny rules, xcode-select, and a complete Shell (`shell-complete`) | Workflow step 3 and the definition of done |
| `scripts/check-store-artifact.mjs` | The store-artifact gate on an `.ipa` or `Payload/<App>.app` (app id, placeholders, tracking text in every language, links, `--unsigned` for the keyless rehearsal only), plus `shell-complete` on the repo it came from and on the bundle; exports `PLACEHOLDERS` | Workflow step 6 and the definition of done |
| `scripts/lib/shell-complete.mjs` | The partial-Shell facts both checkers use (`shell-slice.json`, `NotBuiltScreen` routes, the placeholder testID) | Never by hand |
| `scripts/lib/plist.mjs` | XML and binary plist reader used by both checkers | Never by hand |
| `scripts/lib/ship-placeholders.mjs` | The scaffold placeholders the gates refuse by name and the io.applander app id rule (synced from the library; do not edit here) | Never by hand |
| `scripts/lib/tracking-text.mjs` | Reads `NSUserTrackingUsageDescription` from `Info.plist` and each `.lproj/InfoPlist.strings` (synced from the library; do not edit here) | Never by hand |
| `scripts/selftest.mjs` | Pins `PLACEHOLDERS`, then proves both checkers pass good fixtures, the rehearsal pass case, and catch every planted bug (key files and `.ipa` files are created at run time) | After changing a checker or a template |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad repos and app bundles for the self-test | When adding a rule to a checker |

## Related skills

- `ios-simulator-build` - Release simulator builds, variants and the Metro cache key the gate depends on.
- `git-commits-and-reporting` - commit messages, tags and the owner report format.
- `privacy-and-network-audit` - `audit:privacy`, `audit:network` and the App Privacy answers.
- `admob-ads` - real AdMob IDs, SKAdNetwork list and `app-ads.txt`.
- `premium-purchase` - the Premium in-app purchase and its StoreKit test harness.
- `troubleshooting-playbook` - failures outside the release pipeline.
