# E17 · Audits, StoreKit harness and the iOS release to TestFlight

| | |
|---|---|
| Branch | `epic/e17-ios-release-pilot` |
| Depends on | E16 |
| Spec | N2 (no server: Premium is checked on the phone, with no purchase server), N3 (our code makes no network requests: the release audits), N7 (one purchase: `io.applander.linesiege.premium` at EUR 1.99, Family Sharing off); 4.2 (the App Privacy answers; Apple's tracking prompt after the consent step and before the first ad); 7.6 (the font test page, checked before each release); 8.8 (ads: the SKAdNetwork list and the ads smoke test), 8.9 (Premium: the StoreKit Tier 2 harness and the product in App Store Connect), 8.11 (text at 200 %); 11 (the owner's values in `game.config.ts` and the completeness check), 12 (game 2 starts from `npm run new-game`); 15.1-15.8 (the exit test: every item with its evidence); decisions D3 (EUR 1.99) and D8 (general audience: content rating PG, AdMob blocking controls); owner decisions O1-O6; lead decision L14 (owner placeholders never pass, and the fa and ckb review never blocks) |
| Build order | Shell steps 11 and 12 |
| Tasks | 12 |

## Current state

Shell step 10 passed in E16. The Shell with Line Siege is complete and proven on the simulator. Concretely:

- Every screen (S1 to S15, S11a to S11d) is built and routed. `shell-slice.json` and the `NotBuiltScreen` stand-in are gone, and `node skills/navigation-and-routing/scripts/check-navigation.mjs . --complete` passes.
- All 32 frames of `skills/toybox-visual-parity/assets/frames.json` are signed off in light and dark × en and fa. `parity/game-facts.json` picks the Line Siege references: `s6-pause--no-music--no-hints`, `s7-result-win--score`, `s11-settings--no-music` and `s14-reset-all-progress--no-music`. The ledger is `parity/signoff.json`, and the runs are in the gitignored `.parity/`.
- The evidence run `npm run e2e:ios -- --app line-siege` passes. It covers Shell flows 01 to 05 (05 is the full airplane-mode run), the pilot's flows 10 to 13 and the 200 % text flow in en and fa. `network.txt` is empty, and cold start, memory and the save benchmark are within budget. `perf-baselines/cold-start-sim-line-siege.json` is committed.
- The screenshot matrix has 176 committed baselines in `apps/line-siege/e2e/baselines/`: phone and tablet × en, de, fa, ckb × light, dark.
- admob-ads' six ads smoke flows are in `packages/shell/e2e/ads-smoke/` and pass `check-flows`, but they have never run.
- `apps/line-siege/game.config.ts` holds `version: '1.0.0'`, `buildNumber: 1`, the fixed ids `io.applander.linesiege` and `io.applander.linesiege.premium`, and the scaffold's placeholders:
  - owner step G5: the AdMob app id `ca-app-pub-1234567890123456~1234567890` and the units `/1111111111`, `/2222222222` and `/3333333333`;
  - owner step G3: the privacy host `example.com` and the support address `support@example.com`.
- `packages/tooling` has:
  - the audit tooling (`src/audit/`, `network-audit/`);
  - the simulator build tooling (`src/build/`, `src/ios/toolchain.ts`);
  - the E2E and screenshot tooling (`src/e2e/` with `maestro-args.ts`, `src/visual/`, `scripts/install-maestro.sh`);
  - `src/ads/refresh-skadnetwork.ts` and `src/i18n/review-sheet.ts`;
  - `src/clock/system-clock.ts`, with `nowEpochSeconds`, since E01.
- Maestro 2.10.0 is installed in `tools/maestro/`.

Not there yet:

- The release pipeline: `packages/tooling/config/` (the two ExportOptions files), `packages/tooling/src/release/` and `packages/tooling/src/asc/`. The root script `release:ios` has existed since E01, but its target does not.
- The StoreKit harness (`packages/tooling/src/storekit/`), the Premium product tool (`create-premium-iap.ts` and `premium-iap-payloads.ts`), and the Tier 2 flows (`packages/shell/e2e/storekit/`).
- None of these has ever run:
  - parity in de and ckb;
  - a look at the S15 font test page;
  - the screenshot matrix at 200 % text;
  - `refresh-skadnetwork.ts --check` and the ads smoke test;
  - the StoreKit harness;
  - Stryker over the whole logic set;
  - `check-balance --release`, `check-game-app --stage complete` and `check-release-setup`.
- There is no App Store Connect record we know of, no Premium product, no TestFlight build and no git tag. Owner steps O1 to O3, O5, O9 and G1 to G5 may all still be open.

Checks at the start:

- `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with one SKIP line: the release:ios script target, due at Shell step 11.
- `npm run verify` is green, prints no SKIP line, and ends with `verify: 11 steps passed, 0 skipped`.
- These print `RESULT: PASS`:
  - `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege --screenshots`;
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --all`.
- `node skills/ios-release-testflight/scripts/check-release-setup.mjs .` fails:
  - `release-files` and `export-options`, because the templates are not copied yet;
  - the six `owner-placeholder` lines (four for G5, two for G3).

## What we will do

This epic is Shell step 11 (the audits and the release pipeline) and Shell step 12 (the pilot passes the completeness check). It ends with the first TestFlight build.

- **Owner steps first, in one message.** Every human step the first release needs goes to the owner in one message (T01), each with its default. The work never waits for it.
  - The upload waits only for the owner's go, the agreements (O1), the API key (O3) and the app record (G2).
  - Only a store build waits for G3 and G5. Until then every ship gate ends with the `owner-placeholder` lines and `OWNER STEPS PENDING: G3, G5` (L14).
- **Release tooling, test first.** Copy Shell step 11's manifest:
  - from ios-release-testflight: `packages/tooling/config/**`, `src/release/**` and `src/asc/**` (T02);
  - from premium-purchase: `packages/tooling/src/storekit/**`, `src/asc/**` and `packages/shell/e2e/storekit/**` (T07).
- **The pre-release checks, in order.**
  - Every frame is matched to its design in de and ckb, and again in en and fa on the release candidate (T03, T04).
  - The font test page shows every letter and digit in every font (T05). The template page misses two of the Sorani letters spec 7.6 names, so this is fixed test first.
  - The screenshot matrix runs at 200 % text (T05).
  - The SKAdNetwork list is checked and the six ads smoke flows run by hand. They are spec 15.4's evidence for consent before the first ad and for Apple's tracking prompt (T06).
  - The StoreKit harness runs in the release-day order: the E2E evidence run, the harness, delete its simulator, then a clean prebuild (15.5, T07).
  - Then the audits, the budgets and mutation testing (T08).
- **Prove it complete (Shell step 12).**
  - `check-navigation --complete` passes.
  - `check-game-app --stage complete` passes, or ends with only the owner placeholders.
  - `npm run verify` is green with no SKIP line.
  - `npm run new-game` is ready for game 2 (15.8).
  - Each of 15.1 to 15.8 is mapped to its evidence file (T09).
- **Merge, then release from main.** `release:ios` builds only from a clean `main` (ios-release-testflight rule 4), so the branch is simplified, reviewed and merged in T10, before the upload.
  - With the owner's key, the app record and the owner's go, T11 uploads a test-variant build to internal TestFlight, waits for `processed (VALID)` and tags it `line-siege/v1.0.0+<n>`.
  - Without them, T11 runs the keyless store rehearsal instead and hands the pilot over with a slice report.
- **Hand over.** The owner's own checks are listed under "Owner steps (not blocking)" (T12). Nothing waits for them.

Screens: T03 and T04 compare every frame and carry "Design match" lines. T05 changes only the S15 font test page, which has no design frame. Any screen that a 200 % or language defect forces us to change is captured and signed off again in all eight variants before its task is done.

Not in this epic:

- These belong to the later pipeline steps 8 and 9, not to these epics:
  - the store web pages and the store listing (G8);
  - a store-variant build with live ads;
  - submission to App Review (R5);
  - the release tag `line-siege/v1.0.0`;
  - linking AdMob to the listing and `app-ads.txt` (A5).
- The Android port of the Shell and Line Siege (E18).
- Game 2 and every later game: one epic each, E19 (Flock Tilt) to E43 (Halo Drift), in catalogue order, each starting from `npm run new-game` as T09 proves.
- Acting on the owner's own checks (the play-test with the Tier 3 purchase test, the fa and ckb review, the sound previews, the VoiceOver pass, the device perf report). They are listed here; their answers become test-first fixes whenever they arrive.
- Changing the skills. A template gap found here (the font test samples) is fixed in the repo and named in the report, so that the skill library can be updated.

## Final state

- [ ] The release tooling is in and tested. `npx jest packages/tooling/src/release packages/tooling/src/asc packages/tooling/src/storekit --ci --selectProjects unit` passes, and `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with no SKIP line.
- [ ] The release setup is right. With the owner's G3 and G5 values in `game.config.ts`, `node skills/ios-release-testflight/scripts/check-release-setup.mjs .` prints `RESULT: PASS`. Until then it ends with exactly six `owner-placeholder` lines, then `OWNER STEPS PENDING: G3, G5`, then `RESULT: FAIL (6 problems)`, and nothing else.
- [ ] Every frame matches its design in all four languages.
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --all --langs en,fa,de,ckb --reference .parity/design` prints `RESULT: PASS`. This covers all 32 frames in light and dark × en, fa, de and ckb at every scroll offset, S15 included.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --all` prints `RESULT: PASS`.
- [ ] The font test page shows every letter and digit (spec 7.6). `npx jest packages/shell/src/screens/debug --ci --selectProjects unit` passes with the new letter test. Its screenshots in en and fa, light and dark, are in `reports/font-test/`, and each one was opened and read.
- [ ] Text at 200 % is stable and was read. `npm run screenshots:ios -- --app line-siege --text-size accessibility-extra-extra-extra-large --sim e17-shots` prints `176 screenshots, 0 changed`, and its baselines are committed with a `Gate-Change:` trailer.
- [ ] Ads are ready for a release.
  - `node packages/tooling/src/ads/refresh-skadnetwork.ts --check` exits 0.
  - The six ads smoke flows passed on an `ADS_MODE=test` build, with their output in `reports/ads-smoke/`.
  - `check-ads.mjs .` and `check-ad-behaviour.mjs .` print `RESULT: PASS`.
- [ ] Premium passed Tier 2.
  - `node packages/tooling/src/storekit/storekit-harness.ts --app line-siege --device <udid>` printed `storekit: 0 of 7 scenario(s) failed`.
  - Its simulator is deleted, and the clean prebuild has no `StoreKitHarness` target and no `.storekit` file.
  - `check-premium.mjs .` and `check-premium-behaviour.mjs .` print `RESULT: PASS`.
- [ ] The release audits pass.
  - `audit-repo.mjs .`, `audit-privacy-manifest.mjs .`, `audit-bundle.mjs --export dist-audit/line-siege .`, `check-budgets.mjs .`, `check-bundle-size.mjs` and `check-known-pitfalls.mjs .` print `RESULT: PASS`.
  - `npm run audit:network` prints `audit:network: 0 failure(s)` with every layer run, and `npm run audit:licenses` passes.
  - `check-mutation-report.mjs reports/stryker/mutation.json` reports a score of at least 75 %.
- [ ] The pilot is complete (Shell step 12).
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs . --complete` prints `RESULT: PASS`.
  - `node skills/new-game-scaffold/scripts/check-game-app.mjs . --app line-siege --stage complete` prints `RESULT: PASS`. Before G3 and G5 it ends with exactly the six `owner-placeholder` lines, `OWNER STEPS PENDING: G3, G5` and `RESULT: FAIL (6 problems)`.
  - `npm run verify` ends with `verify: 11 steps passed, 0 skipped` and prints no SKIP line.
  - `npm run new-game -- --help` prints the generator's usage.
