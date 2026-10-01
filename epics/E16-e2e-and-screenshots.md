# E16 · End-to-end flows, debug deep link, network guard and the screenshot matrix

| | |
|---|---|
| Branch | `epic/e16-e2e-and-screenshots` |
| Depends on | E15 |
| Spec | N1 (offline first), N3 (our code makes no network requests: the runtime check on the simulator); 8.13 (screenshots of every screen in four languages, light and dark, phone and tablet; the airplane-mode test; the network audit); 8.11 (text grows to 200 %); 9 (offline behaviour); 15.1 (every screen in four languages, nothing cut off, overlapping or wrongly mirrored), 15.2 (a full airplane-mode run), 15.3 (the network audit, runtime layer), 15.4 (an endless loss with ads off and no Premium shows its result), 15.6 (a kill and relaunch loses at most the move in progress); lead decision L11 (never strand a finished run); owner decision O6 (how sound and vibration feel stays the owner's own check) |
| Build order | Shell step 10 |
| Tasks | 10 |

## Current state

Shell step 9 passed in E15. Concretely:

- Every Shell screen is built, routed and signed off: S1 to S15 and S11a to S11d. `node skills/toybox-screens/scripts/check-screens.mjs . --all` and `node skills/toybox-visual-parity/scripts/check-signoff.mjs --all` print `RESULT: PASS`, S15 (`s15-debug-menu`) included. The parity runs are in `.parity/` (gitignored) and the ledger is `parity/signoff.json`.
- `shell-slice.json` still exists and lists every screen. Because of it, `npm run verify` runs knip without its export and type checks and ends with `verify: 11 steps passed, 1 with SKIP lines` (the `[knip-exports]` line). `packages/shell/src/navigation/not-built-screen.tsx` and its test are still in the repo, although no route points at `NotBuiltScreen` any more.
- The test-build debug kit has been in place since E09: the network guard, the debug services, the debug link handler and its intake, `create-debug-parts.ts`, the test-only key-value store, the perf log and the feedback recorders. The native cold-start module came in E10, Home's cold-start mark in E12, and S15's model hook `use-debug-model.ts` in E15.
- `npm run build:ios:sim -- --app line-siege --variant test --ads off` builds the Release test app `apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app` (E10). Its URL scheme is `e07-line-siege` (test builds only) and its id is `io.applander.linesiege`.
- From E10, `packages/tooling/src/audit/` holds the runtime layer's `network-runtime-layer.ts` (with its test) and `sample-sockets.ts`. `packages/tooling/src/e2e/` holds only `maestro-args.ts` and its test.
- `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with three script-target SKIP lines: e2e:ios and screenshots:ios (due at Shell step 10) and release:ios (step 11). The npm scripts `e2e:ios` and `screenshots:ios` and the `.gitignore` lines `/tools/` and `reports/` have been there since E01.

Not there yet:

- No Maestro flows, sub-flows or matrix flow: `packages/shell/e2e/` and `apps/line-siege/e2e/` do not exist. `check-flows.mjs .` passes only through its `SKIP ... [flows-missing]` line, which the slice file allows.
- The rest of the E2E tooling: the runner `run-e2e-ios.ts` and its command line, the simulator helpers, the cold-start and memory steps, the feedback and save-benchmark evidence, `print-level-line.ts`, the screenshot capture and its command line, the gallery, the PNG comparator `packages/tooling/src/visual/compare-png.ts` and the Maestro installer `packages/tooling/scripts/install-maestro.sh`. By the build order, `check-e2e-setup.mjs .` was never run before this step, and it would fail.
- The packages pixelmatch, pngjs and @types/pngjs. Maestro itself (`tools/maestro/`). Java 17 may or may not be on the Mac.
- No perf baseline (`perf-baselines/`) and no screenshot baselines (`apps/line-siege/e2e/baselines/`). No cold-start, memory or runtime network number has ever been measured on the simulator.

## What we will do

This is Shell step 10. We prove, on a real Release simulator build, that the whole app works end to end, offline, with no network traffic, in every language. Then we freeze what every screen looks like.

- **The Shell is complete, so the slice file goes first.** Delete `shell-slice.json` and the `NotBuiltScreen` stand-in in the branch's first commit. From then on every gate is strict: knip checks unused exports, `check-navigation --complete` passes, and the E2E rules are due.
- **The tooling, test first.** Copy e2e-maestro's runner, capture, comparator, gallery, sub-flows and matrix with their Jest tests. Install pixelmatch, pngjs and @types/pngjs. Install Maestro 2.10.0 the pinned way, with Java 17 and telemetry off.
- **The flows.**
  - Copy the Shell's four flows: first launch; the offline core journey with a kill; the switch to Persian; S15's save benchmark.
  - Add one Shell flow for the complete airplane-mode run of spec 15.2. The four templates prove its parts in different flows, but never the whole list offline in one run.
  - Copy and fill the pilot's level-1 flow and its three mode journeys: daily, the Premium continue, and endless (L11).
  - Copy the 200 % text flow, and admob-ads' six ads smoke flows. The ads smoke flows are only checked here; they run by hand in E17.
- **The debug deep link and the network guard on the device.** Both were built in E09 and tested only in Jest. Now every flow sets its state through the test build's link (`debug-setup.yaml`), and every smoke flow ends on the guard's count of zero network attempts (`assert-no-network.yaml`).
- **The evidence run.** Run `npm run e2e:ios -- --app line-siege` with no filter. It runs every flow, then six cold launches (which write the first simulator cold-start baseline), memory after the smoke flow, the check that the win asked for its sound and haptic, S15's save benchmark, and 200 % text in en and fa on phone and iPad. The socket sampler watches for any network socket the whole time.
- **The screenshot matrix.** 11 screens × en, de, fa, ckb × light, dark × iPhone 17 Pro Max and iPad Pro 13-inch: 176 PNGs in 16 sets. Each PNG is opened and compared with its signed-off Toybox frame, then committed as a baseline.

Not in this epic:

- The StoreKit harness and its `packages/shell/e2e/storekit/` flows, the release audits, the archive and the TestFlight upload (E17).
- Running admob-ads' ads smoke flows. They need an `ADS_MODE=test` build and Apple's real prompts, and run by hand before the release (E17).
- The screenshot matrix at 200 % text, the de and ckb parity sign-off, and `check-game-app --stage complete` (release work, E17).
- The owner's device cold-start report, the play-test, listening to the sound previews and the fa and ckb text review. These are owner steps and are never waited for.
- The Android port (E18).

## Final state

- [ ] The Shell is complete and says so. `test ! -e shell-slice.json` succeeds, `git ls-files packages/shell/src/navigation | grep -c not-built` prints 0, and `node skills/navigation-and-routing/scripts/check-navigation.mjs . --complete` prints `RESULT: PASS`.
- [ ] The E2E tooling is tested. `npx jest packages/tooling/src/e2e packages/tooling/src/audit --ci --selectProjects unit` passes, and so does e2e-maestro's definition-of-done Jest command (T09).
- [ ] Maestro 2.10.0 is installed the pinned way. With Java 17 and the three no-telemetry variables, `tools/maestro/bin/maestro --version` prints `2.10.0`. `git ls-files tools` prints nothing.
- [ ] The set-up is complete. `node skills/e2e-maestro/scripts/check-e2e-setup.mjs . --baselines` prints `RESULT: PASS`.
- [ ] Every flow passes the static checks. `node skills/e2e-maestro/scripts/check-flows.mjs . --syntax` prints `RESULT: PASS`. This covers Shell flows 01 to 05, the a11y flow, the pilot's flows 10 to 13, the six ads smoke flows, the three sub-flows and the matrix.
- [ ] The evidence run passes. `npm run e2e:ios -- --app line-siege --sim e16-e2e` passed with no tag filter and without `--flows-only`. `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege` prints `RESULT: PASS` and these evidence lines:
  - 9/9 flows pass, none quarantined;
  - network: no non-loopback sockets;
  - the cold-start median is within baseline × 1.2;
  - memory is at most 150 MB;
  - the win asked for `ui.win` and `success`;
  - the save benchmark made 300 writes with a p95 under 5 ms;
  - large text: 4/4 runs pass.
- [ ] No network traffic. `test -f reports/e2e/line-siege/network.txt && test ! -s reports/e2e/line-siege/network.txt` succeeds.
- [ ] The cold-start baseline is committed. `perf-baselines/cold-start-sim-line-siege.json` is in git with a `Gate-Change:` trailer: `git log --format=%B -- perf-baselines/cold-start-sim-line-siege.json | grep -c Gate-Change` prints 1 or more. `node skills/performance-budgets/scripts/check-perf-report.mjs reports/perf/sim-perf-log.json --root . --sim-baseline <medianMs>` prints `RESULT: PASS`.
- [ ] The screenshot baselines are committed and stable. `find apps/line-siege/e2e/baselines -name '*.png' | wc -l` prints 176. A rerun of `npm run screenshots:ios -- --app line-siege --sim e16-shots` prints `176 screenshots, 0 changed`. `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege --screenshots` prints `RESULT: PASS`.
- [ ] Every screen still matches its design. `node skills/toybox-visual-parity/scripts/check-signoff.mjs --all` prints `RESULT: PASS`.
- [ ] The gates are clean.
  - `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with only the release:ios script-target SKIP line.
  - `npm run verify` is green, prints no SKIP line, and ends with `verify: 11 steps passed, 0 skipped`.
- [ ] The slice report passes: `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e16-e2e-and-screenshots.md --kind slice` prints `RESULT: PASS`.

## Skills to load

Always: `pocket-arcade-index`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`.

For this epic:

- `pocket-arcade-product-spec`: prints the spec lines (N1, N3, 8.11, 8.13, 9, 15.1 to 15.6) for commit bodies and the report, and `check-spec-refs`.
- `e2e-maestro`: the whole step. It provides the runner, the capture, the comparator, the sub-flows, the matrix, the Shell and game flow templates, `print-level-line.ts`, the Maestro installer, and the checkers `check-e2e-setup`, `check-flows` and `check-e2e-report`.
- `ios-simulator-build`: the Release test build the flows run against, `check-sim-app`, and `check-sim-setup` (its `maestro-device` rule covers the new Maestro spawns).
- `privacy-and-network-audit`: the runtime network layer F (the socket sampler and `network.txt`), the shared `network-runtime-layer.ts` and `sample-sockets.ts`, and `audit-repo`.
- `accessibility`: the 200 % text flow `flows/a11y/01-large-text-core-screens.yaml`, what to look for in its screenshots, and `check-a11y-code`.
- `admob-ads`: the six `ads-smoke/` flows, which are copied and checked here and run by hand in E17, and `check-ads`.
- `performance-budgets`: the cold-start and memory budgets the run judges, the committed simulator baseline, and `check-perf-report --sim-baseline`.
- `toybox-visual-parity`: comparing every matrix screen with its signed-off Toybox frame, `run-parity` and `check-signoff` for any screen this epic fixes, and `check-harness`.
- `toybox-screens`: fixing a screen that the matrix or the 200 % text pass shows wrong, and `check-screens --all`.
- `golden-tests`: screenshot baselines are golden paths (Gate-Change policy, `--update` only on purpose), `check-goldens` and `check-golden-changes`.
- `rtl-and-direction`: the synced `03-language-switch.yaml`, and what right-to-left must look like in the fa and ckb screenshots (`check-rtl`).
- `navigation-and-routing`: deleting the `NotBuiltScreen` stand-in, and `check-navigation --complete`.
- `dependency-management`: installing pixelmatch 7.2.0, pngjs 7.0.0 and @types/pngjs 6.0.5 under the pinning policy (`plan-dependency`, `check-deps-policy`).
- `unit-and-component-tests`: the Jest projects and commands for the tooling tests, `check-test-setup` and `check-test-code`.
- `typescript-and-lint-rules`: the copied tooling stays within the strict config and the size limits (`check-source`, `check-configs`).
- `naming-conventions`: the names of the new files and flows (`check-file-names`, `check-code-names`).
- `troubleshooting-playbook`: `find-fix` on any failing flow, build or run log, and `check-known-pitfalls`.

## How we work in this epic

1. Branch: `git switch main && git pull && git switch -c epic/e16-e2e-and-screenshots`. Push the branch after each task (`git push -u origin epic/e16-e2e-and-screenshots`), but only once the owner has given the word to push in this session (git-commits-and-reporting rule 5). Without it, the commits stay local and the report says so. Never bypass the pre-push hook.
2. Test first, always. Write each task's "Tests first" items, run them and watch them fail for the right reason, write the minimum code to pass, then refactor. Never weaken or edit a test to make it pass.
3. Commit each task in Conventional Commits form, with the trailers the skills ask for (Gate-Change:, Spec-Change:). `npm run -s check:fast` must be green before every commit.
4. Screens: a task that builds or changes a screen is not done until toybox-visual-parity's capture matches the Toybox design screenshot for every frame it names, in light-en, light-fa, dark-en and dark-fa at every scroll offset, and check-signoff passes for those frames. Only T08 compares screens as its main job, so it carries the "Design match" line. Any screen that T07 or T08 has to fix goes through the same capture and sign-off before its task is done.
5. Stop and ask the owner only at a step marked **Owner**.

Rules for every run on the simulator in this epic (from e2e-maestro):

- Use only this session's own simulators: `--sim e16-e2e` gives `e07-e16-e2e` and `e07-e16-e2e-tablet`, and `--sim e16-shots` gives `e07-e16-shots` and `e07-e16-shots-tablet`. Never use `booted`, another session's simulator, or driver port 7001.
- Run against a Release test build with ads off. The runner refuses any other build.
- A flaky flow is a bug. Wait on an id with `extendedWaitUntil`; never sleep, never add `retry:`, and never quarantine a smoke flow.
- No AI or upload commands (`assertWithAI`, `maestro cloud`, `test --analyze`).
- At the end of each task, shut down the simulators the task created with `xcrun simctl shutdown <udid>`.

## Tasks

### E16-T01 · Delete the slice file and the stand-in screen

- **Goal:** The Shell is complete, so the partial-Shell markers go in the branch's first commit, as the build order asks. Without `shell-slice.json`:
  - knip checks unused exports and types again;
  - `check-navigation --complete` passes;
  - the E2E rules fall due: `flows-missing` in `check-flows`, and the sub-flows and matrix in `check-e2e-setup`. T02 to T06 satisfy them.

  A slice never ships, and step 11's release gates fail while the file exists.
- **Skills:** `navigation-and-routing`, `quality-gates`, `typescript-and-lint-rules`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:** the checks that judge a complete Shell are this task's tests. Run each one before deleting anything and keep its output:
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs . --complete` fails with `slice-present` only. No `route-not-built` line appears: since E15 no route uses `NotBuiltScreen`.
  - `grep -rn "NotBuiltScreen\|not-built-screen" packages apps --include=*.ts --include=*.tsx` lists only `not-built-screen.tsx` and its test, with no route and no import.
  - `npm run -s knip` runs every issue kind, as `verify` will once the file is gone. Each unused export or type it names is a red line this task clears.
  - `npm run verify` still ends with `verify: 11 steps passed, 1 with SKIP lines`, which is the "before" line for the report.
- **Build:**
  1. `git rm shell-slice.json packages/shell/src/navigation/not-built-screen.tsx packages/shell/src/navigation/not-built-screen.test.tsx`. The unit and its test go together, so `check-test-edits` raises no `test-deleted` line.
  2. Run `npm run -s knip` and clear every finding:
     - An export no code uses is deleted.
     - An export that only the test-build `require` in `app/test-only.ts` reaches keeps the `/** @public */` tag its template carries.
     - Never add a knip ignore entry: check-gate-wiring rule `knip-ignores` would fail.
     - If removing dead code also removes test assertions, the commit carries `Spec-Change: <what was removed and why>` (check-test-edits rule `assertion-changed`).
  3. Run `npx prettier --check .` and `npm run -s check:fast`.
  4. Commit `chore(shell): remove the slice file and the stand-in screen`. The body says that every Shell screen is built (spec 15.1). Check the message first with `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged` and `node skills/tdd-workflow/scripts/check-test-edits.mjs . --staged --message reports/commit-message.txt`.
- **Done when:**
  - `node skills/navigation-and-routing/scripts/check-navigation.mjs . --complete` and `node skills/navigation-and-routing/scripts/check-navigation.mjs .` print `RESULT: PASS`.
  - `test ! -e shell-slice.json` succeeds.
  - `npm run verify` is green and ends with `verify: 11 steps passed, 0 skipped`, with no SKIP line.
  - These are expected red until later tasks, and are named in the report:
    - `node skills/e2e-maestro/scripts/check-e2e-setup.mjs .` fails (runner files, sub-flows, installer and visual packages missing) until T02;
    - `node skills/e2e-maestro/scripts/check-flows.mjs .` fails `flows-missing` until T03;
    - `check-gate-wiring.mjs .` keeps its e2e:ios and screenshots:ios lines until T02.

### E16-T02 · E2E tooling, the PNG comparator and Maestro

- **Goal:** These are in the repo, each with its Jest test:
  - the evidence runner (`npm run e2e:ios`), the screenshot capture (`npm run screenshots:ios`) and their command lines;
  - the simulator helpers, the cold-start and memory steps, and the feedback and save-benchmark evidence;
  - the level-line printer, the gallery and the PNG comparator;
  - the three sub-flows and the matrix flow.

  Maestro 2.10.0 is installed only through the pinned, checksum-verified installer. It runs with Java 17 and sends nothing off the Mac.
- **Skills:** `e2e-maestro`, `dependency-management`, `privacy-and-network-audit`, `ios-simulator-build`, `unit-and-component-tests`, `typescript-and-lint-rules`, `naming-conventions`, `quality-gates`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:** Copy each test from `skills/e2e-maestro/templates/packages/tooling/src/e2e/` to the repo path on its first line, before its module. Give each module a typed stub (same exports, wrong values), so the red run shows assertion diffs and never `Cannot find module`. Then run `npx jest packages/tooling/src/e2e --ci --selectProjects unit` and keep the red lines. `maestro-args.test.ts` (from E10) stays green. The tests:
  - `e2e-cli.test.ts`: `--help` or `-h` anywhere asks for the usage, and every option is named in it. The runner's options are read, and the tag filter is passed on to Maestro.
  - `screenshots-cli.test.ts`: the usage, the full-matrix defaults (two devices, four languages), and `--sim <purpose>`, which names this session's own `e07-<purpose>` and `e07-<purpose>-tablet`.
  - `simulator.test.ts`:
    - simulator names are `e07-` names;
    - a boot refused for lack of resources says to shut down only this session's own simulators;
    - `debugSetupArgs` applies a link through `debug-setup.yaml`, never `simctl openurl`;
    - `runMaestro` puts the device and a fresh free driver port before the command, or keeps the session's own port.
  - `sim-perf.test.ts`:
    - `judgeColdStart` drops the first launch and compares the median with the baseline × 1.2;
    - a run exactly at the limit passes;
    - with no baseline it judges nothing, so the first run can write one;
    - fewer than six launches are refused;
    - the baseline file text round-trips.
  - `sim-perf-steps.test.ts`: the memory step runs in this order: smoke flows, feedback, relaunch, pid, a 10 s settle, then footprint. It fails when the app does not start again, and measures nothing after a failed smoke flow.
  - `feedback-evidence.test.ts`: the perf log's feedback entries split into sounds and haptic cues, in order. Entries without a label are ignored.
  - `save-benchmark-evidence.test.ts`: the newest `save-benchmark` entry is kept. There is none when no flow ran the benchmark.
  - `level-line.test.ts`: `tapsFor` handles a one-tap board, and on a tap-then-tap board it selects first. It gives no taps when `intentToMove` disagrees. `levelLine` prints the first move, the bot's line and the stars the example win earns, and stops at the move cap.
  - Before evidence: `node skills/e2e-maestro/scripts/check-e2e-setup.mjs .` fails, among others with `maestro-pin`, `runner-file-missing`, `subflow-missing` and `visual-deps`. Keep the list.
- **Build:**
  1. Copy the modules over the stubs from `skills/e2e-maestro/templates/packages/tooling/src/e2e/`: `run-e2e-ios.ts`, `e2e-cli.ts`, `sim-perf-steps.ts`, `sim-perf.ts`, `simulator.ts`, `feedback-evidence.ts`, `save-benchmark-evidence.ts`, `level-line.ts`, `print-level-line.ts`, `capture-screenshots-ios.ts`, `screenshots-cli.ts` and `write-gallery.ts`. Do not copy `maestro-args.ts` again. Prove the E10 copy is unchanged: `cmp skills/e2e-maestro/templates/packages/tooling/src/e2e/maestro-args.ts packages/tooling/src/e2e/maestro-args.ts`.
  2. Copy `templates/packages/tooling/src/visual/compare-png.ts` to `packages/tooling/src/visual/compare-png.ts`.
  3. Copy `templates/packages/tooling/scripts/install-maestro.sh` to `packages/tooling/scripts/install-maestro.sh`. This is a gated path.
  4. Copy the shared steps and the matrix:
     - `templates/packages/shell/e2e/subflows/` (`debug-setup.yaml`, `assert-no-network.yaml`, `shoot-screen.yaml`) into `packages/shell/e2e/subflows/`;
     - `templates/packages/shell/e2e/screenshots/matrix.yaml` into `packages/shell/e2e/screenshots/`.

     `debug-setup.yaml` is synced from the library and is never edited.
  5. Prove that the runtime-layer files E10 copied from privacy-and-network-audit are the same bytes e2e-maestro ships: `cmp` each of `network-runtime-layer.ts`, `network-runtime-layer.test.ts` and `sample-sockets.ts` between `skills/e2e-maestro/templates/packages/tooling/src/audit/` and `packages/tooling/src/audit/`.
  6. Install the comparator's packages, one at a time: `node skills/dependency-management/scripts/plan-dependency.mjs pixelmatch --root . --online`, then the same for `pngjs` and `@types/pngjs`. Run each printed command: a root devDependency with an exact pin (7.2.0, 7.0.0 and 6.0.5). Then `npm approve-scripts --allow-scripts-pending` must print `No packages with unreviewed install scripts.`. Commit the manifests and `package-lock.json` alone as `build(deps): add pixelmatch and pngjs for screenshot diffs`.
  7. Confirm the canonical scripts `"e2e:ios": "node packages/tooling/src/e2e/run-e2e-ios.ts"` and `"screenshots:ios": "node packages/tooling/src/e2e/capture-screenshots-ios.ts"`, and the `.gitignore` lines `/tools/` and `reports/`. Change nothing.
  8. Find Java 17: `/usr/libexec/java_home -v 17`, or else Android Studio's JBR at `/Applications/Android Studio.app/Contents/jbr/Contents/Home`. Then install Maestro:

     `JAVA_HOME="$(/usr/libexec/java_home -v 17)" MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true MAESTRO_DISABLE_UPDATE_CHECK=true bash packages/tooling/scripts/install-maestro.sh`

     It prints `2.10.0`. A second run prints `maestro 2.10.0 already installed in ...`. Never use Homebrew or `curl | bash`. Never change the pin to match a download.
  9. Run `npx prettier --check packages/tooling packages/shell/e2e`. Commit `feat(tooling): run maestro flows and capture the screenshot matrix` with the trailer `Gate-Change: packages/tooling/scripts/install-maestro.sh, the pinned Maestro 2.10.0 installer with its SHA-256 check (Shell step 10)`. Check the message first with `check-commits.mjs . --message reports/commit-message.txt --staged`.
- **Done when:**
  - `npx jest packages/tooling/src/e2e packages/tooling/src/audit --ci --selectProjects unit` passes.
  - `npm run e2e:ios -- --help` and `npm run screenshots:ios -- --help` print their usage and exit 0. `npm run e2e:ios -- --bogus` prints the message and the usage line with no stack trace, and exits 2.
  - With Java 17 and the three variables set, `tools/maestro/bin/maestro --version` prints `2.10.0`. `git status --short tools` prints nothing.
  - These print `RESULT: PASS`:
    - `node skills/e2e-maestro/scripts/check-e2e-setup.mjs .`
    - `node skills/ios-simulator-build/scripts/check-sim-setup.mjs .` (`maestro-device`, `sim-safety`)
    - `node skills/dependency-management/scripts/check-deps-policy.mjs .`
    - `node skills/typescript-and-lint-rules/scripts/check-source.mjs .`
    - `node skills/naming-conventions/scripts/check-file-names.mjs .`
  - `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with only the release:ios script-target line.
  - `npm run -s check:fast` and `npm run verify` are green.
- **Owner:** Only if neither `/usr/libexec/java_home -v 17` nor Android Studio's JBR gives Java 17. Installing a JDK is the owner's step. Claude sends one stop-and-ask message in git-commits-and-reporting's request form, checked with `check-report.mjs <request> --kind request`. Meanwhile it commits the tooling and goes on with the static work of T03 to T06 (copying and filling flows, `check-flows.mjs .` without `--syntax`). `--syntax` and every simulator run wait.

### E16-T03 · Shell flows 01 to 04

- **Goal:** The Shell's journeys run on the real app:
  - `01` first launch to the tutorial, with no network;
  - `02` the core journey offline (spec 15.2's offline part): Home with no banner, a win, Next, a kill and relaunch that reopens on Pause (15.6), Daily from Home's card (L7), and Statistics;
  - `03` the switch to Persian restarts once and keeps progress;
  - `04` S15's "Run save benchmark" on the simulator, with no network.
- **Skills:** `e2e-maestro`, `rtl-and-direction`, `ios-simulator-build`, `troubleshooting-playbook`, `pocket-arcade-product-spec`, `tdd-workflow`.
- **Tests first:** the flows are this task's tests.
  - Red before the copy: `node skills/e2e-maestro/scripts/check-flows.mjs .` fails `flows-missing`, because the slice file is gone.
  - Once copied, a flow is a test of behaviour that already exists, so prove that its key checks can fail. Change one expected value at a time, run that flow alone (command below), see it fail with `Assertion is false` or `Element not found`, then put the value back (the `cmp` in "Done when" proves the file equals its template again). Example: in `02`, after the kill, wait for `game.screen` with no Pause on top instead of `pause.resume-button`. The saved run reopens on Pause, so this must fail.
- **Build:**
  1. Build the test app: `npm run build:ios:sim -- --app line-siege --variant test --ads off`. Then `node skills/ios-simulator-build/scripts/check-sim-app.mjs --app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app --variant test --ads off --game line-siege` prints `RESULT: PASS`.
  2. Copy, unchanged, from `skills/e2e-maestro/templates/packages/shell/e2e/flows/` into `packages/shell/e2e/flows/`: `smoke/01-first-launch.yaml`, `journeys/02-core-journey-offline.yaml`, `rtl/03-language-switch.yaml` and `smoke/04-debug-performance.yaml`. Prove they are unchanged with `cmp`. `03` is synced from the library and must also equal `skills/rtl-and-direction/templates/e2e/03-language-switch.yaml`.
  3. Run `node skills/e2e-maestro/scripts/check-flows.mjs . --syntax`.
  4. Run the Shell flows on this session's simulator. This is iteration, not evidence:

     `npm run e2e:ios -- --app line-siege --sim e16-e2e --flows-only --include-tags shell`

     It creates `e07-e16-e2e`, installs the app, pins the status bar and runs the flows under the socket sampler. To rerun one flow alone, take the simulator's UDID from `xcrun simctl list devices | grep 'e07-e16-e2e ('` and a free port from `node -e "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})"`, then run:

     `JAVA_HOME="$(/usr/libexec/java_home -v 17)" MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true MAESTRO_DISABLE_UPDATE_CHECK=true tools/maestro/bin/maestro --device <udid> --driver-host-port <port> test --test-output-dir reports/e2e/manual <flow> -e APP_ID=io.applander.linesiege -e APP_SCHEME=e07-line-siege`

     The output folder keeps the flow's screenshots under the ignored `reports/`.
  5. When a flow fails:
     - open its folder under `reports/e2e/line-siege/` and run `node skills/troubleshooting-playbook/scripts/find-fix.mjs --log <that flow's log>`;
     - if the flow is wrong (a wait, an id), fix the flow;
     - if the app is wrong, first write a failing Jest test in the layer that owns the cause (a model hook, the debug link handler, the game host), then fix it and rebuild;
     - a line in `network.txt` is an N3 bug: find the code that opened the socket.
  6. Commit `test(shell): add the shell end-to-end flows`, with spec 15.2, 15.6 and N3 in the body.
- **Done when:**
  - `for f in smoke/01-first-launch.yaml journeys/02-core-journey-offline.yaml rtl/03-language-switch.yaml smoke/04-debug-performance.yaml; do cmp skills/e2e-maestro/templates/packages/shell/e2e/flows/$f packages/shell/e2e/flows/$f; done` prints nothing.
  - `node skills/e2e-maestro/scripts/check-flows.mjs . --syntax` prints only line-siege's `mode-flows` FAIL lines (daily, continue, endless), which T05 clears.
  - `npm run e2e:ios -- --app line-siege --sim e16-e2e --flows-only --include-tags shell` exits 0. `reports/e2e/line-siege/junit.xml` shows the four Shell flows as `SUCCESS`, and `reports/e2e/line-siege/network.txt` is empty.
  - `git status --short` shows no PNG outside `reports/`.

### E16-T04 · The full airplane-mode run (spec 15.2)

- **Goal:** One offline run proves the whole list of spec 15.2: first launch → tutorial → 10 levels → daily → stats → settings → every language switch. The templates prove its parts in separate flows, and not all of them offline. The new flow also proves that the debug flags survive the direction reloads, as e2e-maestro's definition of done asks: a `lang=fa&date=...&offline=1&screen=levels` link lands on Levels after the reload with the offline flag still set. Spec 9's offline Premium page ("Connect to buy") is checked on the way.
- **Skills:** `e2e-maestro`, `rtl-and-direction`, `pocket-arcade-product-spec`, `troubleshooting-playbook`, `tdd-workflow`.
- **Tests first:**
  - Write `packages/shell/e2e/flows/offline/05-airplane-mode-run.yaml` step by step. After each step, run `node skills/e2e-maestro/scripts/check-flows.mjs .`: an id or a debug query outside the contract fails there (`unknown-testid`, `debug-query`) before any simulator run. Every id below is in e2e-maestro's `assets/screen-testids.json`.
  - Prove the ten-level check can fail: point it once at `levels.level-tile.11` (not won yet), run the flow alone, see `Assertion is false`, then point it back.
- **Build:** the flow file. Its header is `appId: ${APP_ID}`, a `name:` sentence and `tags: [shell, offline]`. It has no `env:` block for `APP_ID`, `APP_SCHEME`, `LANG` or `THEME`. Every state comes from `../../subflows/debug-setup.yaml`, and every tap is a key under test. The steps:
  1. `launchApp` with `clearState: true` and `clearKeychain: true`. Assert `language-choice.screen`.
  2. Setup link `offline=1&date=2026-09-26&seed=42&ads=off&reduceMotion=1` with `WAIT_FOR: 'language-choice.screen'`. The link has no `lang`, so the first run stays on S2, and the app is offline from its first screen.
  3. Tap `language-choice.language-row.en`, then `language-choice.continue-button`, then `extendedWaitUntil` `tutorial.screen` (timeout 10000).
  4. Setup link `firstRun=0&screen=home` with `WAIT_FOR: 'home.screen'`. Game-host-integration's tests prove the tutorial's own steps; the flow proves the tutorial opens offline. Then `assertNotVisible` `home.banner-ad`.
  5. Ten levels. Tap `home.play-button`, then ten times in a row, written out (`repeat:` is not on the skill's verified command list):
     - setup link `action=win-level` with `WAIT_FOR: 'result.screen'`;
     - after wins 1 to 9 only: tap `result.next-button` and wait for `game.screen`.
  6. Setup link `screen=levels` with `WAIT_FOR: 'levels.level-tile.11'`. Assert `levels.level-tile.10` with `text: '.*[^0-9][1-3] .*'`, which reads the stars in the tile's VoiceOver label. Then tap `levels.top-bar.back-button`.
  7. Daily, from Home's card (L7):
     - tap `home.daily-card` and wait for `daily.screen`;
     - tap `daily.play-button` and wait for `game.screen`;
     - setup link `action=win-level` with `WAIT_FOR: 'result.daily-title'`;
     - setup link `screen=home` with `WAIT_FOR: 'home.screen'`.
  8. Statistics: tap `home.stats-button`, assert `stats.overview-card`, tap `stats.top-bar.back-button`.
  9. Premium offline (spec 9, N1): tap `home.premium-button`, assert `premium.state.unavailable`, tap `premium.top-bar.back-button`.
  10. Settings and every language switch:
      - tap `home.settings-button`, then `settings.language-row`;
      - tap `settings-language.language-row.de`. The direction does not change, so the text switches at once; assert `settings-language.screen`;
      - tap `settings-language.language-row.fa`, then `restart-dialog.restart-button`, then `extendedWaitUntil` `home.screen` (timeout 20000);
      - tap `home.settings-button`, then `settings.language-row`, then `settings-language.language-row.ckb` (same direction), then `settings-language.language-row.en`, then `restart-dialog.restart-button`, then wait for `home.screen` (timeout 20000).

      Add `waitForAnimationToEnd` before any tap that follows a `scrollUntilVisible`.
  11. Setup link `lang=fa&date=2026-09-27&offline=1&screen=levels` with `WAIT_FOR: 'levels.screen'`. This lands after the direction reload. Then setup link `screen=premium` with `WAIT_FOR: 'premium.state.unavailable'`: the offline flag survived the reload.
  12. `runFlow: ../../subflows/assert-no-network.yaml`.

  Run the flow alone, as in T03, until it passes three times in a row with no change. Commit `test(shell): prove the full airplane-mode run offline`, with spec 15.2, N1 and 9 in the body (print them with `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs 15.2 N1 9`).
- **Done when:**
  - `node skills/e2e-maestro/scripts/check-flows.mjs . --syntax` prints only line-siege's `mode-flows` FAIL lines.
  - `npm run e2e:ios -- --app line-siege --sim e16-e2e --flows-only --include-tags offline` exits 0. `junit.xml` lists `05-airplane-mode-run` and `02-core-journey-offline` as `SUCCESS`, and `network.txt` is empty.

### E16-T05 · Pilot flows 10 to 13

- **Goal:** Line Siege proves its own wiring:
  - `10-level-1`, a smoke flow: a real move by taps on the Skia board; a kill and relaunch that resumes the move (15.6); `action=win-level` through the game host; the stars the example win earns; Levels shows them; and level 2 opens.
  - One journey per mode in `game.config.ts`: `11-daily` (the streak the next day), `12-continue-premium` (a loss continued with the Premium continue) and `13-endless` (ads off and `premium=0`: the endless result with New best at once and no continue offer, then Home's best; L11 and 15.4).
- **Skills:** `e2e-maestro`, `pocket-arcade-product-spec`, `troubleshooting-playbook`, `tdd-workflow`.
- **Tests first:**
  - Run `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/e2e/print-level-line.ts --app line-siege --level 1`. Keep its output:
    - the first move as tap targets: a `tray` cell, then a `board` cell, because Line Siege is tap-then-tap;
    - the line `action=win-level earns <n> star(s): assert result.stars-<n> and list it in the game's e2e/testids.json`. The skill's reference expects 3: score 180 against 0 / 150 / 180;
    - the bot's line.
  - Red before the copy: `check-flows.mjs .` fails `mode-flows` for daily, continue and endless.
  - Copy `10-level-1.yaml` with `result.stars-<n>` filled in but before `apps/line-siege/e2e/testids.json` exists: `check-flows.mjs .` must fail `win-stars`. That is the red the testids file clears.
  - Static proof that the endless flow guards L11: after copying `13-endless.yaml`, put `premium=1` into its query for one check run. `check-flows.mjs .` must fail `mode-flows` (an endless flow must never set Premium). Then take it out again.
- **Build:**
  1. Copy `skills/e2e-maestro/templates/apps/__GAME_ID__/e2e/flows/smoke/10-level-1.yaml` to `apps/line-siege/e2e/flows/smoke/10-level-1.yaml` and fill in:
     - `__GAME_ID__` = `line-siege` and `__GAME_NAME__` = `Line Siege`;
     - `__FROM_REGION_ID__` = `tray` and `__TO_REGION_ID__` = `board`;
     - `__FROM_COL__`, `__FROM_ROW__`, `__TO_COL__` and `__TO_ROW__` from the printed first move;
     - `__WIN_STARS__` = the printed count.
  2. Write `apps/line-siege/e2e/testids.json` as `{ "testIDs": { "result.stars-<n>": "the stars action=win-level earns on level 1 (testing.examples.win(), printed by print-level-line.ts)" } }`. The build-order manifest calls this file generated; it is written from print-level-line's output.
  3. Copy `journeys/11-daily.yaml`, `journeys/12-continue-premium.yaml` and `journeys/13-endless.yaml` to `apps/line-siege/e2e/flows/journeys/`, and fill in `__GAME_ID__` and `__GAME_NAME__`.
  4. Run `node skills/e2e-maestro/scripts/check-flows.mjs . --syntax`. Fix every FAIL line in the flow, never in the checker or the contract.
  5. Run the game flows: `npm run e2e:ios -- --app line-siege --sim e16-e2e --flows-only --include-tags line-siege`. Prove one check can fail, as in T03: assert `result.stars-<n+1>` once (`check-flows` fails `win-stars`, and the run fails on the simulator), then put the count back. Then commit `test(line-siege): add the level-1 and mode flows`, with 15.4, 15.6 and L11 in the body.
- **Done when:**
  - `grep -rn "__[A-Z_]*__" apps/line-siege/e2e` prints nothing.
  - `node skills/e2e-maestro/scripts/check-flows.mjs . --syntax` prints `RESULT: PASS`, including the rules `win-stars`, `progress-after-win` and `mode-flows`.
  - `npm run e2e:ios -- --app line-siege --sim e16-e2e --flows-only` exits 0 with all nine flows `SUCCESS` in `junit.xml`. `13-endless` asserts `result.endless-title` and `result.score-card.new-best` with no `result.continue-offer`. `network.txt` is empty.

### E16-T06 · The 200 % text flow and the ads smoke flows

- **Goal:**
  - The large-text pass (spec 8.11) has its flow. The runner's large-text step runs it at the largest Dynamic Type size, in en and fa, on the phone and the iPad.
  - admob-ads' six ads smoke flows are in place and checked. They run by hand on an `ADS_MODE=test` build in E17, and never through `e2e:ios`.
- **Skills:** `accessibility`, `admob-ads`, `e2e-maestro`, `tdd-workflow`.
- **Tests first:**
  - `node skills/e2e-maestro/scripts/check-e2e-setup.mjs .` passes before the copy, and its `e2e-ads-off` rule is the guard here: the runner lists only `flows/*/*.yaml` and refuses ads-on builds. It must still pass after the copy.
  - For the ads smoke flows, `check-flows.mjs .` applies its own rules: `ads-smoke-launch` (no `launchApp`), `ads-smoke-geo` (`geo=` in the first link), `ads-smoke-testid`, `run-command-device` and `open-alert-guard`. Run it right after the copy, so any mismatch with this repo shows before commit.
- **Build:**
  1. Copy `skills/accessibility/templates/e2e/01-large-text-core-screens.yaml` to the path on its first line, `packages/shell/e2e/flows/a11y/01-large-text-core-screens.yaml`. Its tags are `[shell, a11y]`, and it reads `${LANG}` from the runner.
  2. Copy `skills/admob-ads/templates/packages/shell/e2e/ads-smoke/` (`01-consent-eea.yaml`, `02-relaunch.yaml`, `03-next-interstitial.yaml`, `04-rewarded-continue.yaml`, `05-offline.yaml` and `06-geo-other.yaml`) into `packages/shell/e2e/ads-smoke/`, unchanged.
  3. Run `npx prettier --check packages/shell/e2e`. Commit `test(shell): add the large-text flow and the ads smoke flows`, with 8.11 and 15.4 in the body.
- **Done when:**
  - These print `RESULT: PASS`:
    - `node skills/e2e-maestro/scripts/check-flows.mjs . --syntax`
    - `node skills/e2e-maestro/scripts/check-e2e-setup.mjs .` (`e2e-ads-off`)
    - `node skills/admob-ads/scripts/check-ads.mjs .`
    - `node skills/accessibility/scripts/check-a11y-code.mjs .`
  - `grep -c ads-smoke packages/tooling/src/e2e/run-e2e-ios.ts` prints 0: the runner lists only `flows/*/*.yaml` and never names that folder.

### E16-T07 · The evidence run

- **Goal:** One run with no filter, on this session's simulators, proves Shell step 10's evidence:
  - every flow passes, and S15's save benchmark is kept in `save-benchmark.json`;
  - six cold launches write the first `perf-baselines/cold-start-sim-line-siege.json`;
  - the footprint after the smoke flow and a relaunch is at most 150 MB;
  - `feedback.json` holds `ui.win` and `success` (O6: the app asked for them; how they sound and feel is the owner's check);
  - the 200 % text flow passes in en and fa on phone and iPad;
  - `network.txt` stays empty the whole time (N3, 15.3).
- **Skills:** `e2e-maestro`, `ios-simulator-build`, `performance-budgets`, `privacy-and-network-audit`, `accessibility`, `toybox-screens`, `toybox-visual-parity`, `troubleshooting-playbook`, `git-commits-and-reporting`, `tdd-workflow`.
- **Tests first:** `check-e2e-report.mjs` and `check-perf-report.mjs` are this task's tests, run on real reports. Before the run, write the expected results into the task notes:
  - 9/9 flows;
  - no quarantined flow;
  - network empty;
  - a cold-start baseline written;
  - memory at most 150 MB;
  - the win sound and the success haptic;
  - 300 benchmark writes with p95 under 5 ms;
  - 4/4 large-text runs.

  Any other result is first reproduced as a failing Jest test in the layer that owns the cause, then fixed there:
  - the runner or the steps: `packages/tooling/src/e2e/*.test.ts`;
  - the perf log or the recorders: their own tests;
  - a screen: its component test.
- **Build:**
  1. If any app code changed since T03's build, rebuild: `npm run build:ios:sim -- --app line-siege --variant test --ads off`.
  2. Run the evidence run and keep its log:

     `npm run e2e:ios -- --app line-siege --sim e16-e2e > reports/e2e-run-line-siege.log 2>&1; echo "e2e:ios exit $?"`

     It must print `e2e:ios exit 0`. Use no `--include-tags` and no `--flows-only`. It takes a long time, so run it in the background or with the longest timeout. On "insufficient system resources", shut down only this session's `e07-*` simulators and run it again.
  3. Run `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege` and keep the evidence lines it prints.
  4. Read the median from `perf-baselines/cold-start-sim-line-siege.json`. Then run `node skills/performance-budgets/scripts/check-perf-report.mjs reports/perf/sim-perf-log.json --root . --sim-baseline <medianMs>`.
  5. Open with the Read tool:
     - every screenshot under `reports/e2e/line-siege/large-text/phone-en/`, `phone-fa/`, `tablet-en/` and `tablet-fa/`: look for clipped text, overlap, rows that should stack, and fa right to left;
     - the flows' own screenshots: `first-launch-tutorial`, `line-siege-level-1-won` and `fa-levels-after-restart`.

     A clipped or overlapping row is a screen bug, fixed by this route:
     1. write a failing component test at large text (accessibility rule 3: `maxFontSizeMultiplier={2}`, `minHeight`, rows that stack at `isLargeText`);
     2. fix the screen (toybox-screens);
     3. re-run `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen <S-id> --bundle-id io.applander.linesiege --name e07-parity-e16` and re-sign until `check-signoff.mjs --screen <S-id>` passes;
     4. rebuild and run step 2 again.
  6. Check that the run stayed on this session's simulators: `grep '^maestro:' reports/e2e-run-line-siege.log` shows only the UDIDs of `e07-e16-e2e` and `e07-e16-e2e-tablet`, and none of the lines names port 7001.
  7. Commit `perf-baselines/cold-start-sim-line-siege.json` as `test(line-siege): commit the first simulator cold-start baseline`, with the trailer `Gate-Change: perf-baselines/cold-start-sim-line-siege.json, the first simulator cold-start baseline (median <n> ms of 5 launches, Shell step 10)`. Check it with `check-commits.mjs . --message reports/commit-message.txt --staged`. Never use `--write-perf-baseline` to clear a slower run.
  8. Shut down `e07-e16-e2e` and `e07-e16-e2e-tablet` by UDID.
- **Done when:**
  - The step-2 command printed `e2e:ios exit 0`.
  - `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege` prints `RESULT: PASS`, with 9/9 flows, quarantined none, no non-loopback sockets, cold start within the limit, memory at most 150 MB, the feedback line, the save-benchmark line (300 writes, p95 under 5 ms) and large text 4/4.
  - `test ! -s reports/e2e/line-siege/network.txt` succeeds.
  - `check-perf-report.mjs reports/perf/sim-perf-log.json --root . --sim-baseline <medianMs>` prints `RESULT: PASS`.
  - Every large-text screenshot was opened, and any fix went through the route in step 5.
  - The baseline commit passes `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range HEAD~1..HEAD`.

### E16-T08 · Screenshot matrix

- **Goal:** Every screen is captured in 4 languages × light and dark × phone and tablet: 176 PNGs in 16 sets, which is spec 8.13's screenshot hook and 15.1's evidence. Every PNG is opened and compared with its signed-off Toybox frame, and the sets are committed as baselines. From then on, a screen that changes by accident fails `screenshots:ios`.
- **Skills:** `e2e-maestro`, `toybox-visual-parity`, `toybox-screens`, `rtl-and-direction`, `golden-tests`, `ios-simulator-build`, `git-commits-and-reporting`, `tdd-workflow`.
- **Tests first:**
  - `node skills/e2e-maestro/scripts/check-e2e-setup.mjs . --baselines` fails `baseline-matrix`, because all 16 sets are missing.
  - Run one narrowed capture without `--update`: `npm run screenshots:ios -- --app line-siege --sim e16-shots --devices phone --langs en`. Every row is `missing-baseline`, and the command exits 1. That is the red for the right reason.
- **Build:**
  1. Capture all sets: `npm run screenshots:ios -- --app line-siege --sim e16-shots --update`. This takes about 40 minutes, so run it in the background. It writes `apps/line-siege/e2e/baselines/<phone|tablet>/<lang>-<light|dark>/<screen>.png`, `reports/screenshots/summary.json` and the gallery `reports/screenshots/index.html`.
  2. Open every one of the 176 PNGs with the Read tool, set by set. Check:
     - the direction: fa and ckb right to left, and the board never mirrored;
     - clipping, overlap and truncated text;
     - the colours per theme;
     - the fonts: Vazirmatn in fa and ckb, Lilita One and Rubik in en and de;
     - on the tablet sets, `game-start` and `game-middle` (spec S5: tablets get a centred board): the column is centred and no wider than 640 pt, the board is centred in it with the ground showing on both sides, and the top bar is not stretched across the iPad. E12-T03's `game-layout.test.tsx` case proves the same for an iPad in landscape; Maestro 2.10.0's verified commands cannot rotate the simulator, so landscape on a real iPad goes under "Not tested or not verified" and into the owner's play-test.
  3. Compare each screen with its reference (see Design match). The device and the fixture state differ (iPhone 17 Pro Max against the parity iPhone 16 Pro; the matrix's 2026-09-26 and `stars=demo` against the frame's level 12), so judge layout, order, colours, icons and mirroring, not pixels.
  4. A real difference is a screen bug, fixed this way:
     1. write a failing component test first (toybox-screens, rtl-and-direction);
     2. fix the screen and rebuild;
     3. run `node skills/toybox-visual-parity/scripts/run-parity.mjs --screen <S-id> --bundle-id io.applander.linesiege --name e07-parity-e16` in light and dark × en and fa;
     4. read every sheet, record the ledger entry (`check-signoff.mjs --draft <run-dir> --from-ledger`), and pass `check-signoff.mjs --screen <S-id>`;
     5. update only the sets that changed (`--update --devices <d> --langs <l>`).

     Never raise `MAX_DIFF_RATIO` (0.2 % of pixels) and never touch the references.
  5. Rerun without `--update`: `npm run screenshots:ios -- --app line-siege --sim e16-shots`. It prints `176 screenshots, 0 changed` and exits 0. A diff in a different place on each run means a screen is not still; fix the setup or the screen, never the tolerance.
  6. Run `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege --screenshots`.
  7. Commit the baselines as `test(line-siege): add the screenshot matrix baselines`, with the trailer `Gate-Change: apps/line-siege/e2e/baselines, the first screenshot matrix (176 PNGs in 16 sets, each opened and compared with its Toybox frame)`. Before committing, run `node skills/golden-tests/scripts/check-golden-changes.mjs . --staged --message reports/commit-message.txt` and `check-commits.mjs . --message reports/commit-message.txt --staged`.
  8. Pick at most five gallery rows worth the owner's look for the report. Shut down `e07-e16-shots`, `e07-e16-shots-tablet` and `e07-parity-e16` by UDID.
- **Design match:** each matrix screen against its signed-off frame from `frames.json`, in light-en, light-fa, dark-en and dark-fa at every scroll offset. The references are under `skills/toybox-visual-parity/assets/reference/lineSiege/<variant>/`. de is compared with the en reference and ckb with the fa reference.

  | Matrix screen | Frame |
  |---|---|
  | `home` | `s4-home` |
  | `levels` | `s8-levels` |
  | `daily` | `s9-daily-challenge` |
  | `stats` | `s10-statistics` |
  | `settings` | `s11-settings` (Line Siege's facts pick `s11-settings--no-music`) |
  | `premium` | `s12-store-unavailable-offline`: the simulator gets no product from the store, so it shows "Connect to the internet to buy or restore." without a price |
  | `how-to-play` | `s13-how-to-play` |
  | `game-start`, `game-middle` | no frame of their own (S5): compare the top bar and layout with the Shell chrome of `s6-pause` (`s6-pause--no-music--no-hints`), with the board masked |
  | `result-win` | `s7-result-win` (`s7-result-win--score`) |
  | `result-lose` | `s7-result-lose` |

  Sign-off: `node skills/toybox-visual-parity/scripts/check-signoff.mjs --frame s4-home --frame s8-levels --frame s9-daily-challenge --frame s10-statistics --frame s11-settings --frame s12-store-unavailable-offline --frame s13-how-to-play --frame s6-pause --frame s7-result-win --frame s7-result-lose` prints `RESULT: PASS` with no `narrowed` line, and so does `check-signoff.mjs --all`.
- **Done when:**
  - `find apps/line-siege/e2e/baselines -name '*.png' | wc -l` prints 176.
  - The rerun in step 5 printed `176 screenshots, 0 changed`.
  - These print `RESULT: PASS`:
    - `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege --screenshots` (`Screenshots: 176 captured in 16 sets, 0 changed`)
    - `node skills/e2e-maestro/scripts/check-e2e-setup.mjs . --baselines`
    - the two `check-signoff.mjs` commands above
    - `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD`
- **Owner:** Only if a screen differs from its frame in a way the app cannot fix (a waiver in `parity/waivers.json`), or the design itself looks wrong. A waiver is reported to the owner (toybox-visual-parity rule 4). A design question goes into one stop-and-ask message. Meanwhile Claude goes on with the other screens and sets, and leaves the affected sets out of the baseline commit until the owner answers.

### E16-T09 · Prove Shell step 10

- **Goal:** Every "done when" of Shell step 10 holds at the same time on the branch, the whole Shell stays as built and signed off now that every gate is strict, and nothing else moved.
- **Skills:** `e2e-maestro`, `ios-simulator-build`, `privacy-and-network-audit`, `accessibility`, `admob-ads`, `performance-budgets`, `navigation-and-routing`, `toybox-screens`, `toybox-visual-parity`, `golden-tests`, `rtl-and-direction`, `unit-and-component-tests`, `typescript-and-lint-rules`, `naming-conventions`, `troubleshooting-playbook`, `pocket-arcade-product-spec`, `quality-gates`, `tdd-workflow`.
- **Tests first:** Nothing new: the step's checks are the tests. A red check becomes a failing test in the owning layer before its fix, as in T07. If any app code changed after T07 (a fix from T08), rebuild the test app and run `npm run e2e:ios -- --app line-siege --sim e16-e2e` again before the report checks below.
- **Build:** Run every command below from the repo root. Fix causes in the app, the flows or the tooling, test first. Never fix them in a gate, a checker, a reference or a tolerance.
- **Done when:**
  - The Shell is complete. `test ! -e shell-slice.json` succeeds. `node skills/navigation-and-routing/scripts/check-navigation.mjs . --complete` prints `RESULT: PASS`.
  - The E2E step passes. These print `RESULT: PASS`:
    - `node skills/e2e-maestro/scripts/check-e2e-setup.mjs . --baselines`
    - `node skills/e2e-maestro/scripts/check-flows.mjs . --syntax`
    - `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege`
    - `node skills/e2e-maestro/scripts/check-e2e-report.mjs . --app line-siege --screenshots`
  - `network.txt` is empty.
  - e2e-maestro's definition-of-done Jest command passes:

    `npx jest packages/shell/src/screens/debug packages/shell/src/app/debug-link-handler.test.ts packages/shell/src/app/debug-link-intake.test.ts packages/shell/src/app/create-debug-parts.test.ts packages/shell/src/app/debug-services-context.test.tsx packages/tooling/src/e2e test/integration/save/sqlite-kv-debug-store-adapter.test.ts --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/screens/debug/**/*.ts' --coverageThreshold='{}'`
  - The gates are wired and clean:
    - `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with only `release:ios` as a script-target SKIP line (due at Shell step 11);
    - `node skills/quality-gates/scripts/check-bypasses.mjs .` prints `RESULT: PASS`;
    - `npm run verify` is green with no SKIP line and ends with `verify: 11 steps passed, 0 skipped`.
  - The screens still hold. These print `RESULT: PASS` with no SKIP line:
    - `node skills/toybox-screens/scripts/check-screens.mjs . --all`
    - `node skills/toybox-visual-parity/scripts/check-signoff.mjs --all`
    - `node skills/toybox-visual-parity/scripts/check-harness.mjs .`
  - These print `RESULT: PASS`:
    - `node skills/privacy-and-network-audit/scripts/audit-repo.mjs .`
    - `node skills/admob-ads/scripts/check-ads.mjs .`
    - `node skills/accessibility/scripts/check-a11y-code.mjs .`
    - `node skills/rtl-and-direction/scripts/check-rtl.mjs .`
    - `node skills/performance-budgets/scripts/check-perf-code.mjs .`
    - `node skills/performance-budgets/scripts/check-budgets.mjs .`
    - `node skills/ios-simulator-build/scripts/check-sim-setup.mjs .`
    - `node skills/troubleshooting-playbook/scripts/check-known-pitfalls.mjs .`
  - These print `RESULT: PASS`:
    - `node skills/golden-tests/scripts/check-goldens.mjs .`
    - `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD`
    - `node skills/unit-and-component-tests/scripts/check-test-setup.mjs .`
    - `node skills/unit-and-component-tests/scripts/check-test-code.mjs .`
    - `node skills/tdd-workflow/scripts/check-tests.mjs .`
    - `node skills/typescript-and-lint-rules/scripts/check-source.mjs .`
    - `node skills/typescript-and-lint-rules/scripts/check-configs.mjs .`
    - `node skills/naming-conventions/scripts/check-file-names.mjs .`
    - `node skills/naming-conventions/scripts/check-code-names.mjs .`
    - `node skills/pocket-arcade-product-spec/scripts/check-spec-refs.mjs .`
  - `npx tsc --noEmit -p packages/shell`, `npm run -s check:fast` and `npm run test:coverage` are green.

### E16-T10 · Simplify, code review, re-run the gates and merge

- **Goal:** The branch is reviewed, simplified and merged, with its evidence report written.
- **Skills:** `e2e-maestro`, `golden-tests`, `quality-gates`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:** Every confirmed review finding first gets a failing test that shows the problem, then the fix:
  - in the tooling: a test in `packages/tooling/src/e2e/*.test.ts` or `packages/tooling/src/audit/*.test.ts`;
  - in a flow: a `check-flows.mjs .` FAIL line, or one run of the flow on the simulator that fails for the reason the finding names;
  - in the app: a unit or component test.

  The copied template files that are synced from the library (`debug-setup.yaml`, `03-language-switch.yaml`, `maestro-args.ts`, `network-runtime-layer.ts`, `sample-sockets.ts`) are never edited. A finding against one of them is reported, not fixed here.
- **Build:**
  1. Follow "Close the epic" below, steps 1 to 5.
  2. If a fix touches the app, a flow or the runner, run T07's evidence run again. If it touches a screen or the capture, run T08's matrix rerun again, plus `--update` with a `Gate-Change:` trailer only for a change made on purpose.
  3. Copy `skills/git-commits-and-reporting/templates/evidence-slice.md` to `reports/evidence-<YYYY-MM-DD>-e16-e2e-and-screenshots.md` and fill it in:
     - **The outcome in players' words:** every screen and journey of Line Siege now runs by itself on the simulator, offline and in four languages, with no network traffic.
     - **Checks:** the `evidence:` lines that `check-e2e-report.mjs` printed (flows, quarantined, network, cold start, memory, feedback, save benchmark, large text, screenshots), and the line `verify: 11 steps passed, 0 skipped`.
     - **What changed for players:** spec 15.1, 15.2, 15.3, 15.4, 15.6, N1, N3 and 8.11, each in the spec's words.
     - **Please look at (at most five):** gallery rows from `reports/screenshots/index.html` (open it for the owner with `open reports/screenshots/index.html`), and the dark fa Result screen.
     - **Not tested or not verified:**
       - the ads smoke flows (E17, ads-on build);
       - the 200 % screenshot matrix and the de and ckb parity sign-off (E17);
       - the tutorial's own steps by hand (the play-test);
       - the cold start on a real iPhone (the owner's device report before the release).
     - **Owner steps (not blocking):** the fa and ckb texts (R3), the Line Siege play-test (G6), listening to the sound previews (G9), and G3 and G5.
- **Done when:**
  - Every T09 "Done when" passes again after the fixes.
  - These print `RESULT: PASS`:
    - `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD`
    - `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD`
    - `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD`
    - `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e16-e2e-and-screenshots.md --kind slice`
  - The branch is merged into `main` and deleted: `git branch -d epic/e16-e2e-and-screenshots && git push origin --delete epic/e16-e2e-and-screenshots`.

## Close the epic

1. Re-run every task's "Done when" and `npm run verify`; all green.
2. Run `/simplify` over the branch's changes (`git diff main...HEAD`). Apply its fixes; where behaviour changes, test first. Then run `npm run verify` again.
3. Run `/code-review` on the branch. Fix every confirmed finding test-first (a failing test that shows the problem, then the fix). Then run `npm run verify` again.
4. Write the epic's evidence report (git-commits-and-reporting, slice form) and check it with `node skills/git-commits-and-reporting/scripts/check-report.mjs <report> --kind slice`.
5. Merge: `git switch main && git merge --no-ff epic/e16-e2e-and-screenshots && git push origin main`, then delete the branch. The push to `origin` needs the owner's word in this session (git-commits-and-reporting rule 5); without it, `main` stays local and the report says so.
