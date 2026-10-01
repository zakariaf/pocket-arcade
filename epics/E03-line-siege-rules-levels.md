# E03 · Line Siege rules, bots and levels

| | |
|---|---|
| Branch | `epic/e03-line-siege-rules-levels` |
| Depends on | E02 |
| Spec | 13 (`line-siege`, catalogue entry 1) and the Line Siege v1 rules sheet (`line-siege-rules`); 8.1 (levels and stars), 8.2 (modes), 8.3 (daily generation), 8.4 (scoring), 8.10 (the continue rule), 8.13 (bots and seeded rules); 10 (game contract: RULES, LEVELS, STATISTICS, TESTING); 15.7 (every shipped level proven winnable, a sensible bot curve; the owner's play-test is G6 and never blocks); D1 (pilot = Line Siege), D9 (3 packs x 30 levels, plus Daily and Endless); lead decision L4 (the march text matches the tuning) from docs/99-final-decisions.md section H |
| Build order | Shell step 3 (pocket-arcade-index, build-orders.md, "The Shell with the pilot game" row 3 and "What each Shell step copies, installs and generates", Step 3) |
| Tasks | 14 |

## Current state

From E01 (Shell step 1):
- The monorepo exists at the repo root with the workspaces `packages/game-kit`, `packages/shell`, `packages/tooling` and `apps/line-siege`. `jest.config.js` has the `unit` and `golden` projects, and its unit project already ignores `\.sim\.test\.`. `jest.sim.config.js` exists. The root `package.json` has `test:sim`, `test:golden`, `test:coverage`, `check:fast` and `verify`. `quality-gates.json` lists the gated paths, among them `jest.sim.config.js` and `**/*.golden.test.ts.snap.ios`. lefthook runs pre-commit (format, lint, full typecheck, related tests), commit-msg and pre-push (`npm run verify`). `shell-slice.json` says `"screens": []`. `reports/` is gitignored.
- `apps/line-siege` is a scaffold only: `package.json`, `app.config.ts`, `game.config.ts` (id `line-siege`, bundle id `io.applander.linesiege`, `modes: { daily: true, endless: true }`, `levels: { packCount: 3, levelsPerPack: 30 }`, `hints.freePerDay: 0`, `isContinueAllowed: true`, violence `INFREQUENT_OR_MILD`), `metro.config.js`, `tsconfig.json`, the placeholder `index.ts`, `assets/fonts/` and `src/i18n/{en,de,fa,ckb}.json`. The four catalogs are the canonical Line Siege catalogs. They already hold every `line-siege.*` key the rules name: `.lose.broke-through`, `.lose.board-full`, `.progress`, `.progress.endless`, `.continue.push-back`, `.board.summary`, the three `.stats.*` labels and the three `.pack-name.*` keys. Their fa and ckb texts have been on the owner's review list since E01.

From E02 (Shell step 2):
- `packages/game-kit/src/` holds `contract/` (the thirteen contract files, with `difficulty.ts`: `ENDLESS_DIFFICULTY`, `clampDifficulty`, `rowFor`), `rng/` (`sfc32.ts` with its golden test, `pick-at.ts`), `geom/board-layout*`, `geom/classify-swipe*`, `timeline/track*`, `testing/` (`play-choices`, `play-bot`, `json-shape`, `engine-contract`, `contract-intents`, `render-cells`), `dates/` (`date-key`, `daily-seed`), `levels/` (level table, levels contract, pack progress, star rating, daily start, level plan, `plan-level-table`, `witness-solver`) and `solver/`, each with its tests.
- `fast-check` 4.10.2 is pinned exactly in the root `devDependencies`.
- `node skills/game-rules-engine/scripts/check-rules-engine.mjs .` prints RESULT: PASS (the kit and the RNG goldens; there is no game yet). `node skills/level-generation-and-solvers/scripts/check-levels.mjs .` prints exactly one FAIL line: `packages/tooling/src/levels/generate-levels.ts [kit-file-missing]`, which this epic closes.

What does not exist yet:
- `apps/line-siege/src/rules/`, `src/testing/`, `src/levels/` and `src/board/`. There are no rules, no bot, no example states, no levels, no packs and no goldens.
- The game-kit bot harness (`trace-bot`, `bot-policies`, `sim-stats`, `balance-bands`, `parse-balance-bands`, `run-sim-bot`), `packages/tooling/src/sims/` and `packages/tooling/src/levels/`.
- `test/sims/` and `reports/sim/`. `npm run test:sim` finds no tests and exits 1 (`npm run verify` skips it with `SKIP jest.sim.config.js [test-sim]`). `npm run test:golden` finds no tests and exits 1.
- `npm run verify` is not green and is not expected to be: it passes format:check, lint and typecheck, then stops at `i18n:verify`, whose script arrives at Shell step 6 (E06).

## What we will do

This epic is Shell step 3: all of the pilot game's pure logic, runnable headless in Node and Jest.

- Copy Line Siege v1's rules engine, module by module, test first, from game-rules-engine's canonical example: types, tuning (four level rows plus the endless row at difficulty 100), pieces, board lines, placement, opening, create, list-moves, outcome, monster attack and march, apply-move, continue, the position evaluation, persistence, the statistics counters, intent-to-move (drag plus tap-then-tap) and the assembled engine. Because `rules/line-siege-engine.ts` names `buildTimeline`, the same step copies the three board files the timeline needs from board-rendering-skia's example: `board/build-timeline.ts`, `board/board-ids.ts` and `board/monster-tracks.ts`.
- Add game-balance-and-bots' bot harness and report writer, the greedy bot with the four example states (start, middle, win, lose), and the balance sims with their bands (status `"proposed"`). Prove the fun-within-seconds kill test.
- Add level-generation-and-solvers' witness solver, level plan and level text renderer. Only after the sims pass, generate the three packs of 30 levels with `generate-levels.ts`. Prove every level winnable by replaying its witness line through the real engine, then pin the data goldens: the pack boundary levels and three daily dates, including the year boundary.
- Every file comes from the canonical Line Siege example the skills ship (synced from `skills/_library/shared/line-siege/`), verbatim. Nothing is adapted from the Tap Flip `__GAME_ID__` templates, and no pack file is ever copied.

Not in this epic:
- The save format, migrations and the save service: E04 (Shell step 4).
- The rest of `board/` (layout, drawing, palettes, hit targets, `to-view`, `line-siege-board.ts`), `sounds/`, the gestures and the board pixel goldens: E08 (Shell step 7 manifest). `check-board-files.mjs --game line-siege` is due there, not here.
- `src/index.ts` (the assembled game module), the tutorial and teaching file, `contract.test.ts` and the debug-controls test: E09 (Shell step 7).
- The Shell catalogs and `npm run i18n:verify`: E06.
- Every screen. The Levels (S8), Daily (S9) and Statistics (S10) screens that show packs, stars and counters come in E13; the Game and Result screens (S5, S7) in E12.
- Approving the balance bands. They stay `"proposed"` until the owner's play-test (G6), which never blocks (O6).

## Final state

- [ ] The rules engine passes its contract, with the bot and the example states: `node skills/game-rules-engine/scripts/check-rules-engine.mjs . --game line-siege` prints RESULT: PASS. That covers the engine, `panMode: 'drag'` and `selectRegions: ['tray']`, the persistence round trip, the catalog keys, endless never won, the bot playing seeded games, and start/middle/win/lose matching their outcomes.
- [ ] The game code is the canonical Line Siege v1. These print nothing, or only the differences the epic report names (fixes made in Close the epic):
  - `diff -r -x '*.test.ts' skills/game-rules-engine/examples/line-siege/rules apps/line-siege/src/rules`
  - `diff -r -x '*.test.ts' skills/game-balance-and-bots/examples/line-siege/apps/line-siege/src/testing apps/line-siege/src/testing`
  - `diff -r -x '*.test.ts' skills/level-generation-and-solvers/examples/line-siege/levels apps/line-siege/src/levels`
- [ ] `apps/line-siege/src/board/` holds only the three timeline files and their two tests: `ls apps/line-siege/src/board` prints `board-ids.test.ts board-ids.ts build-timeline.test.ts build-timeline.ts monster-tracks.ts`.
- [ ] The bot harness works: `npx jest packages/game-kit/src/testing packages/tooling/src/sims --ci --selectProjects unit` passes.
- [ ] The game is balanced by the bands: `npm run test:sim` passes and `node skills/game-balance-and-bots/scripts/check-balance.mjs . --game line-siege` prints RESULT: PASS (no cap hits, a falling curve, random < greedy < lookahead, the first payoff within 3 moves in at least 90 % of easy runs, the twist at least once per run, endless never won). `test/sims/line-siege/balance-bands.json` still says `"status": "proposed"`.
- [ ] The packs are generated, not copied, and are current: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/levels/generate-levels.ts --app line-siege --check` exits 0, `npx prettier --check apps/line-siege/src/levels` exits 0, and `ls apps/line-siege/src/levels/pack-*.json` lists exactly three files.
- [ ] Every level is proven winnable and the table matches the config: `node skills/level-generation-and-solvers/scripts/check-levels.mjs . --game line-siege --report` prints RESULT: PASS (90 levels, every witness line replayed, packs equal `game.config.ts`, endless at difficulty 100).
- [ ] The goldens are pinned: `node skills/golden-tests/scripts/check-goldens.mjs .` prints RESULT: PASS and `npm run test:golden` passes. `git log --format=%B -- apps/line-siege/src/levels/line-siege-levels.golden.test.ts.snap.ios` shows a `Gate-Change:` trailer.
- [ ] The gates are green: `npm run -s check:fast`; `npm run test:coverage` (the rules folder at least 95/95/95/90); `check-tests.mjs .`, `check-test-code.mjs .`, `check-boundaries.mjs .`, `check-file-names.mjs .`, `check-code-names.mjs .`, `check-source.mjs .` and `check-spec-refs.mjs .` print RESULT: PASS; `check-gate-wiring.mjs .` prints RESULT: PASS with the same not-yet-due SKIP lines as after E02. The full commands are in T13, step 3.
- [ ] `npm run verify` passes format:check, lint and typecheck and stops only at `i18n:verify` (due in E06). The later steps it would run pass when run one by one (Close the epic, step 1), `test:sim` now among them.
- [ ] The rules and levels resist mutants: `node skills/unit-and-component-tests/scripts/check-mutation-report.mjs reports/stryker/mutation.json` printed RESULT: PASS (score at least 75 %) in T13.
- [ ] The history is clean. On the branch, before the merge, these printed RESULT: PASS (pasted in the report): `check-commits.mjs . --range main..HEAD`, `check-test-edits.mjs . --range main..HEAD` and `check-golden-changes.mjs . --range main..HEAD`. The full commands are in T13, step 4.
- [ ] The evidence report passes: `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e03-line-siege-rules-levels.md --kind slice` prints RESULT: PASS. It carries the Bots line per difficulty, the kill-test verdict, the pack lines from `check-levels --report`, the golden change, and "Play-test Line Siege: still open (step G6)" under "Owner steps (not blocking)".
- [ ] `main` holds the `--no-ff` merge of `epic/e03-line-siege-rules-levels` (`git log --oneline -1 main`), and the branch is deleted.

## Skills to load

Always: `pocket-arcade-index`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`.

For this epic:
- `pocket-arcade-product-spec`: `spec-lookup.mjs` prints the Line Siege rules sheet, the catalogue entry, S5, S7, 8.x, 10, 15.7, D1 and D9 word for word; `check-spec-refs.mjs` checks every spec citation in the copied code.
- `game-rules-engine`: the canonical Line Siege rules example, the engine contract (panMode, selectRegions, endless), the determinism policy, and `check-rules-engine.mjs`.
- `board-rendering-skia`: the three timeline files the engine names (`build-timeline`, `board-ids`, `monster-tracks`), the only board code in this step.
- `game-balance-and-bots`: the bot harness and report writer, the greedy bot and example states, the sims and bands, the kill test, and `check-balance.mjs`.
- `level-generation-and-solvers`: the witness solver, the level plan, `describeLevel`, `generate-levels.ts`, the `LevelsSpec` with the daily and endless, and `check-levels.mjs`.
- `golden-tests`: the `-u` policy (one file, path first), reading the snapshot, the frozen daily contract, the `Gate-Change:` trailer, `check-goldens.mjs` and `check-golden-changes.mjs`.
- `i18n-strings-and-catalogs`: confirms every key the rules name is in all four catalogs (`check-catalogs.mjs`) and keeps fa and ckb on the owner's review list.
- `unit-and-component-tests`: the Jest projects, the subset coverage runs, Stryker, `check-test-code.mjs` and `check-mutation-report.mjs`.
- `typescript-and-lint-rules`: tsc, ESLint and Prettier on the copied files, and `check-source.mjs`.
- `naming-conventions`: `check-file-names.mjs` and `check-code-names.mjs` over the new folders.
- `architecture-and-boundaries`: `check-boundaries.mjs`. Rules and levels import only game-kit and their own folders; the engine may import `board/build-timeline.ts`; nothing imports tooling except `test/`; no cycles.
- `troubleshooting-playbook`: `find-fix.mjs --text "<first error line>"` whenever a command fails.

## How we work in this epic

1. Branch: `git switch main && git pull && git switch -c epic/e03-line-siege-rules-levels`. Push the branch after each task. Two limits apply. A push needs the owner's word in the session (git-commits-and-reporting rule 5). And the pre-push hook runs `npm run verify`, which stays red at `i18n:verify` until E06 and at `audit:network` until E10. If the hook refuses a push for that reason, keep the commits local. Never bypass it (`--no-verify`, `LEFTHOOK=0`).
2. Test first, always. Write each task's "Tests first" items, run them and watch them fail for the right reason, write the minimum code to pass, then refactor. Never weaken or edit a test to make it pass.
3. Commit each task in Conventional Commits form, with the trailers the skills ask for (Gate-Change:, Spec-Change:). `npm run -s check:fast` must be green before every commit. Write the message to `reports/commit-message.txt` and check it first with `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged`. Scopes: `line-siege`, `game-kit`, `tooling`. A `feat` commit names its spec lines in the body and includes the test it was built against: check-test-edits fails a `feat` that changes code without a test. `Gate-Change:` goes on exactly the commits that stage a gated path. In this epic that is normally only the golden snapshot (T12); the pack files are not gated, and a needless trailer fails `gate-change-unneeded`.
4. Screens: a task that builds or changes a screen is not done until the app's capture matches the Toybox design screenshot for every frame it names, in light-en, light-fa, dark-en and dark-fa at every scroll offset, and check-signoff passes for those frames. No task in this epic builds or changes a screen, so no task has a "Design match" line. Screens start in E11.
5. Stop and ask the owner only at a step marked **Owner**. In this epic there are two, and both are conditional: T09 (only if the kill test fails) and T14 (only if a review finding would change a daily board or needs a gate or spec change). Use git-commits-and-reporting's `templates/owner-request.md`, check it with `check-report.mjs <file> --kind request`, and keep working on what does not depend on the answer.
6. Copied code is still test-first. Almost every file here is copied verbatim from a canonical example, so each module goes through this loop:
   - Copy its test file and run it: `npx jest <test file> --ci --selectProjects unit` (path first: `--selectProjects` swallows every following word).
   - A missing module is the wrong reason to fail. Add a typed stub with the same exports that returns a wrong value, and rerun until the failure is an assertion diff (`Expected ... Received ...`). Keep those red lines in `reports/plans/e03-line-siege.md` for the report.
   - Copy the canonical module over the stub and see it green.
   - Never copy a Tap Flip `__GAME_ID__` template, and never edit a copied test.
   - The pre-commit hook type-checks the whole repo, so commit only when every import of a staged file resolves.
7. When anything fails, look it up before guessing: `node skills/troubleshooting-playbook/scripts/find-fix.mjs --text "<first error line>"`.

## Tasks

### E03-T01 · Quote the pilot's rules and write the slice plan
- **Goal:** Start from the spec's own words, not memory, and fix the classification every later test proves. Line Siege is turn-based. Its board takes a drag (`panMode: 'drag'`) and tap-then-tap with `selectRegions: ['tray']`: a tray tap only selects, and is never a move. Difficulty 100 is the endless run, which is never won. One continue rescues both losses. There are no hints (the game fact "has hints" is false, L8). Undo is unlimited. This task writes no code.
- **Skills:** `pocket-arcade-product-spec`, `pocket-arcade-index`, `tdd-workflow`, `game-rules-engine`.
- **Tests first:** None, because this task writes no code. The plan names the first failing test of every later task. The classification below maps onto the titles of the tests that T03 to T12 copy, so the first test titles carry it.
- **Build:**
  1. Start from green (tdd-workflow step 0): `git status`, `git log --oneline -10`, note `git rev-parse --short HEAD` as `<base>`, then `npm run -s check:fast` and `node skills/game-rules-engine/scripts/check-rules-engine.mjs .` (E02's kit check).
  2. Print the spec: `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs line-siege-rules line-siege S5 S7 8.1 8.2 8.3 8.4 8.10 8.13 10 15.7 D1 D9`. Read docs/99-final-decisions.md section H for L4 (the march text), L8 (no Hint key), L11 (a finished run is never stranded) and O6 (owner steps never block). L4 has no spec-lookup ID; its texts are in the rules sheet under "What the player sees and hears".
  3. Prove the copy sources are the canonical code. Each of these prints nothing:
     - `diff -r skills/game-rules-engine/examples/line-siege/rules skills/_library/shared/line-siege/rules`
     - `diff -r skills/game-balance-and-bots/examples/line-siege/apps/line-siege/src/testing skills/_library/shared/line-siege/testing`
     - `diff -r skills/level-generation-and-solvers/examples/line-siege/levels skills/_library/shared/line-siege/levels`
     - `for f in build-timeline.ts build-timeline.test.ts board-ids.ts board-ids.test.ts monster-tracks.ts; do cmp skills/board-rendering-skia/examples/line-siege/board/$f skills/_library/shared/line-siege/board/$f; done`
     - `diff -r skills/game-balance-and-bots/examples/line-siege/test/sims/line-siege skills/_library/shared/line-siege/test/sims`
  4. Check the scaffold's config against the rules sheet: `grep -nE "modes|levels:|freePerDay|isContinueAllowed|violenceCartoonOrFantasy" apps/line-siege/game.config.ts` shows daily and endless on, 3 packs of 30, 0 free hints, continue allowed and `INFREQUENT_OR_MILD`.
  5. Write `reports/plans/e03-line-siege.md` from `skills/tdd-workflow/templates/slice-plan.md`: the behaviour in one sentence, the quoted spec lines, the task order with each task's first failing test, the evidence list, and this classification table (fact, value, the copied test that proves it):

     | Fact | Value | Proven by (file: title) |
     |---|---|---|
     | Game class | turn-based: one placement per move, then the board plays the events | `apply-move.test.ts`: "places the block, uses its tray slot and counts the placement" |
     | Drag input | `panMode: 'drag'` | `intent-to-move.test.ts`: "places the dragged tray block with its top-start cell where the finger lets go" |
     | Tap-then-tap | `selectRegions: ['tray']`; a selection is UI state | `intent-to-move.test.ts`: "selects only on a tray tap and ignores a board tap without a selection" |
     | Endless | difficulty 100, goal 0, never won | `line-siege-tuning.test.ts`: "gives the endless row (goal 0, never won) at the endless difficulty"; `outcome.test.ts`: "keeps the endless run playing even when the lanes are empty" |
     | Two losses | `line-siege.lose.broke-through` (checked first), `line-siege.lose.board-full`; a win beats a full board | `outcome.test.ts`: "reports the breach of the last heart as a loss even when the wave is over", "lets a win beat a full board: the last clear counts" |
     | Continue (8.10) | once per run, rescues both losses | `continue-run.test.ts`: "turns every lost run from seeded random play into a run that is no longer lost" |
     | Hints, undo | no hints (L8), unlimited undo, one continue | `line-siege-engine.test.ts`: "allows unlimited undo, no hints and one continue that pushes the monsters back" |
     | Score (8.4) | `state.score`: lines² x 10 + 25 per defeated monster | `apply-move.test.ts`: "clears it, fires the beam, defeats the weak monster and scores" |
     | Counters (10 STATISTICS) | `monsters-defeated`, `beams-fired`, `biggest-combo` | `line-siege-stats.test.ts`: "declares 2 to 4 counters with unique kebab-case ids and labels in the catalog" |
     | Levels (8.1, D9) | 3 packs x 30, witness-proven, at least 8 placements, stars [0, witness score, +20 %] | `line-siege-levels.test.ts`: "proves every shipped level winnable by the witness, with packs matching the config" |
     | Daily (8.3) | salt `0xe8c0`, difficulty 45 | `line-siege-levels.test.ts`: "starts the daily challenge at the daily difficulty from the date and salt" |
     | March text (L4) | `marchEvery` at least 2 in every row | `line-siege-tuning.test.ts`: "marches every 2 or more placements, so the teaching copy "every few blocks" stays true" |

  There is nothing to commit: `reports/` is gitignored, and the plan feeds the T13 report.
- **Done when:** the spec-lookup run ends with `spec-lookup: 14 IDs checked, 0 problems` and `RESULT: PASS`; the five comparisons in step 3 print nothing; `npm run -s check:fast` passes and `check-rules-engine.mjs .` prints RESULT: PASS; `reports/plans/e03-line-siege.md` has all twelve rows filled.

### E03-T02 · Balance harness and sim report writer
- **Goal:** Add the headless harness every sim and the witness solver use: `traceBot`, the three standard players (random, greedy, lookahead), the sim statistics, the bands judge and parser, the real-time `runSimBot`, and the Node-side report writer, whose fingerprint ties a report to the code it measured (spec 8.13).
- **Skills:** `game-balance-and-bots`, `unit-and-component-tests`, `tdd-workflow`, `quality-gates`.
- **Tests first:** Record the red gate first: `node skills/game-balance-and-bots/scripts/check-balance.mjs .` prints `harness-missing` lines. Then, in import order, copy each test from `skills/game-balance-and-bots/templates/` and see it red on an assertion (stub first):
  - `packages/game-kit/src/testing/trace-bot.test.ts`: plays exactly the game `playBot` plays, records when the first payoff happened and how often each tag fired, and flags a run that hit `maxMoves`.
  - `packages/game-kit/src/testing/bot-policies.test.ts`: greedy takes the best-looking move and breaks ties with its own seeded RNG; it prefers any position to a lost one; lookahead sees past the bait and equals greedy at depth 1.
  - `packages/game-kit/src/testing/sim-stats.test.ts`: percentiles take the lower middle value; numbers are rounded to four places; `summarizeCell` sums wins, spreads, per-run counts and the first-payoff curve, and refuses an empty cell.
  - `packages/game-kit/src/testing/balance-bands.test.ts`: `bandProblems` accepts a report inside every band. It reports an out-of-band number, a flat curve, a missing skill gap, a slow first payoff, a missing twist, capped runs and missing cells, and a won or out-of-band endless cell. It accepts a step of exactly `minStep`.
  - `packages/game-kit/src/testing/parse-balance-bands.test.ts`: a valid bands file comes back typed; every problem of a broken file is listed in one error; difficulty 100 is refused in the grid; approved bands need `approvedOn`.
  - `packages/game-kit/src/testing/run-sim-bot.test.ts`: fixed ticks run until the outcome, the payoff is counted in `payoffStepTicks` steps, the same seed gives the same trace, and a run still playing at `maxTicks` is capped.
  - `packages/tooling/src/sims/write-sim-report.test.ts`: the fingerprint covers the game folders, the sim and only the game-kit files they import. An unrelated kit file, the generated packs, unit tests and the bands leave it unchanged. A rules or level-plan file, or a kit file reached through another kit file, changes it. The report is two-space JSON with a trailing newline.
- **Build:** This is Shell step 3's manifest entry "game-balance-and-bots: `packages/game-kit/src/testing/**`, `packages/tooling/src/sims/**`". Copy verbatim from `skills/game-balance-and-bots/templates/`, in this order: `trace-bot.ts`, `bot-policies.ts`, `sim-stats.ts`, `balance-bands.ts`, `parse-balance-bands.ts`, `run-sim-bot.ts` (into `packages/game-kit/src/testing/`), then `write-sim-report.ts` (into `packages/tooling/src/sims/`).
  - `play-bot.ts` is already in place from E02; `cmp packages/game-kit/src/testing/play-bot.ts skills/game-balance-and-bots/templates/packages/game-kit/src/testing/play-bot.ts` prints nothing, so keep it.
  - E01 already shipped the sim config. Confirm it: `cmp jest.sim.config.js skills/game-balance-and-bots/templates/jest.sim.config.js` prints nothing, `grep -n '"test:sim"' package.json` shows `jest --ci --config jest.sim.config.js`, and `grep -n 'sim' jest.config.js` shows the unit project ignoring `\\.sim\\.test\\.`.
  - Only if check-balance prints a `sim-config` line, restore the missing piece from the template verbatim in its own `chore(repo)` commit. `jest.sim.config.js` and `jest.config.js` are gated paths, so that commit carries `Gate-Change: restore the bootstrap's sim config`.
  - Commits: `feat(game-kit): add the bot harness for balance sims` (body: spec 8.13) and `feat(tooling): write sim reports with a rules fingerprint`.
- **Done when:**
  - `npx jest packages/game-kit/src/testing packages/tooling/src/sims --ci --selectProjects unit` passes.
  - `node skills/game-balance-and-bots/scripts/check-balance.mjs .` prints no `harness-missing`, `harness-outdated` or `sim-config` line. The game lines close in T09.
  - `npx tsc --noEmit -p packages/game-kit` and `npx tsc --noEmit -p packages/tooling` pass.
  - `node skills/tdd-workflow/scripts/check-tests.mjs .` prints RESULT: PASS.
  - `npm run -s check:fast` is green.

### E03-T03 · Rules foundations: types, tuning, pieces, board lines and the opening
- **Goal:** Land the bottom layer of the rules, which every later module imports: the JSON-safe state types, the one tuning file with every balance number (`rowFor` + `reduce` over four level rows, plus the endless row at difficulty 100), the 10 fixed pieces and the seeded tray draw, line detection and clearing on the 8 x 8 board, and the prepared opening (spec 13; line-siege-rules "The board, the lanes and the tray", "The pieces"; L4).
- **Skills:** `game-rules-engine`, `game-balance-and-bots`, `tdd-workflow`, `unit-and-component-tests`, `typescript-and-lint-rules`, `architecture-and-boundaries`.
- **Tests first:** Copy each test from `skills/game-rules-engine/examples/line-siege/rules/` to `apps/line-siege/src/rules/` and see it red on an assertion before its module:
  - `line-siege-tuning.test.ts`: `knobsFor(100)` is the endless row (goal 0, never won); 0..99 maps onto the four rows (0-24, 25-49, 50-74, 75-99) in equal bands, easiest first; values below the scale clamp to the easiest row; every harder row is at least as hard in every knob; `marchEvery` is at least 2 in every row, so the L4 teaching copy "every few blocks" stays true.
  - `pieces.test.ts`: about ten shapes, each anchored at its top-start cell; `pieceAt` returns a shape and throws outside the list; `drawTray` draws three indices from the seeded stream, the same for the same RNG state; pinned `GOLDEN_SEED_7_TRAY`.
  - `board-lines.test.ts`: `coveredCells` lists a piece's cells, or `null` off the board or on a filled cell; `fullLines` finds every full row and column; `clearLines` empties them at once (a crossing cell counts once); pinned `GOLDEN_CROSS_CLEARED`.
  - `opening.test.ts`: both gaps stay off the crossing of the prepared column and row; the prepared lines are two cells short; the scatter never completes a line; a monster one beam defeats waits one row down the prepared lane; pinned `GOLDEN_SEED_1_MONSTERS`.
- **Build:** Shell step 3's manifest entry "game-rules-engine: `apps/line-siege/src/rules/**`", first part. Copy verbatim from `skills/game-rules-engine/examples/line-siege/rules/`:
  - `line-siege-types.ts` first. It holds types only and has no test; nothing else compiles without it.
  - Then `line-siege-tuning.ts`, `pieces.ts`, `board-lines.ts` and `opening.ts`, each after its test.
  - Do not copy any of game-rules-engine's `templates/apps/__GAME_ID__/` files (Tap Flip's `flip-cells` and friends).
  - Commits: `feat(line-siege): add the state types and tuning rows` (spec 13, 8.2 endless; line-siege-rules "Difficulty, levels, the daily and endless"; L4) and `feat(line-siege): add pieces, board lines and the opening` (spec 13).
- **Done when:**
  - `npx jest apps/line-siege/src/rules --ci --selectProjects unit` passes.
  - `npx tsc --noEmit -p apps/line-siege` passes.
  - `npx eslint --max-warnings 0 apps/line-siege` and `npx prettier --check apps/line-siege/src` pass.
  - `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` prints RESULT: PASS (`rules-pure`: only game-kit and the rules folder are imported).
  - `diff -r -x '*.test.ts' skills/game-rules-engine/examples/line-siege/rules apps/line-siege/src/rules` lists only the files later tasks add ("Only in ...examples...").
  - `npm run -s check:fast` is green.

### E03-T04 · Start state, legal moves and the outcome
- **Goal:** `create(seed, difficulty)` builds the same level for the same seed on every device (spec 8.1, 10 RULES "Start state"). `listMoves` lists every fitting placement in a fixed order and nothing once the run is over. `outcome` reports, in this order: lost by breach, won when the wave is over (never at difficulty 100), lost when no block fits, else playing (spec 13; line-siege-rules "Winning, losing and the score").
- **Skills:** `game-rules-engine`, `tdd-workflow`, `unit-and-component-tests`, `architecture-and-boundaries`.
- **Tests first:** Copy from `skills/game-rules-engine/examples/line-siege/rules/`, in this order:
  - `create.test.ts`: the difficulty is stored whole and inside 0..100; one 8 x 8 board, three hearts, three offered blocks and three monsters; one column and one row prepared two cells short, with the two bars in the tray; a monster one beam can defeat in the prepared lane. Properties: same seed and difficulty give the same state; no full line at the start, with three monsters in three lanes. Pinned `GOLDEN_SEED_1_OPENING`.
  - `placement.test.ts`: `hasAnyMove` finds a fitting block among used slots and nothing when no block fits; it agrees with `fittingMoves` on random boards (property); pinned `GOLDEN_CROWDED_FITS` (9).
  - `outcome.test.ts`: playing while hearts, wave and a fitting block remain; lost with `line-siege.lose.broke-through` when the last heart goes, even when the wave is over; won with the score once the wave is gone; playing while wave monsters are still to come; endless keeps playing with empty lanes; lost with `line-siege.lose.board-full` when nothing fits; a win beats a full board.
  - `list-moves.test.ts`: every fitting anchor of every offered block, slot by slot, row by row; nothing once lost; pinned `GOLDEN_SEED_1_MOVE_COUNT` (91).
- **Build:** Copy verbatim from `skills/game-rules-engine/examples/line-siege/rules/`: `create.ts`, then `placement.ts`, `outcome.ts` and `list-moves.ts`, each after its test. `placement.test.ts` and `outcome.test.ts` import `create.ts`, so `create` lands first. Commits: `feat(line-siege): create the seeded opening of a level` (spec 8.1, 10 RULES) and `feat(line-siege): list legal placements and judge the outcome` (spec 13, 8.2 endless).
- **Done when:**
  - `npx jest apps/line-siege/src/rules --ci --selectProjects unit` passes.
  - `npx tsc --noEmit -p apps/line-siege` passes.
  - `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` prints RESULT: PASS.
  - `npm run -s check:fast` is green.

### E03-T05 · One placement turn, the monsters and the continue
- **Goal:** `applyMove` runs a whole placement in the sheet's order. It places the block, clears full lines, fires a beam per cleared column (8 damage to the monster nearest the wall), sends a shockwave per cleared row (2 to every non-armoured monster), scores lines² x 10 + 25 per defeat, marches on every `marchEvery`-th placement, takes a heart per breach, spawns from the run's RNG and refills the tray. It throws `RangeError` for an illegal move and never changes its input. `continueAfterLoss` rescues both losses once (spec 8.10, line-siege-rules "Continue, hints and undo").
- **Skills:** `game-rules-engine`, `tdd-workflow`, `unit-and-component-tests`, `architecture-and-boundaries`.
- **Tests first:** Copy from `skills/game-rules-engine/examples/line-siege/rules/`:
  - `monster-attack.test.ts`: a beam hits the monster closest to the wall, the lower id on a tie, and nothing in an empty lane; a defeat reports where the monster stood; a shockwave hits every monster once per cleared row but bounces off armoured ones; beams go first, so a monster a beam defeated takes no shockwave; health never rises. Pinned `GOLDEN_DOUBLE_CLEAR`.
  - `monster-march.test.ts`: a march moves monsters one row (fast ones two) only on march placements; a breach costs a heart and removes the monster; hearts stop at zero; a spawn enters at the far end of a seeded lane, at once when the lanes are empty, and stops once the wave has entered; endless keeps spawning with rising health; health and kind stay inside the difficulty row. Pinned `GOLDEN_SEED_5_SPAWN`.
  - `apply-move.test.ts`: examples for placing, a column clear (beam, defeat, score), a row clear (shockwave), the tray refill, the march cadence and a breach; `RangeError` for a block that does not fit, an empty or missing slot, and a finished run. Properties: identical replays, the score rising and hearts falling with no full line left behind, no moves exactly when the run is over, a JSON round trip, the input untouched. Pinned `GOLDEN_SEED_3_EVENTS`.
  - `continue-run.test.ts`: after a breach, one heart back and every monster pushed back three rows (never past row 0), with board, score and placements kept; with a full board, the two fullest rows emptied without scoring and the tray redrawn; the single block in the first slot when nothing redrawn fits; every lost run from seeded random play is no longer lost. `fullestRows` picks the rows with the most blocks, with pinned `GOLDEN_FULLEST_ROWS`.
- **Build:** Copy verbatim from `skills/game-rules-engine/examples/line-siege/rules/`: `monster-attack.ts`, `monster-march.ts`, `apply-move.ts` and `continue-run.ts`, each after its test. Commits:
  - `feat(line-siege): fire beams and shockwaves at the monsters` (spec 13)
  - `feat(line-siege): march, breach and spawn the monsters` (spec 13)
  - `feat(line-siege): apply one placement turn` (spec 10 RULES, 8.13)
  - `feat(line-siege): continue once after either loss` (spec 8.10)
- **Done when:**
  - `npx jest apps/line-siege/src/rules --ci --selectProjects unit` passes.
  - `npx tsc --noEmit -p apps/line-siege` passes.
  - `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` prints RESULT: PASS.
  - `npm run -s check:fast` is green.

### E03-T06 · Position evaluation, persistence and statistics counters
- **Goal:** Add the three rules-side helpers the rest of the epic needs:
  - The evaluation the greedy bot and the level witness share. It lives in `rules/` because `levels/` may not import `testing/`.
  - `parseState` and `parseMove` for the save written after every move. They rebuild typed values with explicit checks and never cast (spec 8.6, 8.13).
  - The three statistics counters with catalog labels (spec 10 STATISTICS, S10).
- **Skills:** `game-rules-engine`, `tdd-workflow`, `unit-and-component-tests`, `i18n-strings-and-catalogs`.
- **Tests first:** Copy from `skills/game-rules-engine/examples/line-siege/rules/`:
  - `line-siege-evaluate.test.ts`: values a defeat above a closer monster, and a heart above a crowded board.
  - `line-siege-persistence.test.ts`: a saved state, or any state reached by play, comes back unchanged after a JSON round trip; a logged placement parses; a run saved in an older state version is dropped; the game saves after every move. Pinned `GOLDEN_STATE_VERSION` (1).
  - `line-siege-stats.test.ts`: one move measures monsters defeated, beams fired and lines cleared at once; a placement that clears nothing measures zero; 2 to 4 counters with unique kebab-case ids, each label present in `apps/line-siege/src/i18n/en.json`.
- **Build:** Copy verbatim from `skills/game-rules-engine/examples/line-siege/rules/`: `line-siege-evaluate.ts`, `line-siege-persistence.ts` and `line-siege-stats.ts`, each after its test. The stats test reads the E01 catalog. If a label is missing, see T07's catalog step. Commits:
  - `feat(line-siege): value positions as a reasonable player does` (spec 8.13)
  - `feat(line-siege): restore saved runs and logged moves` (spec 8.6)
  - `feat(line-siege): count defeats, beams and the biggest combo` (spec 10 STATISTICS, S10)
- **Done when:**
  - `npx jest apps/line-siege/src/rules --ci --selectProjects unit` passes.
  - `npx tsc --noEmit -p apps/line-siege` passes.
  - `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` prints RESULT: PASS.
  - `npm run -s check:fast` is green.

### E03-T07 · Input, the timeline files and the assembled engine
- **Goal:** Finish the rules folder and assemble the engine:
  - `intentToMove` turns a drag, or a tray tap followed by a board tap, into a `place-block` move, and only into moves `listMoves` offers.
  - The board's turn timeline turns events into tracks and the six sound cues; these are the only board files at Shell step 3.
  - `LINE_SIEGE_ENGINE` sets `panMode: 'drag'`, `selectRegions: ['tray']` and `buildTimeline`.
  - `LINE_SIEGE_RULES` gives the HUD (score and "Monsters {defeated} / {total}", or the endless line), unlimited undo, no hints and one push-back continue (spec 10 RULES, BOARD AND CONTROLS; 13 controls; S5, L8).
- **Skills:** `game-rules-engine`, `board-rendering-skia`, `i18n-strings-and-catalogs`, `tdd-workflow`, `unit-and-component-tests`, `architecture-and-boundaries`.
- **Tests first:**
  - `apps/line-siege/src/rules/intent-to-move.test.ts` (from game-rules-engine's example): places the dragged block with its top-start cell where the finger lets go; reads the slot from the row when the tray stands beside the board; refuses a block that does not fit, a drop off the board, a drag that starts on the board and a used slot; places the selected slot's block on the next tap (tap-then-tap); selects only on a tray tap and ignores a board tap without a selection; ignores long presses, swipes and aims; returns only moves `listMoves` offers.
  - `apps/line-siege/src/board/board-ids.test.ts` (from `skills/board-rendering-skia/examples/line-siege/board/`): every cell and heart gets its own entity, apart from lanes, monsters and the turn; monster kinds map to track indices, and an unknown kind draws as normal.
  - `apps/line-siege/src/board/build-timeline.test.ts` (same source):
    - the busiest turn stays within the animation budget;
    - reduced motion drops particles, shake and overshoot, and plays shorter;
    - one place cue and a light haptic per block;
    - each cleared cell fades once;
    - a breaching monster walks into the wall;
    - only the six bank sounds are cued, each with its haptic;
    - a breach shrinks a heart;
    - the continue plays silently.
  - `apps/line-siege/src/rules/line-siege-engine.test.ts` (from game-rules-engine's example): `engineContractProblems` returns `[]` over seeded games at every level row and endless, fed the real intents (taps with `selected: null`, tray taps, drags); the top bar shows the score and defeated against the wave, and only the defeated count in endless; unlimited undo, no hints, one continue.
- **Build:** Copy verbatim, each after its test:
  - `intent-to-move.ts` from `skills/game-rules-engine/examples/line-siege/rules/`.
  - The three board files (Shell step 3 manifest entry "board-rendering-skia: `apps/line-siege/src/board/build-timeline*`, `board-ids*`, `monster-tracks.ts`"): `board-ids.ts`, `monster-tracks.ts` and `build-timeline.ts` from `skills/board-rendering-skia/examples/line-siege/board/` into `apps/line-siege/src/board/`. `monster-tracks.ts` has no test of its own; `build-timeline.test.ts` covers it, so the three land in one commit. Copy nothing else from that folder.
  - `line-siege-engine.ts` last.
  - Catalog keys: they came with E01's canonical catalogs, so confirm them rather than add them. `node skills/i18n-strings-and-catalogs/scripts/check-catalogs.mjs apps/line-siege/src/i18n` must print RESULT: PASS, and check-rules-engine must print no `catalog-key-missing` line. Only if a key the rules name is missing (`line-siege.lose.broke-through`, `.lose.board-full`, `.progress`, `.progress.endless`, `.continue.push-back`, `.board.summary`, `.stats.monsters-defeated`, `.stats.beams-fired`, `.stats.biggest-combo`), add it in all four languages from `skills/game-rules-engine/examples/line-siege/i18n/<lang>.json`, keep the files sorted, and put the fa and ckb texts on the owner's review list (O6, never blocking).
  - Format and lint: `npx eslint --fix apps/line-siege` and `npx prettier --write apps/line-siege/src` must change nothing (`git status` stays clean). If either changes a file, compare it with its source before committing.
  - Commits:
    - `feat(line-siege): read drags and tap-then-tap as placements` (spec 13 controls, 10 BOARD AND CONTROLS)
    - `feat(line-siege): build the turn timeline the board plays` (spec 10 BOARD AND CONTROLS)
    - `feat(line-siege): assemble the rules engine` (spec 10 RULES, S5, L8)
- **Done when:**
  - `npx jest apps/line-siege/src/rules apps/line-siege/src/board --ci --selectProjects unit` passes.
  - `npx jest apps/line-siege/src/rules --ci --selectProjects unit --coverage --collectCoverageFrom='apps/line-siege/src/rules/**/*.ts' --coverageThreshold='{}'` reads at least 95/95/95/90 on its "All files" line.
  - `node skills/game-rules-engine/scripts/check-rules-engine.mjs . --game line-siege` prints RESULT: PASS. Before T08 it plays the rules with random moves; the bot joins in T08.
  - `node skills/i18n-strings-and-catalogs/scripts/check-catalogs.mjs apps/line-siege/src/i18n` prints RESULT: PASS.
  - `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` prints RESULT: PASS (`rules-pure` allows the engine's `board/build-timeline.ts` import).
  - `npm run test:coverage` passes; the rules threshold of 95/95/95/90 is now live.
  - `node skills/tdd-workflow/scripts/check-tests.mjs .` prints RESULT: PASS.
  - `npm run -s check:fast` is green.

### E03-T08 · The greedy bot and the four example states
- **Goal:** Add the game's testing spec (spec 10 TESTING): the bot hooks (payoff = a defeat, twist = a beam that hits, the score = `state.score`), the greedy "reasonable player" used as `testing.bot` and later as the level witness, and the example states start, middle, win and lose for screenshots and debug tools.
- **Skills:** `game-balance-and-bots`, `game-rules-engine`, `tdd-workflow`, `unit-and-component-tests`, `architecture-and-boundaries`.
- **Tests first:** Copy from `skills/game-balance-and-bots/examples/line-siege/apps/line-siege/src/testing/` to `apps/line-siege/src/testing/`:
  - `line-siege-bot.test.ts`: tags defeats as the payoff and beams that hit as the twist; reports the points the top bar shows; fires the prepared beam and defeats a monster on its first move.
  - `line-siege-testing.test.ts`: every example state has the outcome its name promises (spec 10 TESTING); the middle example shows a defeated monster; the bot is the greedy player and picks a legal move; every bot game, endless included, ends within the move limit.
- **Build:** Shell step 3's manifest entry "game-balance-and-bots: `apps/line-siege/src/testing/**`". Copy `line-siege-bot.ts` and `line-siege-testing.ts` verbatim, each after its test. The bot re-exports `evaluateLineSiege` from `rules/line-siege-evaluate.ts` (T06). Do not copy game-rules-engine's Tap Flip `__GAME_ID__-testing` template. Commit: `feat(line-siege): add the greedy bot and four example states` (spec 10 TESTING, 8.13).
- **Done when:**
  - `npx jest apps/line-siege/src/testing --ci --selectProjects unit` passes.
  - `node skills/game-rules-engine/scripts/check-rules-engine.mjs . --game line-siege` prints RESULT: PASS. It now also runs `testing-bot` and `testing-examples`, playing seeds 1-3 at difficulties 0, 50 and 100 with the bot.
  - `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` prints RESULT: PASS.
  - `npm run -s check:fast` is green.

### E03-T09 · Balance sims, proposed bands and the kill test
- **Goal:** Prove with 100 seeds per cell that Line Siege is balanced before any level exists (spec 8.13, 15.7):
  - no run hits the 400-move cap;
  - greedy's win rate falls by at least 0.1 per difficulty row;
  - random < greedy < lookahead at difficulty 25 by at least 0.15;
  - the first payoff comes within 3 moves in at least 90 % of easy greedy runs;
  - the twist fires at least once per run;
  - endless runs are never won and stay inside their own bands.
- **Skills:** `game-balance-and-bots`, `tdd-workflow`, `troubleshooting-playbook`, `git-commits-and-reporting`.
- **Tests first:** The sim file is itself the test. Its red is the gate: `node skills/game-balance-and-bots/scripts/check-balance.mjs . --game line-siege` prints FAIL lines for `sim-missing`, `bands-missing` and `report-missing`; keep them for the report.
  - `test/sims/line-siege/balance.sim.test.ts` plays every (policy, difficulty) cell, writes `reports/sim/line-siege.json` before asserting, ends every run before the cap, replays identically for the same seeds, and stays inside every band.
  - `test/sims/line-siege/balance-bands.json` is the contract:
    - grid random and greedy `[0, 25, 50, 75]`, lookahead `[25]` (the tuning rows' lower bounds);
    - the endless block at difficulty 100 with bands on `medianMoves`, `medianScore` and `twistPerRun`;
    - `"status": "proposed"`, `"approvedOn": null`.
- **Build:** Shell step 3's manifest entry "game-balance-and-bots: `test/sims/line-siege/**`". Copy both files verbatim from `skills/game-balance-and-bots/examples/line-siege/test/sims/line-siege/`. Do not copy the example's `reports/sim/line-siege.json`: the run writes it, and `reports/` is gitignored.
  - Run `npx jest test/sims/line-siege --ci --config jest.sim.config.js` (about 60 s; the path comes first), then `npm run test:sim`.
  - Compare with the canonical run (same code, same seeds): `node -e "const a=require('./reports/sim/line-siege.json'),b=require('./skills/game-balance-and-bots/examples/line-siege/reports/sim/line-siege.json');process.exit(JSON.stringify(a.cells)===JSON.stringify(b.cells)?0:1)"` exits 0. Expected numbers:
    - greedy wins 0.73, 0.56, 0.39 and 0.14 at difficulties 0, 25, 50 and 75;
    - random wins 0.22, 0.14, 0.11 and 0.02;
    - lookahead wins 1.0 at 25;
    - greedy endless runs last a median 26 placements, score a median 185 and hit 2.35 beams per run.
  - Kill-test verdict (game-balance-and-bots rule 9), read from the report: greedy at difficulty 0 has `firstPayoffShare[2]` (within 3 moves) at least 0.9 (expected 1), and `twistPerRun` at difficulty 25 is at least 1 (expected 1.56). Write the verdict and a plain-words Bots line per difficulty into `reports/plans/e03-line-siege.md`.
  - Never widen a band, cut or change seeds, or tune the bot to go green (rule 8, rule 11). A failure is read with `lossReasons` and the tuning playbook, and only the tuning file may change. A tuning change reruns T03 to T08's tests and this sim.
  - Commit: `test(line-siege): add balance sims with proposed bands` (body: spec 8.13, 15.7, D1).
- **Done when:**
  - `npm run test:sim` passes.
  - `node skills/game-balance-and-bots/scripts/check-balance.mjs . --game line-siege` prints RESULT: PASS.
  - The `node -e` comparison exits 0.
  - The kill-test verdict is written.
  - `npm run -s check:fast` is green.
- **Owner:** Only if the kill test fails: the first payoff or the twist does not come even for the lookahead bot after reasonable tuning (not expected: this is the canonical code, measured at 1.0 and 1.56). Send one owner request (rule 9, fun-and-kill-test.md "When a game fails"). Meanwhile keep the bands as they are, generate no packs, and finish what does not depend on the tuning (the T10 code).

### E03-T10 · Witness solver, level plan and the level text
- **Goal:** Line Siege draws its future at random, so it has no exact solver. Each level is proven by a witness: the greedy bot from the fixed seed `0x5bd1e995`, within 60,000 nodes, its line replayed through the real engine. The plan:
  - rises difficulty from 0 at level 1 to 99 at level 90 (`floor((level - 1) x 99 / 89)`);
  - rejects a level the witness wins in fewer than 8 placements;
  - rates stars by score: [0, the witness score, that score + 20 %];
  - names three packs of 30 by catalog keys.
  `describeLevel` renders a level as readable text for the goldens (spec 8.1, 10 LEVELS, D9).
- **Skills:** `level-generation-and-solvers`, `game-balance-and-bots`, `tdd-workflow`, `unit-and-component-tests`, `architecture-and-boundaries`.
- **Tests first:** Copy from `skills/level-generation-and-solvers/examples/line-siege/levels/` to `apps/line-siege/src/levels/`:
  - `line-siege-solver.test.ts`: wins seed 1 at difficulty 0 with a line the engine replays into a won state; stops at the node budget; reports a lost witness as over budget, never as unsolvable; lines win when replayed through the real engine, deterministically (property).
  - `line-siege-level-plan.test.ts`: `difficultyFor` rises from 0 to the top row without falling, stays below the endless difficulty and clamps level numbers; `scoreThresholds` lets any score win, gives 2 stars at the witness score and 3 stars 20 % above it, and stays strictly ascending for tiny scores; the plan rates by the witness's final score, rejects too-quick wins and declares three packs of thirty named by catalog keys.
  - `line-siege-describe.test.ts`: shows the hearts and tray, then the lanes with kind and health, then the board.
- **Build:** Shell step 3's manifest entry "level-generation-and-solvers: `apps/line-siege/src/levels/**` (not `pack-*.json`)", first part. Copy `line-siege-solver.ts`, `line-siege-level-plan.ts` and `line-siege-describe.ts` verbatim, each after its test.
  - Not yet: `line-siege-levels.ts` imports the packs, so it comes with them in T11. The golden test comes in T12. No Tap Flip `__GAME_ID__-solver` template.
  - These files join the sim report's fingerprint (all of `levels/` except the packs), so rerun the sims before committing.
  - Commits: `feat(line-siege): prove levels with the greedy witness` (spec 8.1, 15.7) and `feat(line-siege): plan three packs on a rising curve` (spec 8.1, D9). The describe file and its test ride with the plan commit.
- **Done when:**
  - `npx jest apps/line-siege/src/levels --ci --selectProjects unit` passes.
  - `npx tsc --noEmit -p apps/line-siege` passes.
  - `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` prints RESULT: PASS (levels import only game-kit, rules and levels).
  - `npm run test:sim`, then `node skills/game-balance-and-bots/scripts/check-balance.mjs . --game line-siege` prints RESULT: PASS (fresh fingerprint).
  - `npm run -s check:fast` is green.

### E03-T11 · Generate the three packs and prove the level table
- **Goal:** Write the 90 shipped levels with the generator, never by hand or by copy, only after the sims passed on the final code. Prove the whole table: every level is winnable by its replayed witness line, the packs match `game.config.ts` (3 x 30, unlocking at 0, 45 and 90 stars), every level is rated by score, the daily uses salt `0xe8c0` at difficulty 45, and endless runs at difficulty 100, which no level uses (spec 8.1, 8.2, 8.3, 10 LEVELS, 15.7, D9).
- **Skills:** `level-generation-and-solvers`, `game-balance-and-bots`, `tdd-workflow`, `unit-and-component-tests`, `typescript-and-lint-rules`.
- **Tests first:**
  - Gate red: `node skills/level-generation-and-solvers/scripts/check-levels.mjs .` prints `packages/tooling/src/levels/generate-levels.ts [kit-file-missing]`, and with `--game line-siege` also `levels-file-missing`.
  - Copy `apps/line-siege/src/levels/line-siege-levels.test.ts` from `skills/level-generation-and-solvers/examples/line-siege/levels/`. Its tests: proves every shipped level winnable by the witness, with packs matching the config (`levelsContractProblems` returns `[]`); opens pack 1 at once and asks 45, then 90, stars; rates every level by score, where any score wins; starts the daily at the daily difficulty from the date and salt; runs endless at the reserved difficulty.
  - It fails first on the missing `line-siege-levels.ts`. Add a typed stub `LINE_SIEGE_LEVELS` with an empty table and wrong salt and difficulty, and see it red on an assertion (the contract lists problems, `Received` is not `[]`). Keep the red lines.
- **Build:** In this order, in one sitting. The pre-commit typecheck cannot pass between steps 2 and 4, so commit only at the end.
  1. Copy `packages/tooling/src/levels/generate-levels.ts` verbatim from `skills/level-generation-and-solvers/templates/` (manifest entry "level-generation-and-solvers: `packages/tooling/src/levels/**`").
  2. Replace the stub with the canonical `line-siege-levels.ts` from the example. It imports `./pack-1.json` to `./pack-3.json`, which do not exist yet; that is expected and not committed.
  3. Sims on the final code, before any pack exists: `npm run test:sim`, then `node skills/game-balance-and-bots/scripts/check-balance.mjs . --game line-siege` prints RESULT: PASS. The sims do not import `line-siege-levels.ts`, and the fingerprint now covers the whole final `levels/` folder.
  4. Generate: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/levels/generate-levels.ts --app line-siege`. It writes `apps/line-siege/src/levels/pack-1.json` to `pack-3.json` through the repo's Prettier and must report 0 failures. Never edit, reformat or copy a pack.
  5. Prove the bytes:
     - `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/levels/generate-levels.ts --app line-siege --check` exits 0;
     - `npx prettier --check apps/line-siege/src/levels` exits 0;
     - `for n in 1 2 3; do cmp apps/line-siege/src/levels/pack-$n.json skills/level-generation-and-solvers/examples/line-siege/levels/pack-$n.json; done` prints nothing (byte-identical to the canonical packs).
  6. With no sim rerun, `node skills/game-balance-and-bots/scripts/check-balance.mjs . --game line-siege` still prints RESULT: PASS: the packs are outputs, not part of the fingerprint.
  7. Commit the generator, `line-siege-levels.ts`, its test and the three packs together: `feat(line-siege): generate three packs of witnessed levels` (spec 8.1, 8.3, D9, 15.7). No `Gate-Change:` trailer, because no gated path is staged. From now on, a tuning change regenerates the packs and their goldens in one commit with a `Gate-Change:` trailer (see T14).
- **Done when:**
  - `npx jest apps/line-siege/src/levels --ci --selectProjects unit` passes.
  - `npx tsc --noEmit -p apps/line-siege` and `npx tsc --noEmit -p packages/tooling` pass.
  - The step 5 commands pass.
  - Both check-balance runs printed RESULT: PASS.
  - `node skills/level-generation-and-solvers/scripts/check-levels.mjs . --game line-siege` prints no FAIL line except the three golden rules `level-golden`, `golden-snapshot-missing` and `daily-golden`, which T12 closes.
  - `npm run -s check:fast` is green.

### E03-T12 · Data goldens: pack boundaries and three daily dates
- **Goal:** Freeze what players will get. Pin the boards of levels 1, 30, 31, 60, 61 and 90 with their stars, and the daily boards of 2026-09-28, 2026-12-31 and 2027-01-01 with the real salt `0xe8c0` and difficulty 45. A silent generator or tuning change then fails a test. The daily entries are a hard compatibility contract and never change once committed (spec 8.1, 8.3; golden-tests rules 1-5).
- **Skills:** `golden-tests`, `level-generation-and-solvers`, `tdd-workflow`, `git-commits-and-reporting`.
- **Tests first:** Copy `apps/line-siege/src/levels/line-siege-levels.golden.test.ts` verbatim from `skills/level-generation-and-solvers/examples/line-siege/levels/`. It runs `it.each([1, 30, 31, 60, 61, 90])` "keeps the frozen board of level %i" and `it.each(dates)` "keeps the frozen daily board for %s" for `['2026-09-28', '2026-12-31', '2027-01-01']`, through `describeLevel(create(seed, difficulty))`. Red first: `npx jest apps/line-siege/src/levels/line-siege-levels.golden.test.ts --ci --selectProjects golden` fails its 9 cases, because `--ci` refuses to write a missing snapshot. Keep the lines.
- **Build:**
  1. Create the snapshot on purpose, for this one file only, path first: `npx jest apps/line-siege/src/levels/line-siege-levels.golden.test.ts --selectProjects golden -u`. It writes `apps/line-siege/src/levels/line-siege-levels.golden.test.ts.snap.ios` next to the test.
  2. Read the `.snap.ios` board by board against the rules sheet. Each entry is a header with the seed and difficulty, then three hearts and a tray of three, the lanes with each monster's kind and health, and the 8 x 8 board. Level 1 shows the prepared row and column two cells short. The stars line is `[0, witness score, witness score + 20 %]`.
  3. Then compare with the canonical snapshot: `diff apps/line-siege/src/levels/line-siege-levels.golden.test.ts.snap.ios skills/level-generation-and-solvers/examples/line-siege/levels/line-siege-levels.golden.test.ts.snap.ios` prints nothing. Never copy the snapshot, and never edit it by hand.
  4. `CI=1 npx jest --ci --selectProjects golden` passes.
  5. Commit with the trailer from `skills/golden-tests/templates/gate-change-commit.txt`: `test(line-siege): pin level and daily data goldens`, ending with `Gate-Change: first Line Siege data goldens: levels 1, 30, 31, 60, 61, 90 and daily boards for 2026-09-28, 2026-12-31 and 2027-01-01, read board by board`. Before committing, run `node skills/golden-tests/scripts/check-golden-changes.mjs . --staged --message reports/commit-message.txt` and `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged`.
- **Done when:**
  - `npm run test:golden` passes.
  - `node skills/golden-tests/scripts/check-goldens.mjs .` prints RESULT: PASS.
  - `node skills/level-generation-and-solvers/scripts/check-levels.mjs . --game line-siege --report` prints RESULT: PASS; copy its pack lines into `reports/plans/e03-line-siege.md`.
  - `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD` prints RESULT: PASS.
  - `npm run -s check:fast` is green.

### E03-T13 · Prove Shell step 3 and write the report
- **Goal:** Run Shell step 3's "done when" exactly as the build order lists it, plus the quality checks for logic code, and hand the owner a plain-English report. The report says what the bots found in players' words, that every level is proven winnable, and that the play-test is the owner's own non-blocking step (spec 15.7, O6).
- **Skills:** `game-rules-engine`, `game-balance-and-bots`, `level-generation-and-solvers`, `golden-tests`, `unit-and-component-tests`, `typescript-and-lint-rules`, `naming-conventions`, `architecture-and-boundaries`, `pocket-arcade-product-spec`, `git-commits-and-reporting`, `quality-gates`.
- **Tests first:** Mutation testing is the only new test work. Every surviving mutant in a rules or levels file gets a boundary example first: a new `it` in that module's test file, seen red against the mutant's code, with no existing assertion changed. Commit it as `test(line-siege): <what the example pins>`. An equivalent mutant is accepted only with `--allow <id>` and a sentence in the report.
- **Build:**
  1. Shell step 3's done-when, in this order:
     1. `node skills/game-rules-engine/scripts/check-rules-engine.mjs . --game line-siege`
     2. `npm run test:sim`
     3. `node skills/game-balance-and-bots/scripts/check-balance.mjs . --game line-siege`
     4. `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/levels/generate-levels.ts --app line-siege --check` (exits 0)
     5. `node skills/game-balance-and-bots/scripts/check-balance.mjs . --game line-siege` again, with no sim rerun
     6. `node skills/level-generation-and-solvers/scripts/check-levels.mjs . --game line-siege --report`
     7. `node skills/golden-tests/scripts/check-goldens.mjs .`
     8. `npm run test:golden`
  2. Logic quality:
     - `npm run test:coverage`; read `reports/coverage/coverage-summary.json`.
     - `npx stryker run --mutate "apps/line-siege/src/rules/*.ts,apps/line-siege/src/levels/*.ts,!apps/line-siege/src/**/*.test.ts"` (about 20-30 s per file).
     - Then `node skills/unit-and-component-tests/scripts/check-mutation-report.mjs reports/stryker/mutation.json $(ls apps/line-siege/src/rules/*.ts apps/line-siege/src/levels/*.ts | grep -v '\.test\.ts$' | sed 's/^/--changed /')`. Kill survivors as described under "Tests first", then rerun both commands.
  3. Tree checks:
     - `node skills/tdd-workflow/scripts/check-tests.mjs .`
     - `node skills/unit-and-component-tests/scripts/check-test-code.mjs .`
     - `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .`
     - `node skills/naming-conventions/scripts/check-file-names.mjs .`
     - `node skills/naming-conventions/scripts/check-code-names.mjs .`
     - `node skills/typescript-and-lint-rules/scripts/check-source.mjs .`
     - `node skills/pocket-arcade-product-spec/scripts/check-spec-refs.mjs .`
     - `node skills/quality-gates/scripts/check-gate-wiring.mjs .`: its not-yet-due SKIP lines for scripts whose targets later steps copy count as a pass, and they must be the same lines as after E02.
  4. History: `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD`, `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD` and `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD`.
  5. Write `reports/evidence-<YYYY-MM-DD>-e03-line-siege-rules-levels.md` from `skills/git-commits-and-reporting/templates/evidence-slice.md`, compared with `skills/git-commits-and-reporting/examples/slice-evidence.md`:
     - **Outcome in players' words.** For example: "Line Siege's rules, a bot that plays like a reasonable person, and 90 levels in three packs now exist, and every level is proven winnable."
     - **Tests line.** Take the golden count from `npx jest --ci --selectProjects golden`; unit = total minus golden.
     - **What changed for players.** One line per behaviour with its spec id (13, 8.1, 8.3, 8.10, 10).
     - **Bots line per difficulty in plain words, from `reports/sim/line-siege.json`.** For example: "a reasonable player wins about 3 in 4 of the easiest levels and 1 in 7 of the hardest; random tapping wins about 1 in 5 of the easiest; a player who sees ahead wins every level-2 run; endless runs last about 26 blocks".
     - **The kill-test verdict.**
     - **The pack lines from `check-levels --report`.**
     - **"Goldens and baselines changed on purpose".** The `.snap.ios` with its Gate-Change commit.
     - **"Owner steps (not blocking)".**
       - fa and ckb texts: no new texts in this epic; the Line Siege texts from E01 are still waiting if the owner has not read them yet (step R3).
       - Play-test Line Siege: still open (step G6). Add the rules sheet's owner questions 2-5.
       - Sound previews: not yet built, E08 (step G9).
     - **"Not tested or not verified".** Nothing ran on a device, there is no board drawing or sound yet, and the bands are proposed, not approved.
     - **Details.** The red runs from `reports/plans/e03-line-siege.md` and the commit list.
- **Done when:**
  - Every command in steps 1 to 4 prints RESULT: PASS or passes (exit 0).
  - `node skills/unit-and-component-tests/scripts/check-mutation-report.mjs reports/stryker/mutation.json` prints RESULT: PASS.
  - `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e03-line-siege-rules-levels.md --kind slice` prints RESULT: PASS.
  - `npm run -s check:fast` is green.

### E03-T14 · Simplify, code review, re-run the gates and merge
- **Goal:** Give the whole branch the two review passes the owner requires. Fix every confirmed finding test-first, without breaking the three contracts this epic created: the sim numbers, the generated packs and the frozen daily boards. Then merge.
- **Skills:** `tdd-workflow`, `game-rules-engine`, `game-balance-and-bots`, `level-generation-and-solvers`, `golden-tests`, `quality-gates`, `git-commits-and-reporting`, `troubleshooting-playbook`.
- **Tests first:** Every accepted finding first becomes a failing test that shows the problem: a new example in the module's test file, seen red on an assertion. Only then comes the fix. A finding that would need an existing assertion changed is not a review fix: it is a spec question for the owner.
- **Build:**
  1. Run `/simplify` over `git diff main...HEAD`. Apply only fixes that keep behaviour. After each one, `npm run test:sim`, `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/levels/generate-levels.ts --app line-siege --check` and `npm run test:golden` must stay green with unchanged numbers and bytes. A simplification inside a copied canonical file makes it differ from the library. Prefer recording it in the report as a library follow-up; if you apply it, name the file and the reason in the report.
  2. Run `/code-review` on the branch. Fix every confirmed bug test-first, in its own `fix(line-siege): ...` commit with spec lines in the body.
  3. Tuning and the daily contract:
     - A fix that changes the tuning file or `create` changes boards. If the three daily boards stay the same, regenerate the packs (`generate-levels.ts --app line-siege`), rerun the sims, re-create the level goldens with `-u` on the one golden file, read them, and commit packs and goldens together with a `Gate-Change:` trailer that says why.
     - If any daily board would change, stop: an existing daily golden never changes (golden-tests rule 4). It is the owner's call, not a review fix.
     - A finding that would weaken a gate, widen a band, change seeds or tune the bot is refused, with the reason in the report.
  4. Re-run all of T13's steps 1 to 4. Then run the due verify steps one by one (Close the epic, step 1) and `npm run -s check:fast`.
  5. Update the report with the findings (fixed, refused or recorded) and the final commits, then check it again.
- **Done when:**
  - Every finding is fixed (with its red run kept), refused with a reason, or recorded.
  - T13's done-when commands all pass again.
  - `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD`, `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD` and `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD` print RESULT: PASS.
  - The branch is merged as described in Close the epic, step 5.
- **Owner:** Only if a finding would change a daily board, or needs a gate or spec change. Send one request with the default: keep the current code, record the finding, and merge.

## Close the epic
1. Re-run every task's "Done when" (T13's list covers them in build order) and `npm run verify`.
   - In this epic, verify passes format:check, lint and typecheck and then stops at `i18n:verify`, as expected until E06. Any other red step is a real failure.
   - Run the steps after it one by one; all must pass: `npm run -s knip -- --exclude exports,nsExports,types,nsTypes,enumMembers,namespaceMembers,duplicates`, `node packages/tooling/src/quality/check-quality-gates.ts`, `npm run -s test:coverage`, `npm run -s test:sim` and `EXPO_NO_TELEMETRY=1 node packages/tooling/src/deps/check-deps.ts`.
   - `audit:network` and `audit:licenses` are not due until E10.
2. Run `/simplify` over the branch's changes (`git diff main...HEAD`), as in T14 step 1. Apply its fixes; where behaviour changes, test first. Then repeat step 1's runs.
3. Run `/code-review` on the branch, as in T14 step 2. Fix every confirmed finding test-first (a failing test that shows the problem, then the fix). Then repeat step 1's runs.
4. Finish the epic's evidence report (git-commits-and-reporting, slice form) with the final commit and the review outcomes. Check it with `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e03-line-siege-rules-levels.md --kind slice`.
5. Merge: `git switch main && git merge --no-ff epic/e03-line-siege-rules-levels && git push origin main`, then delete the branch (`git branch -d epic/e03-line-siege-rules-levels`). The push follows the two limits in "How we work" step 1: it needs the owner's word, and the pre-push hook's `npm run verify` cannot pass before E10. Until then, `main` stays local.