- [ ] Line Siege reached the owner in one of two ways.
  - **(a) Released.** `npm run release:ios -- --app line-siege --variant test` printed `processed (VALID)`, and `git tag -l 'line-siege/v1.0.0+*'` lists its build tag. `check-store-artifact.mjs --ipa ... --variant test --ads test ...` and `check-tags.mjs .` print `RESULT: PASS`, and the release report passes `check-report.mjs ... --kind release`.
  - **(b) Rehearsed.** Without the owner's key or app record, the keyless store rehearsal ran: `check-store-artifact.mjs --unsigned` printed `REHEARSAL: not a release gate` and only the expected owner-placeholder result. The hand-over report passes `check-report.mjs ... --kind slice`.
- [ ] Each of spec 15.1 to 15.8 is mapped to its evidence file in the report's "Exit test (spec 15)" block.
- [ ] The owner's own checks are listed under "Owner steps (not blocking)", and nothing waited for them: the play-test with the Tier 3 purchase test, the balance bands, the fa and ckb review sheets, the sound previews, VoiceOver, the device perf report and R1.
- [ ] The branch is merged. `git log main --merges --oneline | grep -c epic/e17-ios-release-pilot` prints 1 or more.

## Skills to load

Always: `pocket-arcade-index`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`.

For this epic:

- `pocket-arcade-product-spec`: prints the exact spec lines (N2, N3, N7, 4.2, 7.6, 8.8, 8.9, 8.11, 11, 12, 15.1 to 15.8) for commit bodies, the owner message and the exit-test map, and runs `check-spec-refs`.
- `ios-release-testflight`: the release templates, `check-release-setup`, `check-store-artifact`, `npm run release:ios`, the owner's human steps (O1 to O10, G1 to G8, R1 to R6), the keyless rehearsal, and the failure playbook.
- `premium-purchase`: the StoreKit harness and Tier 2 flows, the release-day order, `create-premium-iap.ts` (EUR 1.99, Family Sharing off), `check-premium`, `check-premium-behaviour`, and the owner's Tier 3 test.
- `privacy-and-network-audit`: `audit-repo`, `audit-privacy-manifest`, `audit-bundle`, `audit-app-bundle`, the App Privacy answers for G3, and key hygiene.
- `admob-ads`: `refresh-skadnetwork.ts --check`, the ads smoke procedure, `check-ads`, `check-ad-behaviour`, and the AdMob console steps A1 to A5.
- `performance-budgets`: `check-budgets`, `check-bundle-size`, `check-perf-report` (simulator now, the owner's device later), and the device report steps.
- `e2e-maestro`: the E2E evidence run, the screenshot matrix at 200 %, `check-e2e-report`, `check-flows`, and running Maestro by hand with `--device` and `--driver-host-port`.
- `toybox-visual-parity`: `shoot-design` for the de and ckb references, `setup-parity-sim`, `run-parity`, `check-signoff` (with `--langs en,fa,de,ckb`), `check-harness`, and waivers.
- `toybox-screens`: the S15 font test page files, layout fixes a language or text size reveals, and `check-screens`.
- `rtl-and-direction`: what correct Sorani right-to-left looks like (mirroring, Arabic-Indic digits, boards left to right) when a ckb defect is fixed, and `check-rtl`.
- `i18n-strings-and-catalogs`: `npm run i18n:verify`, `check-catalogs` (de, fa and ckb keys equal en's; debug texts stay English), and the review sheets `review-sheet.ts` (G7, R3).
- `accessibility`: the 200 % text pass, `check-a11y-code`, `check-contrast`, and the owner's VoiceOver checklist (R2).
- `ios-simulator-build`: the Release builds this epic captures (`npm run build:ios:sim`), `check-sim-app` and `check-sim-setup`.
- `game-balance-and-bots`: `check-balance --release` (its `OWNER STEP (not blocking)` line) and the difficulty curve for 15.7.
- `level-generation-and-solvers`: `check-levels`, which proves every shipped level winnable (15.7).
- `save-persistence-and-migrations`: the kill test on the release candidate and `check-save-layer` (15.6).
- `game-audio-and-haptics`: renders the WAV previews the owner listens to (`check-sound-banks --wav-dir`, G9).
- `new-game-scaffold`: `check-game-app --stage complete` and `npm run new-game` (15.8).
- `navigation-and-routing`: `check-navigation --complete`.
- `unit-and-component-tests`: Stryker (`npm run test:mutation`), `check-mutation-report`, `check-test-setup` and `check-test-code`.
- `golden-tests`: the 200 % baselines and the bundle baseline are gated paths (`check-golden-changes`).
- `typescript-and-lint-rules`: the copied tooling stays within the strict config and the size limits (`check-source`).
- `naming-conventions`: the names of the new files (`check-file-names`).
- `troubleshooting-playbook`: `check-known-pitfalls` before the release, and `find-fix` on any failing build, harness or release log.
- `board-rendering-skia`: its `board-clock-state` test, where a board that does not settle after the rewarded continue is reproduced before any fix (E17-T06).

## How we work in this epic

1. Branch: `git switch main && git pull && git switch -c epic/e17-ios-release-pilot`. Push the branch after each task (`git push -u origin epic/e17-ios-release-pilot`), but only once the owner has given the word to push in this session (git-commits-and-reporting rule 5). Without it, the commits stay local and the report says so. Never bypass the pre-push hook.
2. Test first, always. Write each task's "Tests first" items, run them and watch them fail for the right reason, write the minimum code to pass, then refactor. Never weaken or edit a test to make it pass.
3. Commit each task in Conventional Commits form, with the trailers the skills ask for (Gate-Change:, Spec-Change:). `npm run -s check:fast` must be green before every commit.
4. Screens: a task that builds or changes a screen is not done until toybox-visual-parity's capture matches the Toybox design screenshot for every frame it names, in light-en, light-fa, dark-en and dark-fa at every scroll offset, and check-signoff passes for those frames. Before this release, de and ckb join that set: light-de, dark-de, light-ckb and dark-ckb, against `.parity/design` (T03, T04).
5. Stop and ask the owner only at a step marked **Owner**.

Release rules for this epic (ios-release-testflight, git-commits-and-reporting):

- **Nothing leaves this Mac without the owner's word in this session.** That covers an upload, creating the Premium product, pushing tags, and pushing `main` after the release commit. Pushing the epic branch after each task is the owner's standing rule.
- **Never open, print, copy or commit the `.p8` key, a JWT or an `Authorization` header.** Check the key file with `stat` only. Sign only with the team API key. Never run `sudo` or `xcode-select`: Xcode 26.6 is picked through `DEVELOPER_DIR`.
- **The release runs from `main` after the merge.** T10 merges the branch, because `release:ios` refuses any other branch and any dirty tree. T11 and T12 then run on `main`, and their only commit is the pipeline's own `chore(line-siege): build <n>`.
  - If T11 finds a code problem, re-create `epic/e17-ios-release-pilot` from `main`, fix it test first, run "Close the epic" steps 1 to 3 on that diff, merge again, then rerun T11. The fix commit means a new build number.
- **A release stop is never retried.** On `errSecInternalComponent`, an agreement error, a missing app record, HTTP 401 or 403, or `INVALID` processing, forward the stop message without its `(log: ...)` and `Resume:` lines. Wait, then resume exactly as the `Resume:` line says.

Simulator rules: use only this session's own simulators, and name each by UDID in every `simctl`, `xcodebuild` and Maestro call, never `booted` or `all`. Give every Maestro run its own free driver port, never 7001. Shut the simulators down by UDID at the end of each task. The simulators of this epic are:

- `e07-e17-build`: the Release builds;
- `e07-parity-e17`: parity;
- `e07-e17-fonts`: the font test page;
- `e07-ads-smoke`: the ads smoke test;
- `e07-e17-e2e` and `e07-e17-e2e-tablet`: the E2E evidence run;
- `e07-e17-shots` and `e07-e17-shots-tablet`: the screenshot matrix;
- `e07-e17-storekit`: the StoreKit harness, deleted after it runs;
- `e07-kill-test`: the kill test, created and deleted by its script.

Long runs (parity, the matrix, the E2E run, the harness, Stryker) run in the background or with the longest timeout.

## Tasks

### E17-T01 · Ask the owner for every release step in one message

- **Goal:** The owner gets every open human step for the first release in one message (ios-release-testflight workflow step 1), each with the default that applies meanwhile. The store side then runs in parallel with T02 to T10. Only the upload waits, for the owner's go, O1, O3 and G2. Only a store build waits for G3 and G5. Nothing else waits.
- **Skills:** `git-commits-and-reporting`, `ios-release-testflight`, `premium-purchase`, `admob-ads`, `privacy-and-network-audit`, `pocket-arcade-product-spec`.
- **Tests first:** No code changes. The message has a check, and it runs before sending: `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/owner-request-e17-release-steps.md --kind request`. Its first run, on the unfilled copy of the template, fails `placeholder-left`: that is the red.
- **Build:**
  1. Find out what is already done, without opening any secret:
     - O3: `test -n "$ASC_KEY_ID" && test -n "$ASC_ISSUER_ID" && test -n "$APPLE_TEAM_ID" && echo ids-set`, then `stat -f '%Sp' "$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"`, which must print `-rw-------`. Never `cat`, `open` or copy the file.
     - G3 and G5: `grep -n 'ca-app-pub-1234567890123456\|example.com' apps/line-siege/game.config.ts` lists the placeholders still in place.
     - O1, O2, O5, O9, G1, G2 and G4 cannot be seen from the Mac. Ask for all of them; the owner replies "done" for any already done.
  2. Prepare the App Privacy answers for G3.
     - If `apps/line-siege/ios/Pods` is missing, run `(cd apps/line-siege && npx expo prebuild --platform ios --clean)` first.
     - Then run `npm run audit:privacy -- --app line-siege` and `node skills/privacy-and-network-audit/scripts/audit-privacy-manifest.mjs .`.
     - Copy the App Privacy input they print: Device ID is collected, linked to the user, and used for tracking by the third-party ads SDK (Google Mobile Ads). The other data types are as printed, none of them used for tracking. Our own code collects nothing.
  3. Print the spec lines the message quotes with `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs N7 4.2 11`, never from memory.
  4. Write the message. Copy `skills/git-commits-and-reporting/templates/owner-request.md` to `reports/owner-request-e17-release-steps.md`.
     - First line: "Line Siege can reach your iPhone through TestFlight once a few store steps that only you can do are finished."
     - One request line: "Please do the steps below that are still open and reply "done" with the values they ask for (steps O1-O3, O5, O9, G1-G5, about 40 minutes in total). Until then I keep checking the game on the simulator, and nothing is uploaded."
     - Delete the template's three spec bullets.
     - List the steps as plain lines, with no "Please" and no question mark (check-report allows one request), each with its default:
       - **O1:** keep the Apple Developer Program active; accept the Program License Agreement and, in App Store Connect > Business, the Paid Apps Agreement with tax and banking. Default: no upload, and Premium is tested only on the simulator.
       - **O2:** declare EU trader status (Digital Services Act). Default: not needed for TestFlight; needed before the EU storefronts (publishing).
       - **O3:** create or confirm a team API key with the Admin role. Save it as `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8` with `chmod 600`, and put `ASC_KEY_ID`, `ASC_ISSUER_ID` and `APPLE_TEAM_ID` in `~/.zshenv`. Default: the keyless rehearsal in T11.
       - **O5:** install TestFlight on the iPhone with the Account Holder's Apple Account. Default: the build is processed but nobody installs it.
       - **O9 (A1, A3, A4):**
         - A1: the AdMob account and payments profile;
         - A3: the published European regulations (GDPR/TCF) message in English and German, with no IDFA explainer message (the app asks Apple's tracking prompt itself, O1);
         - A4: blocking controls (gambling, dating, alcohol, get-rich-quick) and maximum content rating PG (D8).
         Default: test builds show Google's test ads only.
       - **G1:** the app name. Suggested: "Line Siege" in all four languages, with the age-rating answer "cartoon or fantasy violence: infrequent or mild". Default: that name.
       - **G2:** the App Store Connect record: iOS, the name, bundle id `io.applander.linesiege` (fixed, O4), SKU `line-siege`. In the same visit, the internal tester group "Owner" with automatic distribution and the owner added. Default: no upload.
       - **G3:** the App Privacy questionnaire with the answers above, and the privacy-policy host and path and the support address for `game.config.ts`. Default: `example.com` and `support@example.com` stay, and every store gate refuses them (L14).
       - **G4/P1:** nothing to decide. Once O3 and G2 exist, Claude creates `io.applander.linesiege.premium` at the EUR 1.99 price point (O2) with Family Sharing off (O3), and the owner only checks it in App Store Connect. A "done" to this message is the owner's word for creating it.
       - **G5:** the AdMob app and three ad units (adaptive banner; interstitial; rewarded with amount 1 and type `perk`), with the four ids. Default: the placeholders stay, and test builds use Google's test ids.
     - Name the owner's own checks once, in a closing sentence: the play-test, the fa and ckb review and the sound previews follow with the TestFlight build, and never block.
  5. Run the check until it passes, then send the message as it is. Go on with T02 at once.
  6. Whenever values arrive (any time during this epic), put them into `apps/line-siege/game.config.ts`: the four AdMob ids under `ads.ids.ios` (G5), and `links.privacyPolicy` and `links.supportEmail` (G3).
     - Use one commit per owner step, for example `feat(line-siege): add the owner's admob ids` with spec 11 in the body.
     - The red is the `owner-placeholder` lines of `check-release-setup.mjs .`; the green is those lines gone.
     - Never type a stand-in value that only looks real.
- **Done when:**
  - `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/owner-request-e17-release-steps.md --kind request` prints `RESULT: PASS`.
  - The message is sent.
  - The steps still open are noted at the top of the epic's report draft, `reports/evidence-<YYYY-MM-DD>-e17-ios-release-pilot.md`.
- **Owner:** Every step listed above. Claude goes on with T02 to T10 meanwhile. T11 uploads only once O1, O3 and G2 are done and the owner says go; otherwise it runs the keyless rehearsal.

### E17-T02 · Release pipeline templates

- **Goal:** `npm run release:ios` has its target, and the store-artifact gate, the ASC client and the build-number rules are tested in Jest. One command can then take a clean `main` to a processed TestFlight build (Shell step 11, ios-release-testflight workflow step 2). `check-gate-wiring` loses its last not-yet-due SKIP line. `check-release-setup` is left with only the owner's placeholders.
- **Skills:** `ios-release-testflight`, `quality-gates`, `typescript-and-lint-rules`, `naming-conventions`, `unit-and-component-tests`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:** Copy each test from `skills/ios-release-testflight/templates/packages/tooling/src/` before its module. Give each module a typed stub (same exports, wrong values), so that the red run is an assertion diff, never `Cannot find module`. Run `npx jest packages/tooling/src/release packages/tooling/src/asc --ci --selectProjects unit` and keep the red lines. The tests:
  - `asc/asc-jwt.test.ts`: the ES256 header and a payload that expires in under 20 minutes. The signature verifies with the key, in IEEE P1363 encoding. The beta notes payloads address the build and patch `whatsNew`.
  - `release/build-number.test.ts`: `bumpBuildNumber` raises the single `buildNumber` line and refuses zero or two such lines. `resumableBuildNumber` reuses the number only while HEAD is its untagged bump commit.
  - `release/processing.test.ts`: finds altool's delivery UUID wherever it sits, reads `processingState`, and builds the filtered builds path.
  - `release/release-failures.test.ts`: quotes the matching log line. It does not mistake a bare 401 or 403 in a build log for Apple's answer. It stops on the owner placeholders with the pending steps (G3, G5), and its stop message names the step, the error line and the one action.
  - `release/release-options.test.ts`: the variant is required, test ads are refused in a store release, and `--resume` is checked. Missing ASC ids are named together with their owner step.
  - `release/release-preflight.test.ts` and `release/translation-review.test.ts`: the fa and ckb review sheet runs without `--release`, its pending texts become an owner step that is not blocking, and a missing sheet never stops the release (O6, L14).
  - `release/store-gate.test.ts`: a clean store build passes. The gate catches test code, StoreKit files, the sample ad id, a stale build number, `get-task-allow` and the `not-built.screen` placeholder. It pins the placeholder list with each value's owner step, and checks the app id `io.applander.*` and the tracking text in four languages.
  - `release/what-to-test.test.ts`: the header, the changes, the checks and the known issues. The purchase check appears only when purchase code changed, the history is capped, and the text stays within TestFlight's 4,000 characters.
  - Before the evidence:
    - `node skills/ios-release-testflight/scripts/check-release-setup.mjs .` fails `release-files` and `export-options`, besides the six owner-placeholder lines;
    - `node skills/quality-gates/scripts/check-gate-wiring.mjs .` still prints the release:ios SKIP line.
- **Build:**
  1. Copy `templates/packages/tooling/config/export-options-test.plist` and `export-options-store.plist` into `packages/tooling/config/`. Then `plutil -lint packages/tooling/config/export-options-test.plist packages/tooling/config/export-options-store.plist` must print OK twice. The only difference between them is `testFlightInternalTestingOnly`.
  2. Copy the release modules over their stubs into `packages/tooling/src/release/`: `release-ios.ts`, `release-preflight.ts`, `translation-review.ts`, `release-build.ts`, `release-upload.ts`, `release-runner.ts`, `release-options.ts`, `release-failures.ts`, `store-gate.ts`, `processing.ts`, `what-to-test.ts`, `build-number.ts` and `bump-build-number.ts`.
  3. Copy the ASC modules into `packages/tooling/src/asc/`: `asc-jwt.ts`, `asc-credentials.ts`, `asc-client.ts`, `find-app.ts`, `print-app-record.ts` and `beta-notes.ts`. `asc-credentials.ts` is the only file that may read `AuthKey_*.p8`.
  4. Do not copy the files the repo already has; check that each is byte-identical and leave it alone:
     - `diff skills/ios-release-testflight/templates/packages/tooling/src/clock/system-clock.ts packages/tooling/src/clock/system-clock.ts` (from E01, with `nowEpochSeconds`);
     - `diff skills/ios-release-testflight/templates/packages/tooling/src/ios/toolchain.ts packages/tooling/src/ios/toolchain.ts` (from E10);
     - `diff skills/ios-release-testflight/templates/packages/shell/src/config/app-variant.ts packages/shell/src/config/app-variant.ts`.
     Each must print nothing. A difference is a finding to report, never a reason to overwrite.
  5. Confirm the root script `"release:ios": "node packages/tooling/src/release/release-ios.ts"` (canonical since E01).
  6. Confirm the secrets setup that `check-release-setup` reads: `.gitignore` holds `*.p8`, `AuthKey_*`, `ApiKey_*`, `*.p12`, `*.mobileprovision`, `*.xcarchive` and `*.ipa`, and `.claude/settings.json` denies reading `~/.appstoreconnect/**`, `**/*.p8`, `**/AuthKey_*`, `**/*.p12` and `**/*.mobileprovision`.
     - Both have been there since E01.
     - If a deny rule is missing, stop and ask: `.claude/settings.json` is a gated path, and its rules come from quality-gates' `claude-settings.json` template.
  7. Run `npx prettier --check packages/tooling`, then commit `feat(tooling): add the testflight release pipeline and asc client`. Check the message first with `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged`.
- **Done when:**
  - `npx jest packages/tooling/src/release packages/tooling/src/asc --ci --selectProjects unit` passes.
  - `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with no SKIP line.
  - `node skills/ios-release-testflight/scripts/check-release-setup.mjs .` ends with exactly the six `owner-placeholder` lines, then `OWNER STEPS PENDING: G3, G5`, then `RESULT: FAIL (6 problems)`, and nothing else. This is the expected result until the owner's values arrive, never "fixed" by editing the gate. Once G3 and G5 are in, it prints `RESULT: PASS`.
  - `npm run release:ios` with no arguments prints `release:ios: --app and --variant are required.` with the usage line and exits 1, before building anything.
  - `node skills/typescript-and-lint-rules/scripts/check-source.mjs .` and `node skills/naming-conventions/scripts/check-file-names.mjs .` print `RESULT: PASS`.
  - `npm run -s check:fast` and `npm run verify` are green.

### E17-T03 · German and Sorani parity, part 1: S1 to S10

- **Goal:** Before a release, de and ckb join the done set of every frame (toybox-visual-parity rule 1, spec 15.1).
  - This task renders the de and ckb references from the design.
  - It captures the release candidate's first-run, Home, play, Levels, Daily and Statistics frames in all eight variants, and signs them off.
  - en and fa are captured again too: the sign-off reads every run against one reference root, and the release candidate must match in all four languages.
- **Skills:** `toybox-visual-parity`, `toybox-screens`, `rtl-and-direction`, `i18n-strings-and-catalogs`, `ios-simulator-build`, `unit-and-component-tests`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - Check the prerequisites first. These must already pass:
    - `npm run i18n:verify`;
    - `node skills/i18n-strings-and-catalogs/scripts/check-catalogs.mjs .` (de, fa and ckb hold every en key; `debug.*` stays English, L13);
    - `node skills/toybox-visual-parity/scripts/check-harness.mjs .`.
  - The red: once the references are rendered (Build step 3), `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S1 --screen S2 --screen S3 --screen S4 --screen S6 --screen S7 --screen S8 --screen S9 --screen S10 --langs en,fa,de,ckb --reference .parity/design` fails, because the de and ckb runs do not exist yet.
  - A defect the capture shows is fixed test first, in the screen's own component test. Render the screen with `renderWithShell(<Screen />, { language: 'de' })` (or `'ckb'`) and assert what broke, for example:
    - a sentence that carries `numberOfLines`;
    - a row that does not stack;
    - an icon that does not mirror;
    - Western digits in ckb.
    A wrong text gets a failing `check-catalogs` line instead. Then fix it, and capture that frame again in all eight variants.
- **Build:**
  1. Install the parity tooling into the repo, then run its self-test:
     - If `.parity/tooling/node_modules` is missing: `mkdir -p .parity/tooling && cp skills/toybox-visual-parity/scripts/package.json skills/toybox-visual-parity/scripts/package-lock.json .parity/tooling/ && npm ci --prefix .parity/tooling`.
     - `node skills/toybox-visual-parity/scripts/selftest.mjs --tooling .parity/tooling` must print `RESULT: PASS`.
  2. Prove the committed references are current: `node skills/toybox-visual-parity/scripts/shoot-design.mjs --check --tooling .parity/tooling`.
  3. Render all four languages: `node skills/toybox-visual-parity/scripts/shoot-design.mjs --out .parity/design --lang en,fa,de,ckb --tooling .parity/tooling`. It renders light and dark, every frame and every derived variant.
     - en and fa are rendered again on purpose, so that every run of the sign-off uses this one root. A run checked against another root fails `stale-report`.
     - Open `.parity/design/lineSiege/light-de/s4-home.png` and `.parity/design/lineSiege/dark-ckb/s4-home.png` to see that the design draws German and Sorani text.
  4. Build the release candidate and install it on this session's parity simulator:
     - `npm run build:ios:sim -- --app line-siege --variant test --ads off --sim e17-build`;
     - `node skills/toybox-visual-parity/scripts/setup-parity-sim.mjs --appearance light --name e07-parity-e17`, which prints the UDID;
     - `xcrun simctl install <parity udid> apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app`.
  5. Capture and check in the background (13 frames × 8 variants plus the scroll offsets of tall frames: about an hour): `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen S1 --screen S2 --screen S3 --screen S4 --screen S6 --screen S7 --screen S8 --screen S9 --screen S10 --langs en,fa,de,ckb --reference .parity/design --bundle-id io.applander.linesiege --name e07-parity-e17 --tooling .parity/tooling`.
     - S5 has no frame of its own. It is judged through `s6-pause` and `s7-*`, with the board masked (L6).
     - Fix each FAIL in the printed gate order (screen reached, scroll, missing, bounds, text, fill, border, text-ink, structure), as in Tests first. After a fix, rebuild, install again and rerun only that frame.
  6. Look, then record.
     - Read every `sheet.png`, `zoom-*.png` and `eye-*.png` of every run, and answer the seven eye checks.
     - Check German for compound words that wrap instead of being cut off, and for umlauts and ß.
     - Check Sorani for: ڕ ڵ ۆ ێ ە ڤ drawn in Vazirmatn with no clipped marks; Arabic-Indic digits; a mirrored layout; and boards that stay left to right.
     - Draft each ledger entry and add it to `parity/signoff.json`:
       - en and fa: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --draft <run-dir> --from-ledger` (the recorded differences carry over; the eye checks open again);
       - de and ckb: `--draft <run-dir>`.
  7. Waive only what iOS truly cannot draw: one element, one rule, its class, the reason, and the date the owner was told. `parity/waivers.json` is a gated path, so that commit carries a `Gate-Change:` trailer, and the report names the waiver.
  8. Commit the ledger as `test(repo): sign off s1 to s10 in german and sorani`. A fix commit is a `fix(shell)` with its spec lines, before the ledger commit. Shut the parity simulator down with `xcrun simctl shutdown <parity udid>` at the end of the session.
- **Design match:**
  - Frames:
    - `s1-splash`, `s2-language-choice`, `s3-consent-moment` (the mock-only `s3-google-s-form` is never captured or signed);
    - `s4-home`, `s4-home-premium`;
    - `s6-pause` (reference `s6-pause--no-music--no-hints`), `s7-result-win` (reference `s7-result-win--score`), `s7-result-lose`;
    - `s8-levels`, `s9-daily-challenge`, `s10-statistics`, `s10-statistics-empty`.
  - Variants: light-en, light-fa, dark-en, dark-fa, light-de, dark-de, light-ckb and dark-ckb, at every scroll offset `run-parity.mjs` plans.
  - Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S1 --screen S2 --screen S3 --screen S4 --screen S6 --screen S7 --screen S8 --screen S9 --screen S10 --langs en,fa,de,ckb --reference .parity/design`.
- **Done when:**
  - The sign-off command above prints `RESULT: PASS`, and its waiver and reference lines are copied into the report draft.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --screen S1 --screen S2 --screen S3 --screen S4 --screen S5 --screen S6 --screen S7 --screen S8 --screen S9 --screen S10` and `node skills/rtl-and-direction/scripts/check-rtl.mjs .` print `RESULT: PASS`.
  - `npm run -s check:fast` is green.

### E17-T04 · German and Sorani parity, part 2: S11 to S15 and the full sign-off

- **Goal:** The same as T03 for Settings and its pages, Premium, How to play, the dialogs and the Debug menu. Then the whole design is signed off in four languages at once: every screen of section 6 in en, de, fa and ckb, S15 included (spec 15.1, L12).
- **Skills:** `toybox-visual-parity`, `toybox-screens`, `rtl-and-direction`, `i18n-strings-and-catalogs`, `premium-purchase`, `ios-simulator-build`, `unit-and-component-tests`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - The red: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --all --langs en,fa,de,ckb --reference .parity/design` fails, because the de and ckb runs of S11 to S15 do not exist yet.
  - Defects are fixed test first, as in T03. On S12, a price is never typed: the parity fixture store supplies it, and `check-premium.mjs .` rule `typed-price` must stay green.
  - S15 draws English labels in every language (L13). Its numbers and dates follow the language's digits, so the right thing in ckb is Arabic-Indic digits and in de Western digits.
- **Build:**
  1. Use the same tooling, references, simulator and installed build as T03. If any app code changed since, rebuild and install first.
  2. Capture and check in the background (19 frames × 8 variants): `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen S11 --screen S11a --screen S11b --screen S11c --screen S11d --screen S12 --screen S13 --screen S14 --screen S15 --langs en,fa,de,ckb --reference .parity/design --bundle-id io.applander.linesiege --name e07-parity-e17 --tooling .parity/tooling`. S12 alone is 9 frames, so run it on its own if a command would outlast its timeout. Fix in gate order, as in T03.
  3. Look and record as in T03. Pay particular attention to:
     - the S11 rows in German (the longest labels);
     - the S11d licence texts;
     - the S12 state cards in ckb;
     - the S14 restart card in fa and ckb (one waiver is pre-listed, in fa).
  4. Run the full sign-off for every frame and record what it prints: the waivers with their classes, the intended reference changes, and the reference each frame used. They go into the report.
  5. Commit the ledger as `test(repo): sign off s11 to s15 in german and sorani`. Waiver changes carry a `Gate-Change:` trailer. Shut the parity simulator down by UDID.
- **Design match:**
  - Frames:
    - `s11-settings` (reference `s11-settings--no-music`), `s11a-language`, `s11b-about-and-credits`, `s11c-privacy-policy`, `s11d-licences`;
    - `s12-premium`, `s12-loading-price`, `s12-store-unavailable-offline`, `s12-purchase-in-progress`, `s12-pending-approval`, `s12-success`, `s12-error`, `s12-already-owned`, `s12-restore-results-toasts`;
    - `s13-how-to-play`;
    - `s14-reset-all-progress` (reference `s14-reset-all-progress--no-music`), `s14-restart-to-apply`, `s14-progress-restored`;
    - `s15-debug-menu`.
  - Variants: light-en, light-fa, dark-en, dark-fa, light-de, dark-de, light-ckb and dark-ckb, at every scroll offset.
  - Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen S11 --screen S11a --screen S11b --screen S11c --screen S11d --screen S12 --screen S13 --screen S14 --screen S15 --langs en,fa,de,ckb --reference .parity/design`, then `--all` with the same `--langs` and `--reference`.
- **Done when:**
  - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --all --langs en,fa,de,ckb --reference .parity/design` prints `RESULT: PASS`, with no frame left uncaptured.
  - `node skills/toybox-screens/scripts/check-screens.mjs . --all` and `node skills/toybox-visual-parity/scripts/check-harness.mjs .` print `RESULT: PASS`.
  - `node skills/premium-purchase/scripts/check-premium.mjs .` prints `RESULT: PASS`.
  - `npm run -s check:fast` is green.

### E17-T05 · Font test page and 200 % text

- **Goal:** Two checks from the spec that are due before each release.
  - Spec 7.6: the S15 font test page renders every letter and digit in every font, including the Sorani-only ڕ ڵ ۆ ێ ە ڤ. It is checked in screenshots before each release.
    - The template's samples carry the glyphs that break first. They do not hold every letter, and the ckb sample lacks ە and ڤ.
    - The spec owns this requirement, so the page is completed test first, and the report names the gap in the toybox-screens template.
  - Spec 8.11: text grows to 200 % and reflows instead of being cut off. The whole matrix is captured at the largest accessibility size and read by eye.
- **Skills:** `toybox-screens`, `accessibility`, `e2e-maestro`, `ios-simulator-build`, `i18n-strings-and-catalogs`, `golden-tests`, `toybox-visual-parity`, `pocket-arcade-product-spec`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - Add to `packages/shell/src/screens/debug/font-test-samples.test.ts` the case "every sample holds every letter and digit of its language (spec 7.6)". Each language's sample in `FONT_TEST_SAMPLES` must contain:
    - en: a to z, A to Z and 0 to 9;
    - de: the same, plus ä ö ü Ä Ö Ü ß;
    - fa: ا ب پ ت ث ج چ ح خ د ذ ر ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ه ی, plus آ, the hamza seats ئ أ ؤ ء, and ۰ to ۹;
    - ckb: ئ ا ب پ ت ج چ ح خ د ر ڕ ز ژ س ش ع غ ف ڤ ق ک گ ل ڵ م ن ه ە و ۆ ی ێ, and ٠ to ٩.
  - Run `npx jest packages/shell/src/screens/debug --ci --selectProjects unit`. It must fail, naming the missing letters (ckb at least ە and ڤ). The existing tests stay unchanged and green: the fix lengthens each sample's text and never changes the count of four samples.
  - The 200 % red: the first capture has no baselines for the large-text sets, so every row reports a missing baseline.
  - A 200 % defect (a cut-off label, an overlap, a row that does not stack) first becomes a failing component test, as accessibility's testing reference shows: render at a large font scale, then assert that the row stacks or that the sentence has no `numberOfLines`. Then fix it.
- **Build:**
  1. Extend each sample's text in `packages/shell/src/screens/debug/font-test-samples.ts` with its alphabet and digits, keeping the glyph phrases that are already there. The test must turn green.
     - Commit `fix(shell): show every letter and digit on the font test page`. The body quotes spec 7.6, printed with `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs 7.6`.
     - Debug texts are not on the fa and ckb review sheet (L13), and this page is test-only.
  2. Build and open the font page:
     - Build with `npm run build:ios:sim -- --app line-siege --variant test --ads off --sim e17-fonts`.
     - Write a throwaway flow, `reports/font-test/font-test.yaml`. `reports/` is gitignored, and the flow never goes under `packages/shell/e2e/`. The flow:
       - runs `../../packages/shell/e2e/subflows/debug-setup.yaml` with `QUERY: 'firstRun=0&lang=${LANG}&reduceMotion=1&screen=debug'` and `WAIT_FOR: 'debug.screen'`;
       - scrolls until `debug.font-test-row` is visible and taps it;
       - asserts `font-test.screen`;
       - takes one screenshot per screenful while it scrolls to the end, naming the files `reports/font-test/<LANG>-<theme>-<nn>`.
  3. Capture it on the font simulator's UDID with a free driver port, once each for en and fa in light, then again after `xcrun simctl ui <udid> appearance dark`: `tools/maestro/bin/maestro --device <udid> --driver-host-port <port> test -e APP_ID=io.applander.linesiege -e APP_SCHEME=e07-line-siege -e LANG=en reports/font-test/font-test.yaml`.
  4. Read every PNG with the Read tool. Check that:
     - each type role draws all four samples;
     - the Latin script is in Lilita One or Rubik, and Persian and Sorani are in Vazirmatn, with no system-font fallback;
     - there are no tofu boxes and no clipped mark above or below a line (madda, hamza, the v of ێ and ۆ);
     - the Persian and Arabic-Indic digits are shaped;
     - nothing runs off an edge.
     A clipped mark is a line-height defect: test first in the type role's test, then fix it in the theme.
  5. Capture the 200 % matrix (about 40 minutes): `npm run screenshots:ios -- --app line-siege --text-size accessibility-extra-extra-extra-large --sim e17-shots --update`.
     - Read every PNG of the 16 large-text sets as contact sheets. Check that nothing is cut off or overlapping, that rows stack, that fa and ckb read right to left with the boards still left to right, and that layout and colours are still the Toybox design.
     - Also read `reports/e2e/line-siege/large-text/` from E16's evidence run.
     - Commit the baselines as `test(line-siege): add the 200 % text screenshot baselines`, with `Gate-Change: 200 % text screenshot baselines, first capture (spec 8.11)`.
  6. Run the 200 % matrix again without `--update` to prove it is still and repeatable.
- **Design match:** The font test page has no design frame: the design draws no such page. So this task signs off no new frame.
  - A 200 % or font fix that changes a screen's code changes that screen. Capture its frames again with `run-parity.mjs --screen <id> --langs en,fa,de,ckb --reference .parity/design ...`, in light-en, light-fa, dark-en, dark-fa, light-de, dark-de, light-ckb and dark-ckb at every scroll offset.
  - Then `node skills/toybox-visual-parity/scripts/check-signoff.mjs --screen <id> --langs en,fa,de,ckb --reference .parity/design` must print `RESULT: PASS`.
- **Done when:**
  - `npx jest packages/shell/src/screens/debug --ci --selectProjects unit` passes, with the spec 7.6 case.
  - The font screenshots in en and fa, light and dark, are in `reports/font-test/`, and each was opened and read.
  - The rerun of `npm run screenshots:ios -- --app line-siege --text-size accessibility-extra-extra-extra-large --sim e17-shots` prints `176 screenshots, 0 changed`.
  - `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege --screenshots` prints `RESULT: PASS`.
  - These print `RESULT: PASS`:
    - `node skills/accessibility/scripts/check-a11y-code.mjs .`;
    - `node skills/accessibility/scripts/check-contrast.mjs .`;
    - `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD`.
  - `npm run -s check:fast` is green.

### E17-T06 · Ads release checks: SKAdNetwork list and the ads smoke test

- **Goal:** Ads are ready for a release (admob-ads workflow step 8). The SKAdNetwork list is Google's current one (rule 10). The six ads smoke flows pass by hand on an `ADS_MODE=test` build. Together they are spec 15.4's evidence that:
  - consent appears before the first ad in a simulated EU region;
  - Apple's tracking prompt comes after the consent step and before the first ad request;
  - declining it still shows ads;
  - pacing holds;
  - the rewarded continue leaves the board settled;
  - offline shows no ad and no message.
- **Skills:** `admob-ads`, `ios-simulator-build`, `e2e-maestro`, `board-rendering-skia`, `troubleshooting-playbook`, `unit-and-component-tests`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:**
  - `node skills/admob-ads/scripts/check-ads.mjs .` and `node skills/admob-ads/scripts/check-ad-behaviour.mjs .` must print `RESULT: PASS` before any run. They prove the policy, the consent order (L10) and that no run is stranded (L11), on the real modules.
  - `node packages/tooling/src/ads/refresh-skadnetwork.ts --check` exits 1 when the committed list is stale: that is the red. Exit 0 means the list is current.
  - The six flows are the device tests. A failure first becomes a failing Jest test in the module that owns the cause, then gets its fix there. Never edit a flow to make it pass. The owning modules:
    - `packages/shell/src/app/consent-moment.test.tsx` and `services/ads/ad-gate.test.ts` for the consent and tracking order;
    - `perk-offer.test.ts` for the continue offer;
    - board-rendering-skia's `board-clock-state` test for a board that does not settle.
- **Build:**
  1. Check the SKAdNetwork list with `node packages/tooling/src/ads/refresh-skadnetwork.ts --check`. If the list is stale:
     - Run it without `--check`. It rewrites `packages/shell/src/config/skadnetwork-ids.ts` from Google's page, and refuses fewer than 40 ids. Never edit the list by hand.
     - `check-ads.mjs .` rule `skadnetwork` must pass.
     - Commit `chore(shell): refresh the skadnetwork list from google`.
  2. Build with test ads: `npm run build:ios:sim -- --app line-siege --variant test --ads test --sim ads-smoke`. Then `node skills/ios-simulator-build/scripts/check-sim-app.mjs --app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app --variant test --ads test --game line-siege` must print `RESULT: PASS`.
  3. Get ready to run Maestro:
     - read the UDID from `xcrun simctl list devices | grep e07-ads-smoke`;
     - take a free port from `node -e "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})"`;
     - set `JAVA_HOME` to Java 17, and set `MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true MAESTRO_DISABLE_UPDATE_CHECK=true` on every Maestro call.
  4. Fresh install 1. Google's and Apple's answers are empty, and the app is started by `simctl`, because Maestro's `launchApp` would grant the tracking answer:
     - `xcrun simctl uninstall <udid> io.applander.linesiege`;
     - `xcrun simctl install <udid> apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app`;
     - `xcrun simctl privacy <udid> reset all io.applander.linesiege`;
     - `xcrun simctl launch <udid> io.applander.linesiege`.
     Then run flow 1: `tools/maestro/bin/maestro --device <udid> --driver-host-port <port> test -e APP_ID=io.applander.linesiege -e APP_SCHEME=e07-line-siege --test-output-dir reports/ads-smoke/01 packages/shell/e2e/ads-smoke/01-consent-eea.yaml`. Flow 1 must show S3, then Google's "Consent" form, then Apple's prompt; "Ask App Not to Track"; then the test banner.
  5. On the same install:
     - `xcrun simctl terminate <udid> io.applander.linesiege` and `xcrun simctl launch <udid> io.applander.linesiege`, then `02-relaunch.yaml`: no prompt comes back, and the banner loads;
     - `03-next-interstitial.yaml`: no ad for the first two Nexts, the test interstitial on the third, and level 4 settled;
     - `04-rewarded-continue.yaml`: "Reward granted", then `game.board-frame` reads `settled: true`;
     - `05-offline.yaml`: no banner, no continue, the lose result at once and no message.
     Use the same command with each flow's own `--test-output-dir reports/ads-smoke/<nn>`.
  6. Fresh install 2 (uninstall, install, privacy reset, launch, as in step 4), then `06-geo-other.yaml`: Google's GDPR form never opens. On Google's sample app, S3 and Google's IDFA explainer come before Apple's prompt; the prompt carries the app's usage text; the banner loads.
  7. Open the screenshots Maestro wrote in `reports/ads-smoke/`. Write down, per flow, what showed in which order; the reports cite these lines.
  8. Shut the simulator down with `xcrun simctl shutdown <udid>`.
- **Done when:**
  - `node packages/tooling/src/ads/refresh-skadnetwork.ts --check` exits 0.
  - All six flows passed: 01 to 05 on one install, 06 on a fresh install. Their output and screenshots are in `reports/ads-smoke/`.
  - These print `RESULT: PASS`: `node skills/admob-ads/scripts/check-ads.mjs .`, `node skills/admob-ads/scripts/check-ad-behaviour.mjs .` and `node skills/e2e-maestro/scripts/check-flows.mjs .`.
  - `npm run -s check:fast` is green.

### E17-T07 · StoreKit harness, Tier 2, in release-day order

- **Goal:** Premium's buy, refund, pending, approval, restore, failure and offline states are proven against Apple's StoreKit test store, on the real app (spec 15.5, 8.9; premium-purchase workflow step 7). The harness runs in the release-day order, so that no harness target, `.storekit` file or debug entitlement can reach a later build: the E2E evidence run, the harness, delete its simulator, then a clean prebuild.
  - Two states are not tested here. A player-cancelled sheet and restore after a reinstall cannot run in Tier 2, because dialogs are disabled and uninstalling clears the test transactions.
  - Tier 1 tests cover both, and the owner's Tier 3 run on TestFlight covers them on a real phone (G6, T12).
- **Skills:** `premium-purchase`, `e2e-maestro`, `ios-simulator-build`, `unit-and-component-tests`, `troubleshooting-playbook`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:** Copy each test from `skills/premium-purchase/templates/packages/tooling/src/` before its module, with a typed stub, then run `npx jest packages/tooling/src/storekit packages/tooling/src/asc --ci --selectProjects unit` and keep the red lines:
  - `storekit/busy-note.test.ts`: says nothing while the load average is at most twice the cores, and on a busy Mac names the load, the cores and the threshold for a rerun;
  - `asc/premium-iap-payloads.test.ts`:
    - one non-consumable Premium with Family Sharing off (O3);
    - price points ranked by their distance to the EUR 1.99 target (O2);
    - the availability body and the review-screenshot bodies.
  - The shared files must already be identical. `diff skills/premium-purchase/templates/packages/tooling/src/e2e/maestro-args.ts packages/tooling/src/e2e/maestro-args.ts` and `diff skills/premium-purchase/templates/packages/shell/e2e/subflows/debug-setup.yaml packages/shell/e2e/subflows/debug-setup.yaml` print nothing.
- **Build:**
  1. Copy `templates/packages/tooling/src/storekit/` into `packages/tooling/src/storekit/`: `Premium.storekit.template` (1.99, `familyShareable: false`, storefront DEU), `storekit-harness.entitlements`, `ArmTests.swift`, `add-harness.rb`, `storekit-harness.ts` and `busy-note.ts`.
  2. Copy `create-premium-iap.ts` and `premium-iap-payloads.ts` into `packages/tooling/src/asc/`. Keep T02's `asc-client.ts`, `asc-credentials.ts` and `asc-jwt.ts`: `diff` shows they are the same bytes as premium-purchase's copies.
  3. Copy the seven Tier 2 flows into `packages/shell/e2e/storekit/`: `01-buy.yaml`, `02-refund-relaunch.yaml`, `03-ask-to-buy.yaml`, `04-approval-relaunch.yaml`, `05-restore.yaml`, `06-failure.yaml` and `07-store-unavailable.yaml`. They sit outside `e2e/flows/`, so `e2e:ios` never runs them against an unarmed build.
  4. Make the tests green, run the checks in the Done list, then commit:
     - `feat(tooling): add the storekit harness and the premium product tool`;
     - `test(shell): add the storekit tier 2 flows`.
  5. Release-day step 1, the E2E evidence run: `npm run e2e:ios -- --app line-siege --sim e17-e2e`, then `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege`.
  6. Release-day step 2, the harness on its own throwaway simulator:
     - Create and boot it: `xcrun simctl create e07-e17-storekit "iPhone 17 Pro" com.apple.CoreSimulator.SimRuntime.iOS-26-5` (it prints the UDID), then `xcrun simctl boot <udid>`.
     - Check `sysctl -n vm.loadavg` against `sysctl -n hw.ncpu`. Start only while the 1-minute load is below twice the cores.
     - Run `node packages/tooling/src/storekit/storekit-harness.ts --app line-siege --device <udid>`.
     - It must end with `storekit: 0 of 7 scenario(s) failed` and exit 0.
  7. Release-day step 3: `xcrun simctl delete <udid>`. The armed test store persists per simulator.
  8. Release-day step 4: `(cd apps/line-siege && npx expo prebuild --platform ios --clean)`. Then `find apps/line-siege/ios -name '*.storekit' | wc -l` prints 0, and `grep -c StoreKitHarness apps/line-siege/ios/LineSiege.xcodeproj/project.pbxproj` prints 0.
  9. If a flow fails:
     - Read the run's log with `node skills/troubleshooting-playbook/scripts/find-fix.mjs --log <log>` and premium-purchase's "Tier 2 gotchas".
     - A relaunch flow (02, 04) keeps its 60 s wait, which rule `harness-relaunch-wait` holds; never shorten it.
     - A busy Mac means a rerun on a fresh simulator once the load drops.
     - A state that is still wrong after 60 s is an app bug. Write a failing Tier 1 test first, in `premium-service.test.ts`, `premium-reducer.test.ts` or `connect-premium-reloads.test.ts`, then fix it, then rerun the whole order.
- **Done when:**
  - `npx jest packages/tooling/src/storekit packages/tooling/src/asc --ci --selectProjects unit` passes.
  - These print `RESULT: PASS`:
    - `node skills/premium-purchase/scripts/check-premium.mjs .`: `price-target`, `family-sharing`, `harness-isolation`, `harness-maestro` and `harness-relaunch-wait` now read real files;
    - `node skills/premium-purchase/scripts/check-premium-behaviour.mjs .`;
    - `node skills/e2e-maestro/scripts/check-flows.mjs .`;
    - `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege`.
  - The harness printed `storekit: 0 of 7 scenario(s) failed`. `xcrun simctl list devices | grep -c e07-e17-storekit` prints 0, and the clean prebuild has no harness files (Build step 8).
  - `npm run -s check:fast` is green.

### E17-T08 · Release audits, budgets and mutation testing

- **Goal:** Show, on the clean prebuild of T07, the things players cannot see.
  - N3 holds: only the ads and store SDKs can go online (15.3).
  - The privacy manifest and the App Privacy answers match the SDKs (4.2).
  - No key or test artefact can ship.
  - The app is within its performance budgets.
  - The tests would notice wrong logic: a mutation score of at least 75 %.
  The owner's device perf report and VoiceOver pass need the TestFlight build, so T12 asks for them.
- **Skills:** `privacy-and-network-audit`, `performance-budgets`, `unit-and-component-tests`, `troubleshooting-playbook`, `golden-tests`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:** The audits are this task's tests: run each one and read its output before changing anything.
  - A finding becomes a failing test in the layer that owns it, then its fix there: a Jest test for our code, or the audit's FAIL line for a manifest reason.
  - A NEW third-party network finding, or a pod outside the allowlist, is the owner's call, never a baseline edit. See **Owner**.
  - For mutation testing, each survivor is the red. Add the boundary example that tells the mutant apart: it passes on the real code and fails on the mutant's logic. Then rerun Stryker until the survivor is killed.
- **Build:**
  1. `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .`
  2. Against T07's clean prebuild: `npm run audit:privacy -- --app line-siege`, then `node skills/privacy-and-network-audit/scripts/audit-privacy-manifest.mjs .`.
     - Compare the App Privacy input it prints with the answers sent in T01: Device ID is collected, linked and used for tracking by Google Mobile Ads, and only Google's pods declare tracking.
     - If they differ, send the corrected answers to the owner (G3).
  3. `npm run audit:network` must print `audit:network: 0 failure(s)` with no `SKIPPED pods/config layers` line. Then run `npm run audit:licenses`.
  4. Run `node skills/privacy-and-network-audit/scripts/audit-bundle.mjs --export dist-audit/line-siege .` on the store export that `audit:network` wrote.
  5. Check key hygiene:
     - `git ls-files | grep -E '\.p8$|AuthKey_|\.p12$|\.mobileprovision$|\.ipa$' | wc -l` prints 0;
     - `check-release-setup`'s `key-read`, `token-printed` and `key-material` lines stay quiet.
  6. Check the budgets:
     - `node skills/performance-budgets/scripts/check-budgets.mjs .` and `node skills/performance-budgets/scripts/check-perf-code.mjs .`.
     - The simulator perf log of T07's run: `node skills/performance-budgets/scripts/check-perf-report.mjs reports/perf/sim-perf-log.json --root . --sim-baseline <medianMs>`, where `<medianMs>` is read from `perf-baselines/cold-start-sim-line-siege.json`.
     - The bundle: `(cd apps/line-siege && APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=off npx expo export --platform ios --no-bytecode --output-dir ../../reports/perf/export-ios)`, then `node skills/performance-budgets/scripts/check-bundle-size.mjs reports/perf/export-ios --root . --baseline perf-baselines/bundle-ios-line-siege.json`.
     - If that baseline file does not exist yet, add `--write-baseline` once. Commit it as `chore(repo): record the ios bundle size baseline`, with `Gate-Change: first ios bundle size baseline for line-siege (release budget)`, because `perf-baselines/**` is gated.
  7. `node skills/troubleshooting-playbook/scripts/check-known-pitfalls.mjs .`
  8. Run mutation testing over every finished rules, policy and reducer module, in the background:
     - `npm run test:mutation` (`stryker.config.json`'s `mutate` set: game-kit, the rules and levels of every app, the save service, every `*-policy.ts` and `*-reducer.ts`);
     - then `node skills/unit-and-component-tests/scripts/check-mutation-report.mjs reports/stryker/mutation.json`.
     Kill survivors as in Tests first, in commits such as `test(shell): kill the ad policy boundary survivors`. Never `// Stryker disable` and never lower `break`. An equivalent mutant is accepted only with `--allow <id>` and a sentence in the report. List what remains with `--all` for the report.
- **Done when:**
  - These print `RESULT: PASS`:
    - `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .`;
    - `node skills/privacy-and-network-audit/scripts/audit-privacy-manifest.mjs .`;
    - `node skills/privacy-and-network-audit/scripts/audit-bundle.mjs --export dist-audit/line-siege .`.
  - `npm run audit:network` prints `audit:network: 0 failure(s)` with every layer run, and `npm run audit:licenses` passes.
  - These print `RESULT: PASS`: `check-budgets.mjs .`, `check-perf-code.mjs .`, `check-perf-report.mjs reports/perf/sim-perf-log.json --root . --sim-baseline <medianMs>`, `check-bundle-size.mjs ...` and `check-known-pitfalls.mjs .`.
  - `node skills/unit-and-component-tests/scripts/check-mutation-report.mjs reports/stryker/mutation.json` prints `RESULT: PASS`, with a score of at least 75 %.
  - `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD` prints `RESULT: PASS`.
  - `npm run -s check:fast` is green.
- **Owner:** Only if `audit:network` reports a NEW third-party finding, a pod outside `Google-Mobile-Ads-SDK`, `GoogleUserMessagingPlatform` and `openiap`, or a tracking pod other than Google's.
  - A baseline or allowlist change is the owner's decision (privacy-and-network-audit rule 3), and a tracking pod means an analytics SDK slipped in and must go.
  - Send one request in git-commits-and-reporting's form, checked with `--kind request`, and go on with steps 6 to 8 meanwhile.

### E17-T09 · Prove the pilot complete (Shell step 12) and map the exit test

- **Goal:** Shell step 12's done-when holds, so game 2 can start from `npm run new-game` (15.8, section 12). Every item of the exit test, 15.1 to 15.8, has its evidence named, ready for the report.
- **Skills:** `navigation-and-routing`, `new-game-scaffold`, `ios-release-testflight`, `e2e-maestro`, `save-persistence-and-migrations`, `level-generation-and-solvers`, `game-balance-and-bots`, `admob-ads`, `premium-purchase`, `ios-simulator-build`, `pocket-arcade-product-spec`, `tdd-workflow`.
- **Tests first:** No new test file: Shell step 12's checks are this task's tests. A red check becomes a failing test in the layer that owns it, before its fix. Two results are expected and are no failures:
  - `check-game-app --stage complete` and `check-release-setup` end with the owner's placeholders until G3 and G5;
  - `check-balance --release` prints an `OWNER STEP (not blocking)` line while the bands are still `"proposed"`.
- **Build:**
  1. Run Shell step 12's checks:
     - `test ! -e shell-slice.json`;
     - `node skills/navigation-and-routing/scripts/check-navigation.mjs . --complete`;
     - `node skills/new-game-scaffold/scripts/check-game-app.mjs . --app line-siege --stage complete`;
     - `node skills/ios-release-testflight/scripts/check-release-setup.mjs .`;
     - `npm run verify`.
  2. Check that game 2 can start:
     - `npm run new-game -- --help` prints the generator's usage.
     - The dry run `npm run new-game -- --app flock-tilt --hints solver --continue once` (no `--write`) plans 19 new files for `io.applander.flocktilt` and prints `RESULT: PASS`. Afterwards `git status --porcelain apps` prints nothing.
  3. Gather fresh evidence on the release candidate, for the items that E16's runs do not cover on this commit:
     - Build with `npm run build:ios:sim -- --app line-siege --variant test --ads off --sim e17-build`.
     - Run the kill test: `node skills/save-persistence-and-migrations/scripts/kill-test.mjs --create --app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app --bundle-id io.applander.linesiege --game-id line-siege --repo .`.
     - Run `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .` and `npx jest packages/shell/src/services/save test/integration/save --ci --selectProjects unit`. They cover the frozen-fixture migrations and recovery from the backup slot.
     - Run `node skills/level-generation-and-solvers/scripts/check-levels.mjs . --game line-siege` and `node skills/game-balance-and-bots/scripts/check-balance.mjs . --game line-siege --release`.
     - Run the normal screenshot matrix: `npm run screenshots:ios -- --app line-siege --sim e17-shots`, then `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege --screenshots`.
  4. Write the exit-test map into the report draft as a "Details" block named "Exit test (spec 15)". Print the spec items with `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs 15`. Name the file behind each line:
     - **15.1:**
       - `check-signoff.mjs --all --langs en,fa,de,ckb --reference .parity/design` (T04, `parity/signoff.json`);
       - the matrix, `176 screenshots, 0 changed` (`reports/screenshots/summary.json`);
       - the 200 % sets (T05);
       - S15 included (L12).
     - **15.2:** `05-airplane-mode-run`, `01-first-launch`, `02-core-journey-offline` and `03-language-switch` passed (`reports/e2e/line-siege/junit.xml`, T07).
     - **15.3:**
       - `audit:network` with 0 failures, plus `audit-repo` and `audit-bundle` (T08);
       - an empty `reports/e2e/line-siege/network.txt`.
     - **15.4:**
       - the ad policy and perk-offer tests and `check-ad-behaviour` (frequency, Premium, stranded runs);
       - the ads smoke flows 01 to 06 (`reports/ads-smoke/`): consent before the first ad in the EEA, Apple's prompt after it and before the first ad request, and a declined prompt still showing ads;
       - journey `13-endless` (an endless loss with ads off and no Premium shows the endless result).
     - **15.5:**
       - Tier 1 (`check-premium-behaviour`);
       - Tier 2 (`storekit: 0 of 7 scenario(s) failed`, T07);
       - Tier 3, the owner's TestFlight purchase test (G6, not blocking).
     - **15.6:**
       - the kill test above;
       - the save Jest run and `check-save-layer` (migration and backup).
     - **15.7:**
       - `check-levels`: every shipped level solved;
       - `check-balance --release`: the difficulty curve and the bots (`reports/sim/line-siege.json`);
       - the owner's play-test (G6, not blocking).
     - **15.8:**
       - `npm run new-game -- --help` and the flock-tilt dry run;
       - new-game-scaffold's new-game checklist.
  5. Commit only if a fix was needed (test first).
- **Done when:**
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs . --complete` prints `RESULT: PASS`.
  - `node skills/new-game-scaffold/scripts/check-game-app.mjs . --app line-siege --stage complete` prints `RESULT: PASS`. Until G3 and G5 it ends with exactly the six `owner-placeholder` lines, then `OWNER STEPS PENDING: G3, G5`, then `RESULT: FAIL (6 problems)`, and nothing else; the app id is already the fixed `io.applander.linesiege`.
  - `npm run verify` ends with `verify: 11 steps passed, 0 skipped` and prints no SKIP line.
  - `npm run new-game -- --help` prints the usage, and the flock-tilt dry run prints `RESULT: PASS` with nothing written.
  - The kill test, `check-save-layer`, `check-levels` and `check-balance --release` print `RESULT: PASS`. The `OWNER STEP (not blocking)` line of `check-balance` is copied into the report.
  - `check-e2e-report.mjs . --app line-siege --screenshots` prints `RESULT: PASS` after the matrix printed `176 screenshots, 0 changed`.
  - The "Exit test (spec 15)" block names a file for each of 15.1 to 15.8.

### E17-T10 · Simplify, code review, re-run the gates and merge

- **Goal:** The branch is simplified and reviewed, every gate is green again, and the epic's slice report is written. Then it is merged into `main`, which `release:ios` requires.
- **Skills:** `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`, `golden-tests`, `pocket-arcade-product-spec`, `toybox-visual-parity`, `premium-purchase`, `ios-release-testflight`.
- **Tests first:** Every confirmed finding gets a failing test that shows the problem, before its fix:
  - a Jest test next to the release, ASC or storekit module for a tooling finding;
  - the screen's component test for a screen finding.
  Copied template files stay byte-identical to their skill templates. A `/simplify` or `/code-review` suggestion about a copied template is not applied: it goes into the report for the skill library. The exception is a confirmed bug, which is fixed test first and reported as a template defect.
- **Build:** Follow "Close the epic" below, steps 1 to 5.
  - Re-run every task's "Done when". The exceptions: the parity runs (T03, T04), the matrices (T05, T09) and the harness (T07) are rerun only when a commit after them changed their code. For a screen that means `packages/shell/src/screens`, `ui`, `theme` or `i18n`; for the harness, the Premium or purchase code. For a changed screen, rerun its frames in all eight variants against `.parity/design`.
  - Copy git-commits-and-reporting's `templates/evidence-slice.md` to `reports/evidence-<YYYY-MM-DD>-e17-ios-release-pilot.md` and fill it only from `reports/` files. It must cover:
    - the outcome in players' words: Line Siege is checked in all four languages, its ads and Premium were tested the way Apple and Google test them, and it is ready for TestFlight;
    - the Checks lines, including a "Design match" line: 32 frames in en, de, fa and ckb, light and dark, with the waiver count, from `parity/signoff.json`;
    - "Please look at": the dark ckb sheet of `s4-home`, a 200 % contact sheet, and the font page in fa;
    - the "Exit test (spec 15)" block from T09, and the template gap of T05 under Details;
    - "Owner steps (not blocking)": fa and ckb, the play-test, the sound previews, and G3 and G5 with the steps still open from T01;
    - "Not tested or not verified": the upload (T11), the real purchase sheet, restore after reinstall, VoiceOver, and device performance.
- **Done when:**
  - Every "Done when" above passes again after the fixes.
  - These print `RESULT: PASS`:
    - `node skills/tdd-workflow/scripts/check-tests.mjs .`;
    - `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD`;
    - `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD`;
    - `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD`;
    - `node skills/quality-gates/scripts/check-bypasses.mjs .`;
    - `node skills/pocket-arcade-product-spec/scripts/check-spec-refs.mjs .`;
    - `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e17-ios-release-pilot.md --kind slice`.
  - The branch is merged into `main` and deleted. `git status --porcelain` on `main` prints nothing.

### E17-T11 · Release Line Siege to TestFlight

- **Goal:** The owner can install Line Siege from TestFlight. The test-variant build goes to internal testers only (`testFlightInternalTestingOnly: true`), processed `VALID`, and is traceable to its commit through the tag `line-siege/v1.0.0+<n>`.
  - A test build carries Google's test ads and no links check, so it needs neither G3 nor G5.
  - It needs the owner's go, the agreements (O1), the team key (O3) and the app record with its tester group (G2).
  - Without those, the keyless store rehearsal proves everything but the signature, and the pilot is handed over with a slice report.
- **Skills:** `ios-release-testflight`, `premium-purchase`, `privacy-and-network-audit`, `git-commits-and-reporting`, `troubleshooting-playbook`, `tdd-workflow`.
- **Tests first:** The release pipeline's Jest tests (T02) and the store-artifact gate are this task's tests.
  - A gate or audit failure in the pipeline is a code finding. It gets a failing test first, on a re-created branch, as the release rules above say.
  - A release stop (signing, agreement, 401/403, record, `INVALID`) is a human step, never a code change.
- **Build:**
  1. On `main`: `git switch main && git pull`, then `git status --porcelain` prints nothing.
  2. Choose the path.
     - **Path A** needs all of these: the owner's go in this session; `stat -f '%Sp' "$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"` prints `-rw-------`; `security show-keychain-info ~/Library/Keychains/login.keychain-db` exits 0; and `node packages/tooling/src/asc/print-app-record.ts --app line-siege` prints `{"id","name"}`.
     - Otherwise it is **Path B**. An exit 2 from `print-app-record` means G2 is missing.
  3. **Path A, the release.**
     1. Create Premium: `node packages/tooling/src/asc/create-premium-iap.ts io.applander.linesiege`, the EUR 1.99 point with Family Sharing off. Re-running it is safe. If it lists the nearest points because EUR 1.99 is gone, stop and ask.
     2. Release: `npm run release:ios -- --app line-siege --variant test --notes "Play the tutorial, levels 1 to 10 and today's daily" --known-issue "Ads are Google's test ads in this test build"`. It runs, in order:
        - the preflight and `npm run verify`;
        - the bump commit `chore(line-siege): build <n>`;
        - a clean prebuild with `audit:privacy` and `audit:network`;
        - the archive with API-key signing, then the export with `export-options-test.plist`;
        - `store-gate.ts`, then `altool --validate-app`, then the upload;
        - the wait for `VALID`, What to Test, and the build tag.
     3. Check the gate independently: `node skills/ios-release-testflight/scripts/check-store-artifact.mjs --ipa apps/line-siege/build/export/LineSiege.ipa --variant test --ads test --version 1.0.0 --build <n> --game line-siege .`.
     4. Check the binary half: `node skills/privacy-and-network-audit/scripts/audit-app-bundle.mjs --app apps/line-siege/build/ipa-check/Payload/LineSiege.app --variant test --ads-mode test --game line-siege`.
     5. Check the tags: `node skills/git-commits-and-reporting/scripts/check-tags.mjs .`.
     6. Write the release report. Copy `templates/evidence-release.md` to `reports/evidence-<YYYY-MM-DD>-line-siege-release-1.0.0.md` and fill it from `reports/`:
        - Coverage from `reports/coverage/coverage-summary.json`;
        - Mutation from `reports/stryker/mutation.html`;
        - Bots from `reports/sim/line-siege.json`;
        - End-to-end from `reports/e2e/line-siege/junit.xml`;
        - Network from `reports/e2e/line-siege/network.txt`;
        - Screenshots from `reports/screenshots/index.html`;
        - Design match from `parity/signoff.json`;
        - the exit-test block from T10's report.
        The one request is R1, "ship" or "don't ship".
     7. Push only with the owner's word in this session: `git push origin main` (the build commit), then `git push origin line-siege/v1.0.0+<n>`.
  4. **On a stop**, follow `release:ios`'s printed message.
     - Never retry `errSecInternalComponent` (O8), an agreement error (R4), a missing record (G2), 401/403 (O3) or `INVALID` processing.
     - Send the owner its stop text from `templates/release-stop.md`, checked with `check-report.mjs <file> --kind request`.
     - When the owner confirms, rerun as the `Resume:` line says: `--resume build` keeps the same number, and `--resume processing` uploads nothing.
  5. **Path B, the keyless rehearsal.** It uploads nothing and is never release evidence. Run it in one shell, so that the variables reach the prebuild, the audits and `xcodebuild` alike:
     - `export DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=off EXPO_NO_TELEMETRY=1 CI=1`;
     - `(cd apps/line-siege && npx expo prebuild --platform ios --clean)`;
     - `npm run audit:privacy -- --app line-siege` and `npm run audit:network`;
     - `mkdir -p apps/line-siege/build/logs && (cd apps/line-siege && xcodebuild -workspace ios/LineSiege.xcworkspace -scheme LineSiege -configuration Release -destination generic/platform=iOS -archivePath build/LineSiege.xcarchive -derivedDataPath build/dd-device CODE_SIGNING_ALLOWED=NO archive > build/logs/rehearsal-archive.log 2>&1)`.

     Then run both gates with `--unsigned`. `--version` and `--build` are the `version` and `buildNumber` in `game.config.ts`: `1.0.0` and `1` before any release, because a rehearsal never bumps the number.
     - `node skills/ios-release-testflight/scripts/check-store-artifact.mjs --app apps/line-siege/build/LineSiege.xcarchive/Products/Applications/LineSiege.app --variant store --ads off --version 1.0.0 --build 1 --game line-siege --unsigned .`;
     - `node skills/privacy-and-network-audit/scripts/audit-app-bundle.mjs --app apps/line-siege/build/LineSiege.xcarchive/Products/Applications/LineSiege.app --variant store --ads-mode off --game line-siege --unsigned`.

     Expected before G3 and G5:
     - `REHEARSAL: not a release gate` first;
     - one `SKIP ... [get-task-allow]` line;
     - the six `owner-placeholder` lines: two links from the archive, and four AdMob ids from `game.config.ts`;
     - `OWNER STEPS PENDING: G3, G5`;
     - `RESULT: FAIL (6 problems)`;
     - and nothing else.
     With the owner's values in, both print `RESULT: PASS` with the one SKIP line. Any other FAIL line is a real problem: fix it test first.

     Finally, turn T10's report into the hand-over:
     - put the rehearsal and the owner-placeholder results under "Not tested or not verified";
     - put O3, G2, G3 and G5 (whichever are still open) under "Owner steps (not blocking)";
     - check it with `--kind slice`.
- **Done when:**
  - **Path A:**
    - `release:ios` printed `processed (VALID)`, and `git tag -l 'line-siege/v1.0.0+*'` lists the build tag.
    - `check-store-artifact.mjs --ipa ... --variant test --ads test ...`, `audit-app-bundle.mjs ... --variant test --ads-mode test --game line-siege` and `check-tags.mjs .` print `RESULT: PASS`.
    - `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-line-siege-release-1.0.0.md --kind release` prints `RESULT: PASS`.
    - No key, token or signing file appears in the repo, the logs or the report.
  - **Path B:**
    - Both rehearsal gates printed exactly the expected lines above.
    - `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e17-ios-release-pilot.md --kind slice` prints `RESULT: PASS`, and no line outside "Not tested or not verified", "Details" and "Owner steps (not blocking)" cites the rehearsal.
- **Owner:**
  - The go for this upload, plus O1, O3 and G2 (asked in T01). Creating the Premium product also needs the owner's word, and the owner's "done" to T01's G4 line already gives it. Claude runs Path B meanwhile.
  - The word to push `main` and the build tag.
  - Any release stop.

### E17-T12 · List the owner's own checks and hand over

- **Goal:** The owner has one report with everything that only they can do, each with what it needs and what happens with the answer. Nothing waits for any of it (O6, L14): the work and the release went on without them, and their answers become test-first fixes or recorded approvals whenever they come.
- **Skills:** `git-commits-and-reporting`, `i18n-strings-and-catalogs`, `game-balance-and-bots`, `game-audio-and-haptics`, `accessibility`, `performance-budgets`, `premium-purchase`, `ios-release-testflight`.
- **Tests first:** No code. The report check is the test. Its rule `owner-steps-listed` fails a block that leaves out the fa and ckb review, the play-test or the sound previews, or calls any of them blocking.
- **Build:**
  1. Write the fa and ckb review sheets: `node packages/tooling/src/i18n/review-sheet.ts`. It writes `reports/i18n/review-fa.csv` and `reports/i18n/review-ckb.csv`, prints the count per language and an `OWNER STEP (not blocking)` line, and always exits 0. Copy that line (G7, R3).
  2. Copy the balance line from T09: `check-balance.mjs . --game line-siege --release` prints the bands as "proposed" until the owner's play-test.
  3. Render the sound previews: `node skills/game-audio-and-haptics/scripts/check-sound-banks.mjs . --game line-siege --wav-dir reports/sfx` writes `reports/sfx/line-siege/*.wav` and `reports/sfx/shell/*.wav` (G9).
  4. Fill the report's "Owner steps (not blocking)" block. Use the release report from Path A, or the hand-over slice report from Path B. One line each, with what is pending:
     - the play-test on TestFlight build `<n>`, with the Tier 3 purchase test: buy, then delete, reinstall and Restore, then start a purchase and cancel it (G6); it includes playing one-handed in portrait (spec 8.11) and, if an iPad is at hand, a few moves in landscape (spec S5: a centred board);
     - approve the balance bands, or say what feels off (the `check-balance` line);
     - the fa and ckb texts: the counts and the two CSV paths (G7, R3);
     - listen to the previews in `reports/sfx/line-siege/` and feel the haptics on the phone (G9);
     - check Premium `io.applander.linesiege.premium` in App Store Connect (G4), if Path A created it;
     - G3 and G5 (and O3 and G2 on Path B) while still open, naming the gates that wait for them.
  5. Under "Not tested or not verified":
     - the VoiceOver spot check (R2): the owner's checklist in accessibility's testing reference, in English and Persian, about 15 minutes, on the TestFlight build;
     - the device perf report: the four steps in performance-budgets' measuring reference (Record frame times, play 5 levels, 5 cold starts plus "Run save benchmark", then "Share performance report");
     - sound, haptics and 120 Hz on a phone;
     - the Game screen in landscape on an iPad (the simulator flows cannot rotate; E12-T03's layout test covers the layout);
     - the real purchase sheet.
  6. Check the report with `--kind release` (Path A) or `--kind slice` (Path B), then send it as the final message. On Path A its one request is R1, "ship" or "don't ship".
  7. Say in the report what happens when answers come (after this epic):
     - A play-test or VoiceOver problem becomes a failing test, then a fix.
     - Approved bands become `"status": "approved"` with `"approvedOn"` in `test/sims/line-siege/balance-bands.json`.
     - A read review is recorded with `node packages/tooling/src/i18n/review-sheet.ts --mark-reviewed fa --date YYYY-MM-DD` (and `ckb`), after the corrections land in the copy deck and the catalogs together.
     - A device report is saved as `reports/perf/<device>-1.0.0-<n>.json` and checked with `node skills/performance-budgets/scripts/check-perf-report.mjs reports/perf/<device>-1.0.0-<n>.json --root .`.
     - "Ship" is recorded. The release tag `line-siege/v1.0.0`, a store build and the submission belong to the publishing step.
- **Done when:**
  - The report passes `node skills/git-commits-and-reporting/scripts/check-report.mjs <report> --kind release` (Path A) or `--kind slice` (Path B).
  - Its "Owner steps (not blocking)" block names G6, the balance bands, G7/R3 with the CSV paths, G9 with the WAV folder, and every store step still open. VoiceOver (R2) and the device perf report are under "Not tested or not verified".
  - The report is sent.
- **Owner:** Every check listed above. None of them blocks, and Claude does not wait.

## Close the epic

1. Re-run every task's "Done when" and `npm run verify`; all green.
2. Run `/simplify` over the branch's changes (`git diff main...HEAD`). Apply its fixes; where behaviour changes, test first. Then run `npm run verify` again.
3. Run `/code-review` on the branch. Fix every confirmed finding test-first (a failing test that shows the problem, then the fix). Then run `npm run verify` again.
4. Write the epic's evidence report (git-commits-and-reporting, slice form) and check it with `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e17-ios-release-pilot.md --kind slice`.
5. Merge: `git switch main && git merge --no-ff epic/e17-ios-release-pilot && git push origin main`, then delete the branch (`git branch -d epic/e17-ios-release-pilot && git push origin --delete epic/e17-ios-release-pilot`). The push to `origin` needs the owner's word in this session (git-commits-and-reporting rule 5); without it, `main` stays local and the report says so.

In this epic the close is task T10, and it comes before the release. `release:ios` builds only from a clean `main`, so T10 runs these five steps for T01 to T09 and merges. T11 and T12 then run on `main`:

- Their only commit is the pipeline's `chore(line-siege): build <n>`.
- Their report is the release report (Path A) or T10's report turned into the hand-over (Path B).
- A code fix needed in T11 re-creates `epic/e17-ios-release-pilot` from `main`, runs steps 1 to 5 again on that diff, and then reruns T11.
