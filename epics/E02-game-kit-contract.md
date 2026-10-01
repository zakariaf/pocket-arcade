# E02 · Game kit and the game contract

| | |
|---|---|
| Branch | `epic/e02-game-kit-contract` |
| Depends on | E01 |
| Spec | 10 (the game contract: identity, rules, levels, board and controls, teaching, statistics, texts, testing); 8.1 (levels from seed + difficulty, solver and par, stars); 8.2 (the endless mode's difficulty 100); 8.3 (the daily seed, a compatibility contract); 8.13 (pure rules, all randomness from a seed, bots); S8 (packs unlock by stars); 13 "What the catalogue means for the Shell" (turn-based and real-time games, tap, swipe and drag input, no grid assumed). Prepares 15.7 (the solver and witness kit that proves every level; the proof itself is E03). |
| Build order | Shell step 2 (pocket-arcade-index, `references/build-orders.md`, row 2 and the "Step 2" manifest) |
| Tasks | 11 |

## Current state

E01 is merged into `main`:

- The monorepo exists at the repo root next to `docs/`, `design/`, `skills/` and `spec.txt`: workspaces `apps/*` and `packages/*`, the root `package.json` scripts (`check:fast`, `verify`, `typecheck`, `test:coverage`, `test:golden`, `knip`, ...), lefthook (pre-commit: format, lint, typecheck, related tests; commit-msg; pre-push: `npm run verify`), `quality-gates.json`, `knip.json`, `.npmrc` (exact pins, 7-day release age with the bootstrap's dated exclude block, `expires=2026-10-03`) and `jest.config.js` (projects `unit` and `golden`; a 95/95/95/90 threshold on `./packages/game-kit/src/`).
- `packages/game-kit` has its `package.json` (`@e07/game-kit`, exports `./*` -> `./src/*`, no dependencies), its `tsconfig.json`, and exactly one module: `src/contract/result.ts` (`Result`, `ok`, `err`) with `result.test.ts`. Nothing else.
- `packages/shell` and `packages/tooling` hold the bootstrap files (quality, git, hooks, deps, audit and scaffold tooling). `apps/line-siege` is the scaffold only: `app.config.ts`, `game.config.ts` (`io.applander.linesiege`), a placeholder `index.ts`, `src/i18n/{en,de,fa,ckb}.json`, fonts. There is no `src/rules` or `src/levels` yet.
- `shell-slice.json` says `"screens": []`.
- Passing: `check-monorepo.mjs .`, `check-gate-wiring.mjs .` (with exactly seven not-yet-due `script-target` SKIP lines), `check-game-app.mjs . --app line-siege --stage scaffold`, `npm run -s check:fast`, `npm run new-game -- --help`.

Not there yet:

- `fast-check` is not in the root `devDependencies`, so any copied property test fails with `Cannot find module 'fast-check'`.
- `node skills/game-rules-engine/scripts/check-rules-engine.mjs .` prints a `kit-file-missing` line for every contract, RNG, geometry, timeline and testing-helper file.
- No dates, solver or level kit. `npm run test:golden` finds no tests (due from Shell step 3).
- `npm run verify` stops at its `i18n:verify` step, which is expected until Shell step 6 (E06); see "The verify steps due at Shell step 2" below.

## What we will do

Build `packages/game-kit`, the bottom layer every game and the Shell stand on, by copying exactly Shell step 2's manifest, each file with its test, test first:

- Install `fast-check` 4.10.2 (root, exact) through `plan-dependency.mjs`, in the same commit as its first importer.
- From game-rules-engine: `packages/game-kit/src/contract/**` (the thirteen contract files: `GameModule`, `GameEngine` with `panMode` and `selectRegions`, `InputIntent` with the tap's `selected`, `GameIdentity` `{ id, nameId, winTitleId, taglineId }`, the 0..100 difficulty scale, ...), `rng/**` (sfc32 and its frozen goldens, `pickAt`), `geom/board-layout*`, `geom/classify-swipe*`, `timeline/track*` and `testing/**` (play-choices, play-bot, json-shape, engine-contract, contract-intents).
- From daily-and-statistics: `packages/game-kit/src/dates/**` (date keys in integer maths and the daily seed).
- From level-generation-and-solvers: `packages/game-kit/src/solver/**` (BFS, IDA*, `verifyLine`), `levels/**` (stars, packs, level tables, the daily start, level plans, the levels contract, the witness solver) and `testing/render-cells*`.

The tasks follow the import order, so every commit compiles on its own (the pre-commit hook runs the full typecheck): the contract types import the geometry, the timeline track and `testing/play-bot.ts`, and the level kit imports the solvers, so those land first or together. Nothing here is written from memory and nothing is changed: every file is byte-identical to its template.

Not in this epic:

- Line Siege's rules, bot, sims, levels, generated packs and data goldens, `packages/tooling/src/levels/generate-levels.ts` and the first `npm run test:golden` run: E03 (Shell step 3). The extra bot-testing helpers in `packages/game-kit/src/testing/**` also land there.
- The clock port and the save layer: E04 (Shell step 4).
- The daily, statistics and run-end models of the Shell (`packages/shell/src/stores/`): Shell step 7 (E09).
- The rest of `timeline/` and `geom/stick-command*` for the board: Shell step 7 (E08).
- Any screen. No task in this epic builds or changes a screen.

## Final state

- [ ] `fast-check` 4.10.2 is pinned exactly in the root `devDependencies`, one copy only: `npm ls fast-check` shows a single `fast-check@4.10.2`; `node skills/dependency-management/scripts/check-deps-policy.mjs .` prints RESULT: PASS; `packages/game-kit/package.json` still has no dependencies.
- [ ] The contract, the RNG, the geometry, the timeline track and the five testing helpers are in and current: `node skills/game-rules-engine/scripts/check-rules-engine.mjs .` prints RESULT: PASS (it also runs the real `sfc32.ts` against the PractRand reference and the goldens).
- [ ] The RNG, date and daily-seed goldens pass as unit tests: `npx jest packages/game-kit/src/dates packages/game-kit/src/rng --ci --selectProjects unit` passes, with `seedRng(1)` = 1828152527, 3394835397, 2967886022, 2251045104, 4148684523, `hashSeed('line-siege:2026-09-26')` = 2224665572, `dailySeed('2026-09-26', 17)` = 2599028541 and `dailySeed('2026-09-27', 17)` = 2582250922.
- [ ] Date maths and the daily seed pass against the real code: `node skills/daily-and-statistics/scripts/check-daily-stats.mjs .` prints RESULT: PASS with exactly the five `[missing-module]` SKIP lines listed in T03.
- [ ] The level kit is in, and the star rule and daily seed pass against the real code: `node skills/level-generation-and-solvers/scripts/check-levels.mjs .` prints exactly one FAIL line, `FAIL packages/tooling/src/levels/generate-levels.ts [kit-file-missing] ...` (E03 copies the generator), and no `[star-rule]` or `[daily-seed-golden]` line.
- [ ] Every copied file is byte-identical to its template: the verbatim checks of T01 to T09 print nothing.
- [ ] Coverage: the game-kit subset run in T10 reads at least 95/95/95/90 on its "All files" line, and `npm run test:coverage` is green.
- [ ] The compatibility-contract modules resist mutants: after `npx stryker run --mutate ...` (T10), `node skills/unit-and-component-tests/scripts/check-mutation-report.mjs` prints RESULT: PASS (score at least 75).
- [ ] game-kit imports only itself: `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` prints RESULT: PASS.
- [ ] Tests and names follow the rules: `check-tests.mjs .`, `check-test-code.mjs .`, `check-file-names.mjs .`, `check-code-names.mjs .` and `check-source.mjs .` print RESULT: PASS (T10).
- [ ] The gate wiring is unchanged: `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints RESULT: PASS with the same seven not-yet-due SKIP lines as after E01.
- [ ] `npm run -s check:fast` is green, the verify steps due at Shell step 2 are green, and `npm run verify` stops only at `i18n:verify`.
- [ ] The history is clean: `check-commits.mjs . --range main..HEAD`, `check-test-edits.mjs . --range main..HEAD` and `check-golden-changes.mjs . --range main..HEAD` print RESULT: PASS (T11).
- [ ] The evidence report passes `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e02-game-kit-contract.md --kind slice`.
- [ ] `main` holds the `--no-ff` merge of `epic/e02-game-kit-contract` (`git log --oneline -1 main`), and the branch is deleted.

## Skills to load

Always: `pocket-arcade-index`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`.

For this epic:

- `pocket-arcade-product-spec`: `spec-lookup.mjs` prints the exact spec lines (10, 8.1, 8.2, 8.3, 8.13, 13, S8) that each commit body quotes.
- `game-rules-engine`: owns the contract, RNG, geometry, timeline and testing-helper templates and `check-rules-engine.mjs`; its rules on frozen RNG goldens, verbatim contract files and the 0..100 difficulty scale.
- `daily-and-statistics`: owns `dates/**` and `check-daily-stats.mjs` (integer date maths, the daily-seed goldens).
- `level-generation-and-solvers`: owns `solver/**`, `levels/**`, `testing/render-cells*` and `check-levels.mjs` (the spec 8.1 star rule and the daily seed run against the real code).
- `golden-tests`: the frozen daily contract and the "never edit a pinned value" policy; `check-golden-changes.mjs` proves no golden path changed.
- `dependency-management`: installs `fast-check` through `plan-dependency.mjs`, the install-script approval, `check-deps-policy.mjs`, the expired exclude block rule.
- `unit-and-component-tests`: fast-check in tests, the subset coverage command, `check-test-code.mjs`, Stryker and `check-mutation-report.mjs`.
- `typescript-and-lint-rules`: the strict tsconfig and ESLint set every copy must pass; `check-source.mjs`.
- `naming-conventions`: file names, path headers and code names of the copies; `check-file-names.mjs`, `check-code-names.mjs`.
- `architecture-and-boundaries`: game-kit imports only itself (rule `game-kit-pure`); `check-boundaries.mjs`.
- `troubleshooting-playbook`: `find-fix.mjs` when a copy does not compile or a test fails for an unexpected reason.

## How we work in this epic

1. Branch: `git switch main && git pull && git switch -c epic/e02-game-kit-contract`. Push the branch after each task (`git push -u origin epic/e02-game-kit-contract`) once the owner has said pushing is fine for this run (git-commits-and-reporting rule 5). The pre-push hook runs `npm run verify`, which at Shell step 2 stops at its `i18n:verify` step (expected red until Shell step 6, E06; verify as a whole is green from Shell step 8, E10, per quality-gates' "When verify is green" table), so the hook will refuse the push in this epic. Never bypass it (no `--no-verify`, no `LEFTHOOK=0`): keep the commits local and say so in the report.
2. Test first, always. Write each task's "Tests first" items, run them and watch them fail for the right reason, write the minimum code to pass, then refactor. Never weaken or edit a test to make it pass. In this epic every file is a canonical template that the Shell step 2 manifest copies verbatim, so the loop is:
   - Run the owning checker and keep its `kit-file-missing` lines (the first red).
   - Copy the task's test files first.
   - Give each module a temporary typed stub that exports the right names and returns wrong values (`0`, `[]`, `null`), run the tests, and keep the assertion diffs (`Expected ... Received ...`). An import, type or `Cannot find module` error is the wrong reason: fix the stub until the failure is an assertion.
   - Replace each stub with the canonical file, byte for byte, and see green. "Refactor" changes nothing here: the copies stay identical to their templates, because later steps copy shared files "only when missing" and the checkers compare names and values with the templates.
   - Save each red run to `reports/red/e02-tNN.txt` (`reports/` is gitignored) for the evidence report.
   - The verbatim check of a task: `(cd skills/<skill>/templates && find <paths> -type f) | while read -r f; do cmp "skills/<skill>/templates/$f" "$f"; done` prints nothing.
   - A copy that does not compile means the manifest is wrong: report it, never fetch extra files by following tsc errors. `node skills/troubleshooting-playbook/scripts/find-fix.mjs --text "<first error line>"` names known causes.
3. Commit each task in Conventional Commits form, with the trailers the skills ask for (Gate-Change:, Spec-Change:). `npm run -s check:fast` must be green before every commit. Write the message to `reports/commit-message.txt` (scope `game-kit`, a body that says why and names the spec lines), then `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged` and `node skills/tdd-workflow/scripts/check-test-edits.mjs . --staged --message reports/commit-message.txt` must print RESULT: PASS before `git commit -F reports/commit-message.txt`. No file in this epic is a gated path and no existing assertion changes, so no commit carries `Gate-Change:` or `Spec-Change:` (the commit-msg hook rejects an unneeded `Gate-Change:`), except the `.npmrc` commit T01 may need.
4. Screens: a task that builds or changes a screen is not done until the app's capture matches the Toybox design screenshot for every frame it names, in light-en, light-fa, dark-en and dark-fa at every scroll offset, and check-signoff passes for those frames. No task in this epic builds or changes a screen, so no task has a "Design match" line.
5. Stop and ask the owner only at a step marked **Owner**.

The verify steps due at Shell step 2 (quality-gates, "When verify is green"): `npm run verify` must pass `format:check`, `lint` and `typecheck` and then stop at `i18n:verify` (its target, `packages/tooling/src/i18n/verify-catalogs.ts`, arrives at Shell step 6, E06). Run the later steps that are due now by hand, each must pass: `npm run -s knip -- --exclude exports,nsExports,types,nsTypes,enumMembers,namespaceMembers,duplicates` (the form verify uses while `shell-slice.json` exists), `node packages/tooling/src/quality/check-quality-gates.ts`, `npm run test:coverage` and `node packages/tooling/src/deps/check-deps.ts`. `audit:network` and `audit:licenses` are expected red until Shell step 8 (E10), and verify skips `test:sim` until the first sim exists (E03). The report names each expected-red step with its reason.

## Tasks

### E02-T01 · Install fast-check with its first property test: the difficulty scale

- **Goal:** `fast-check` 4.10.2 becomes an exact root devDependency in the same commit as the first test that imports it (knip and `check-deps-policy` fail on a package nobody imports), and the one difficulty scale exists: whole numbers 0..100, levels and the daily on 0..99, 100 (`ENDLESS_DIFFICULTY`) reserved for an endless run, which is never won. Every later contract, tuning and level file reads this scale (spec 8.1, 8.2).
- **Skills:** `dependency-management`, `game-rules-engine`, `unit-and-component-tests`, `pocket-arcade-product-spec`, `troubleshooting-playbook`.
- **Tests first:**
  - `packages/game-kit/src/contract/difficulty.test.ts` (copied from game-rules-engine). Unit examples: `clampDifficulty` maps `[-5, 0, 45.9, 99, 100, 250]` to `[0, 0, 45, 99, 100, 100]`; `isEndlessDifficulty` is true only for 100 and above; `rowFor` splits 0..99 into equal bands, easiest first (45 lands in row 1 of 4) and clamps values outside 0..99. Property: `rowFor` always names an existing row and never falls as the difficulty rises.
  - Red 1 (the install): with the test copied, `node skills/game-rules-engine/scripts/check-rules-engine.mjs .` prints `FAIL package.json:1 [kit-test-dependency] packages/game-kit/src/contract/difficulty.test.ts imports fast-check, but the root package.json has no fast-check devDependency`.
  - Red 2 (the behaviour): after the install, a stub `difficulty.ts` exporting `ENDLESS_DIFFICULTY = 0`, `MAX_LEVEL_DIFFICULTY = 0` and functions that return `-1` and `false` makes `npx jest --ci packages/game-kit/src/contract/difficulty.test.ts` fail on `toStrictEqual` diffs.
- **Build:**
  1. On or after 2026-10-03 (the `expires=` date of the bootstrap's exclude block), delete that whole block from `.npmrc` first. Never extend it; the lockfile keeps every installed version. From 2026-10-04, `node skills/dependency-management/scripts/check-deps-policy.mjs .` and `check-deps.ts` fail with `expired` until it is gone. Delete it in its own `build(deps)` commit with a `Gate-Change:` trailer, because `.npmrc` is a gated path (dependency-management, release-age-policy "Expiry: delete, never extend").
  2. Copy the test (red 1).
  3. `node skills/dependency-management/scripts/plan-dependency.mjs fast-check --root . --online`. It prints the row (`fast-check 4.10.2`, exact npm pin, root devDependencies), its age and licence, and the steps. Run them in order: `npm install -D fast-check@4.10.2` (`.npmrc`'s `save-exact=true` pins it exactly), then `npm approve-scripts --allow-scripts-pending`. If it lists `fsevents` (the macOS file watcher of jest-haste-map), read its script and `npm approve-scripts fsevents`. A `FAIL` line from the plan means stop (dependency-management rule 12).
  4. Write the stub and see red 2. Then copy `skills/game-rules-engine/templates/packages/game-kit/src/contract/difficulty.ts` over it verbatim and see green.
  5. Commit `feat(game-kit): add the difficulty scale and fast-check`. The body names spec 10 and 8.1, plus what dependency-management asks a commit to record: package, old and new version (none -> 4.10.2), why (property tests), and the age and licence lines the plan printed.
- **Done when:**
  - `npm ls fast-check` shows exactly one `fast-check@4.10.2`; `npm approve-scripts --allow-scripts-pending` prints `No packages with unreviewed install scripts.`
  - `node skills/dependency-management/scripts/check-deps-policy.mjs .` prints RESULT: PASS.
  - `npx jest packages/game-kit/src/contract --ci --selectProjects unit` passes (difficulty and the E01 result test).
  - `node skills/game-rules-engine/scripts/check-rules-engine.mjs . | grep -E '^FAIL (package\.json|packages/game-kit/src/contract/difficulty)'` prints nothing.
  - The verbatim check with `skills/game-rules-engine` and `packages/game-kit/src/contract/difficulty.ts packages/game-kit/src/contract/difficulty.test.ts` prints nothing.
  - `npm run -s knip -- --exclude exports,nsExports,types,nsTypes,enumMembers,namespaceMembers,duplicates` passes (fast-check counts as used), and `npm run -s check:fast` is green.

### E02-T02 · Seeded RNG and its goldens

- **Goal:** all randomness in every game comes from one seeded sfc32 generator whose values never change. Same seed, same level, same daily and same replay on every phone, in Jest and in Node (spec 8.3, 8.13). The goldens are the compatibility contract of every generated level, daily challenge and saved replay.
- **Skills:** `game-rules-engine`, `golden-tests`, `unit-and-component-tests`, `tdd-workflow`, `pocket-arcade-product-spec`.
- **Tests first:**
  - `packages/game-kit/src/rng/sfc32.test.ts`: matches an independent transcription of PractRand's sfc32 for 50 draws from `[1, 2, 3, 4]`; golden `seedRng(1)` draws `1828152527, 3394835397, 2967886022, 2251045104, 4148684523`; golden `hashSeed('line-siege:2026-09-26')` = `2224665572`. Properties: the same seed gives the same sequence; `nextInt` stays in `[0, max)`; `nextUnit` stays in `[0, 1)`. Examples: the biased top draw is rejected and the next one used; `hashU32` is stable and spreads neighbouring indices.
  - `packages/game-kit/src/rng/pick-at.test.ts`: returns the item at the index; throws a `RangeError` outside the list.
  - Red: `check-rules-engine.mjs .` lists `kit-file-missing` for `rng/sfc32.ts` and `rng/sfc32.test.ts`. With stubs (`nextU32` returning `{ value: 0, state }`, `seedRng` returning `[0, 0, 0, 0]`, `hashSeed` returning `0`, `pickAt` returning `items[0]` without throwing), the jest run fails with diffs such as `Expected: [1828152527, ...] Received: [0, 0, 0, 0, 0]`.
- **Build:** copy `rng/sfc32.ts` and `rng/pick-at.ts` from `skills/game-rules-engine/templates/packages/game-kit/src/` verbatim. Keep the file-level `'worklet';` directive as the first statement (rule `rng-worklet`: real-time sims draw on the UI thread). Never touch `GOLDEN_SEED_1` or `GOLDEN_DAILY_HASH`: a changed value is a new RNG and a question for the owner (game-rules-engine rule 4). Commit `feat(game-kit): add the seeded sfc32 rng with its golden values` (spec 8.3, 8.13).
- **Done when:**
  - `npx jest packages/game-kit/src/rng --ci --selectProjects unit` passes.
  - `node skills/game-rules-engine/scripts/check-rules-engine.mjs . | grep -E '^FAIL packages/game-kit/src/rng/'` prints nothing. Its rules `rng-golden` (the real file against PractRand and the goldens), `rng-worklet`, `rng-golden-test` and `determinism` find nothing in `rng/`.
  - The verbatim check with `skills/game-rules-engine` and `packages/game-kit/src/rng` prints nothing.
  - `node skills/tdd-workflow/scripts/check-tests.mjs .` prints RESULT: PASS; `npm run -s check:fast` is green.

### E02-T03 · Date keys and the daily seed

- **Goal:** days are `'YYYY-MM-DD'` keys with calendar maths in integers only (no `Date`, no `Intl`: Hermes formats `fa` dates in another calendar, and time zones would make phones disagree), and `dailySeed(date, salt)` gives the same uint32 on every phone. Every player gets the same daily level with no server (spec 8.3).
- **Skills:** `daily-and-statistics`, `golden-tests`, `level-generation-and-solvers`, `pocket-arcade-product-spec`.
- **Tests first:**
  - `packages/game-kit/src/dates/date-key.test.ts` (copied from daily-and-statistics; level-generation-and-solvers ships the same bytes). Examples: `dayNumber('1970-01-01')` = 0 and `dayNumber('2026-09-26')` = 20722. Month, year and leap boundaries: `addDays('2026-02-28', 1)` = `'2026-03-01'`, 2028-02-29 exists, 2100-02-29 does not, 2000-02-29 does, `daysBetween('2026-12-31', '2027-01-01')` = 1. ISO weekdays. Malformed keys give `NaN`.
  - Property: every day number from 1900 to 2400 survives a round trip (2,000 runs).
  - Pinned daily seeds: `dailySeed('2026-09-26', 17)` = 2599028541, `('2026-09-27', 17)` = 2582250922, `('2027-01-01', 17)` = 2349681313, `('2026-09-26', 0)` = 2362601272, `('2028-02-29', 4242)` = 773016242. Property: the seed is a whole uint32, and another salt gives another seed.
  - Red: stubs with `dayNumber` returning `0` and `dailySeed` returning `0` fail on the pinned values.
- **Build:** copy `dates/date-key.ts`, `dates/daily-seed.ts` and `dates/date-key.test.ts` from `skills/daily-and-statistics/templates/packages/game-kit/src/` verbatim. `daily-seed.ts` has no test file of its own: `date-key.test.ts` imports it, which `check-tests`' `untested-module` rule accepts. The daily-seed goldens never change, not even with a trailer (golden-tests rule 4, daily-and-statistics rule 2). Commit `feat(game-kit): add date keys and the pinned daily seed` (spec 8.3).
- **Done when:**
  - `npx jest packages/game-kit/src/dates --ci --selectProjects unit` passes.
  - `node skills/daily-and-statistics/scripts/check-daily-stats.mjs .` prints RESULT: PASS. Its `date-math` and `seed-golden` rules run the real modules, and it prints exactly these five SKIP lines (the Shell modules wait for a Shell screen):
    - `SKIP packages/shell/src/screens/daily/daily-summary.ts [missing-module] S4 and S9 not in shell-slice.json`
    - `SKIP packages/shell/src/screens/stats/stats-summary.ts [missing-module] S10 not in shell-slice.json`
    - `SKIP packages/shell/src/stores/daily-model.ts [missing-module] no Shell app (shell-slice.json has "screens": [])`
    - the same line for `packages/shell/src/stores/run-end.ts`
    - the same line for `packages/shell/src/stores/stats-model.ts`
  - The verbatim check with `skills/daily-and-statistics` and `packages/game-kit/src/dates` prints nothing.
  - `npm run -s check:fast` is green.

### E02-T04 · Geometry and the timeline track

- **Goal:** the shared, grid-free board vocabulary that the contract types name. `BoardLayout` is a list of regions (not one grid: spec 13 "The Shell must not assume a grid"), with `hitTest` (slop for a tap just outside the edge), `cellRect` and mirroring. `classifySwipe` turns a pan into a physical direction. `Track`, `Motion` and the polynomial easings are what `buildTimeline` returns (spec 10 BOARD AND CONTROLS).
- **Skills:** `game-rules-engine`, `typescript-and-lint-rules`, `pocket-arcade-product-spec`.
- **Tests first:**
  - `packages/game-kit/src/geom/board-layout.test.ts`. Property: every cell centre maps back to the same cell at any canvas size, mirrored or not. Examples: logical column 0 sits on the physical right edge when mirrored; the whole grid stays inside the canvas.
  - `packages/game-kit/src/geom/board-layout-edges.test.ts`: an unknown region has no cell; outside every region, in a zero-size region or before the canvas is sized nothing is hit; the slop catches a tap just outside the grid edge; `isSameTarget` compares by value and treats `null` as its own value.
  - `packages/game-kit/src/geom/classify-swipe.test.ts` (a rule table): the dominant axis gives the physical direction; a short flick that is fast enough counts; too short and too slow is rejected; a diagonal with no dominant axis is rejected; per-game thresholds apply.
  - `packages/game-kit/src/timeline/track.test.ts`: `ease` endpoints, `in-out-quad` passes 0.5 at one half, `out-back` overshoots before settling; `timelineEndMs` returns the latest end over all tracks, and 0 for no tracks.
  - Red: `check-rules-engine.mjs .` lists `kit-file-missing` for `geom/board-layout.ts`, `geom/classify-swipe.ts` and `timeline/track.ts`; stubs (`hitTest` returning `null`, `classifySwipe` returning `null`, `ease` returning `0`) fail on assertion diffs.
- **Build:** copy `geom/board-layout.ts`, `geom/board-layout.test.ts`, `geom/board-layout-edges.test.ts`, `geom/classify-swipe.ts`, `geom/classify-swipe.test.ts`, `timeline/track.ts` and `timeline/track.test.ts` from `skills/game-rules-engine/templates/packages/game-kit/src/` verbatim. Each module keeps its file-level `'worklet';` directive (gestures and frame callbacks call them on the UI thread) and imports no other module, so the worklet boundary check that the board work adds at Shell step 7 finds them clean. Commit `feat(game-kit): add board layout, swipe classifier and timeline tracks` (spec 10, 13).
- **Done when:**
  - `npx jest packages/game-kit/src/geom packages/game-kit/src/timeline --ci --selectProjects unit` passes.
  - `node skills/game-rules-engine/scripts/check-rules-engine.mjs . | grep -E '^FAIL packages/game-kit/src/(geom|timeline)/'` prints nothing.
  - `grep -L "^'worklet';" packages/game-kit/src/geom/board-layout.ts packages/game-kit/src/geom/classify-swipe.ts packages/game-kit/src/timeline/track.ts packages/game-kit/src/rng/sfc32.ts packages/game-kit/src/rng/pick-at.ts` prints nothing.
  - The verbatim checks with `skills/game-rules-engine` and `packages/game-kit/src/geom packages/game-kit/src/timeline` print nothing.
  - `npm run -s check:fast` is green.

### E02-T05 · The game contract types and the play helpers

- **Goal:** the GameModule contract (spec 10) exists exactly as the Shell, the board skills and every checker expect, with the three helpers that play any engine headlessly (spec 8.13: bots play thousands of games in seconds).
  - The members are `identity` `{ id, nameId, winTitleId, taglineId }`, `engine` (`create`, `listMoves`, `applyMove`, `outcome`, `panMode` `'none' | 'swipe' | 'drag' | 'aim'`, `selectRegions`, `intentToMove`, `buildTimeline`), `rules` (`hud`, `undo`, `hints`, `continueRun`), `levels`, `presentation`, `realtime` (null for turn-based games: spec 13 needs both kinds), `teaching`, `stats`, `texts`, `testing` and `persistence`.
  - `InputIntent`'s tap carries `selected`, so a tap-then-tap selection stays UI state, never a move.
  - `contract/testing.ts` names `BotPolicy` from `testing/play-bot.ts`, which is why the helpers land with the types.
- **Skills:** `game-rules-engine`, `architecture-and-boundaries`, `typescript-and-lint-rules`, `unit-and-component-tests`, `pocket-arcade-product-spec`, `troubleshooting-playbook`.
- **Tests first:**
  - `packages/game-kit/src/testing/play-choices.test.ts`: picks `choice % legal moves` and records every state and event; stops when no legal move is left.
  - `packages/game-kit/src/testing/play-bot.test.ts` (a count-up toy game): plays the same game for the same seed; ends every game within the move cap; stops at `maxMoves` when the game never ends; refuses to pick from an empty move list.
  - `packages/game-kit/src/testing/json-shape.test.ts`: accepts plain objects, arrays, strings, finite numbers, booleans and `null`; reports `undefined`, `Infinity`, a `Set`, a `Float32Array` and a function, each at its path.
  - These tests type their toy games as `BotGame` and `PlayableRules`, which are `Pick`s of `GameEngine`, so they compile only against the real contract types.
  - Red: `check-rules-engine.mjs .` lists `kit-file-missing` for the twelve contract files and the three helpers. Then copy the twelve type-only contract files (they have no behaviour of their own, so the tests can compile) and stub the helpers (`playChoices` returning an empty log, `playBot` returning `{ outcome: { kind: 'playing' }, moves: 0 }`, `jsonShapeProblems` returning `[]`). The jest run fails on assertion diffs.
- **Build:** copy `contract/game-engine.ts`, `game-module.ts`, `game-identity.ts`, `messages.ts`, `game-rules.ts`, `levels.ts`, `teaching.ts`, `stats.ts`, `testing.ts`, `persistence.ts`, `realtime.ts`, `input-intent.ts` and `testing/play-choices*`, `testing/play-bot*`, `testing/json-shape*` from `skills/game-rules-engine/templates/packages/game-kit/src/` verbatim. Never rename a member (game-rules-engine rule 5). E01's `contract/result.ts` stays as it is. Commit `feat(game-kit): add the game contract types and play helpers` (spec 10, 8.13, 13).
- **Done when:**
  - `npx jest packages/game-kit/src/testing --ci --selectProjects unit` passes, and `npx tsc --noEmit -p packages/game-kit` passes.
  - `node skills/game-rules-engine/scripts/check-rules-engine.mjs . | grep '^FAIL'` prints only the `kit-file-missing` lines for `testing/engine-contract.ts` and `testing/contract-intents.ts` (T06).
  - The verbatim check with `skills/game-rules-engine` prints nothing twice: once with `packages/game-kit/src/contract` as the paths, and once with `packages/game-kit/src/testing -type f \( -name 'play-*' -o -name 'json-shape*' \)` in place of `<paths> -type f` (the other two helpers arrive in T06).
  - `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` prints RESULT: PASS (game-kit imports only itself and `fast-check` in tests; no cycles, no `../`).
  - `npm run -s check:fast` is green.

### E02-T06 · The engine contract checks

- **Goal:** one function proves any game engine keeps the contract. `engineContractProblems` plays the engine over seeds and difficulties and reports:
  - an `applyMove` that changes its input, or state JSON cannot carry;
  - moves from `intentToMove` that `listMoves` does not list, a pan mode outside the four, an intent the pan mode never sends, bad `selectRegions`, and a tap in a select region that makes a move;
  - an endless run that can be won, a lose reason outside the catalog, `listMoves` offering moves after the end, a win score that is not whole, parsers that change a saved state, event kinds that are not kebab-case, a `create` that starts a finished game, and runs that differ for the same seed.

  E03's `line-siege-engine.test.ts` and every later game's contract test call it.
- **Skills:** `game-rules-engine`, `unit-and-component-tests`, `pocket-arcade-product-spec`.
- **Tests first:**
  - `packages/game-kit/src/testing/engine-contract.test.ts` (a "Tally" toy game, plus a picking variant for tap-then-tap): one test per problem listed in the goal, plus "finds nothing wrong with a pure, deterministic engine" and "accepts taps that select first and act on the next tap".
  - `packages/game-kit/src/testing/contract-intents.test.ts`: tries every board tap with every tapped tray slot as the selection; reports a selected move that `listMoves` does not list; `engineMemberProblems` accepts a known pan mode with a list of select regions and reports an unknown pan mode and select regions that are not region ids.
  - Red: `check-rules-engine.mjs .` lists `kit-file-missing` for both files. With stubs that return `[]`, every "reports ..." test fails with `Expected [<problem>] Received []`. The "finds nothing wrong" case passes on the stub, as expected: note it in the red log.
- **Build:** copy `testing/engine-contract.ts`, `testing/engine-contract.test.ts`, `testing/contract-intents.ts` and `testing/contract-intents.test.ts` from `skills/game-rules-engine/templates/packages/game-kit/src/` verbatim. Commit `feat(game-kit): add the engine contract checks` (spec 10, 8.13).
- **Done when:**
  - `npx jest packages/game-kit/src/testing --ci --selectProjects unit` passes.
  - `node skills/game-rules-engine/scripts/check-rules-engine.mjs .` prints RESULT: PASS. Every kit file and export is present, `kit-member-missing` finds `selectRegions`, the tap's `selected`, the solver's `final` and `endless`, purity and determinism hold over all of game-kit, and the RNG goldens run for real.
  - The verbatim check with `skills/game-rules-engine` and `packages/game-kit/src/testing` prints nothing.
  - `npm run -s check:fast` is green.

### E02-T07 · Solvers: BFS, IDA* and line replay

- **Goal:** exact solvers prove a level can be won and compute par, and `verifyLine` replays any proof line through the real engine, because a solver is never trusted on its own. Spec 8.1: "each level is checked by a solver before it ships, so no level is impossible, and the solver also calculates par".
- **Skills:** `level-generation-and-solvers`, `unit-and-component-tests`, `pocket-arcade-product-spec`.
- **Tests first:**
  - `packages/game-kit/src/solver/bfs-solve.test.ts`: finds the shortest line, so its length is par, and the goal it ends in; par 0 when the start already wins; `unsolvable` when every line runs into a dead end; stops at the node budget with `budget-exceeded` instead of searching forever; returns the same line on every run.
  - `packages/game-kit/src/solver/ida-star-solve.test.ts`: property, IDA* agrees with BFS par on seeded mazes; at the depth cap it gives `budget-exceeded`, never a false `unsolvable`; solves an open field at par 10 (the Manhattan distance); stops at the node budget.
  - `packages/game-kit/src/solver/verify-line.test.ts`: accepts a legal winning line; reports the first move that is not in `listMoves`, a line that keeps going after the game ended, and a legal line that does not win; `createBfsSolver`'s line replays as a win; `createIdaStarSolver` finds the same par with an admissible heuristic.
  - Red: `node skills/level-generation-and-solvers/scripts/check-levels.mjs .` lists `kit-file-missing` for the five solver files. Stubs that return `{ kind: 'unsolvable' }` and a `verifyLine` that reports nothing fail on assertion diffs.
- **Build:** copy `solver/search-problem.ts`, `bfs-solve.ts`, `bfs-solve.test.ts`, `ida-star-solve.ts`, `ida-star-solve.test.ts`, `engine-solver.ts`, `verify-line.ts` and `verify-line.test.ts` from `skills/level-generation-and-solvers/templates/packages/game-kit/src/` verbatim. Never raise a test's node budget to make a case pass (level-generation-and-solvers anti-pattern). Commit `feat(game-kit): add bfs and ida-star solvers with line replay` (spec 8.1).
- **Done when:**
  - `npx jest packages/game-kit/src/solver --ci --selectProjects unit` passes.
  - `node skills/level-generation-and-solvers/scripts/check-levels.mjs . | grep -E '^FAIL packages/game-kit/src/solver/'` prints nothing.
  - The verbatim check with `skills/level-generation-and-solvers` and `packages/game-kit/src/solver` prints nothing.
  - `npm run -s check:fast` is green.

### E02-T08 · Stars, pack unlocking, level tables and the daily start

- **Goal:** the level kit's player-facing rules:
  - `starsFor` follows spec 8.1: par games get 3 stars at or under par, 2 up to par + 2 and 1 for finishing; score games get 1, 2 or 3 stars at thresholds `[win, two, three]`; a loss gets 0.
  - Packs open one level after another and the first level of a pack by stars alone: half the earlier stars, 0, 45 and 90 for packs of 30 (spec S8).
  - `toLevelEntries` types a level table.
  - `dailyStart` turns today's date and the game's salt into the daily seed and difficulty (spec 8.3).
  - `renderCells` draws ASCII boards for the data goldens E03 pins (golden-tests places it at Shell step 2).
- **Skills:** `level-generation-and-solvers`, `golden-tests`, `unit-and-component-tests`, `pocket-arcade-product-spec`.
- **Tests first:**
  - `packages/game-kit/src/levels/star-rating.test.ts`: the par and score cases from the goal and 0 for a loss under either rule. Property: fewer moves never earn fewer stars.
  - `packages/game-kit/src/levels/pack-progress.test.ts`: `defaultStarsToUnlock` asks half the earlier stars (0, 45, 90 for packs of 30); level 1 is open on a fresh save and nothing after it; the next level opens once the previous one is won; a pack's first level opens by stars alone; a locked pack stays shut and says how many stars are missing; a level outside every pack is rejected; `nextLevel` returns the following level, or `null` after the last.
  - `packages/game-kit/src/levels/level-table.test.ts`: a valid table comes back unchanged and typed.
  - `packages/game-kit/src/levels/daily-start.test.ts`: pins the daily seed for a date and salt; returns `null` for a game without a daily mode.
  - `packages/game-kit/src/testing/render-cells.test.ts`: one text row per board row, filled cells `#` and empty `.`; an empty board gives an empty string.
  - Red: `check-levels.mjs .` lists `kit-file-missing` for these modules. Stubs (`starsFor` returning `0`, `isLevelUnlocked` returning `true`, `dailyStart` returning `null`, `renderCells` returning `''`) fail on assertion diffs.
- **Build:** copy `levels/star-rating*`, `levels/pack-progress*`, `levels/level-table*`, `levels/daily-start*` and `testing/render-cells*` from `skills/level-generation-and-solvers/templates/packages/game-kit/src/` verbatim. Commit `feat(game-kit): add star rating, pack unlocking and the daily start` (spec 8.1, 8.3, S8).
- **Done when:**
  - `npx jest packages/game-kit/src/levels packages/game-kit/src/testing/render-cells.test.ts --ci --selectProjects unit` passes.
  - `node skills/level-generation-and-solvers/scripts/check-levels.mjs . | grep -E '\[(star-rule|daily-seed-golden)\]|^FAIL packages/game-kit/src/(levels/(star-rating|pack-progress|level-table|daily-start)|testing/render-cells)'` prints nothing. The star rule (par 7, thresholds `[100, 250, 400]`) and the daily goldens run against the real `starsFor` and `dailySeed`.
  - The verbatim check with `skills/level-generation-and-solvers` prints nothing when its `find` reads `find packages/game-kit/src/levels packages/game-kit/src/testing -type f \( -name 'star-rating*' -o -name 'pack-progress*' -o -name 'level-table*' -o -name 'daily-start*' -o -name 'render-cells*' \)` (the other level files arrive in T09).
  - `npm run -s check:fast` is green.

### E02-T09 · Level plans, the levels contract and the witness solver

- **Goal:** the machinery E03 uses to generate and prove Line Siege's 90 levels.
  - `planLevelTable` fills packs in level order from a `LevelPlan`: candidate seeds from `candidateSeed(gameId, level, attempt)` (no clock, no `Math.random`), solver-rated, distinct, following the curve.
  - `levelsContractProblems` replays every proof line and checks numbering, curve, packs against `game.config.ts`, unlock rules, the 0..99 range and endless at difficulty 100.
  - `createWitnessSolver` proves score games that draw during play (Line Siege) with a greedy bot from a fixed seed; a lost witness is `budget-exceeded`, never `unsolvable`.

  Spec 8.1 and 15.7 "every shipped level is proven winnable" depend on these three.
- **Skills:** `level-generation-and-solvers`, `golden-tests`, `unit-and-component-tests`, `pocket-arcade-product-spec`.
- **Tests first:**
  - `packages/game-kit/src/levels/plan-level-table.test.ts`: fills every pack in level order with solver-rated, distinct levels; hands `rate` the solver line and the state it ends in; records the difficulty curve and par; gives the same table on every run; reports a level whose candidates are all rejected; skips a candidate whose board repeats an earlier level, and candidates over budget; lays packs out as consecutive ranges that unlock by half the earlier stars. It also pins the candidate seed hash: a changed hash regenerates every table, so this value never changes either.
  - `packages/game-kit/src/levels/levels-contract.test.ts`: no problems for a consistent, solver-checked table. It reports a par that differs from the solver; gaps, curve drift and packs that do not match `game.config`; pack layouts that break the unlock rules; a repeated level and a pack count that differs; levels above 99 and an endless run off the endless difficulty; and a level the solver cannot solve or whose line does not replay.
  - `packages/game-kit/src/levels/witness-solver.test.ts`: returns the winning line, its length as par and the final state; a lost witness is `budget-exceeded`, never `unsolvable`; stops once the policy has seen more than `maxNodes` moves; a start that is already won has par 0. Property: the same start gives the same answer (fixed bot seed), and every win replays through `verifyLine`.
  - Red: `check-levels.mjs .` lists `kit-file-missing` for `levels/level-plan.ts`, `plan-level-table.ts`, `levels-contract.ts` and `witness-solver.ts`. Stubs (`planLevelTable` returning an empty table, `levelsContractProblems` returning `[]`, a witness that always says `unsolvable`) fail on assertion diffs.
- **Build:** copy `levels/level-plan.ts`, `levels/plan-level-table*`, `levels/levels-contract*` and `levels/witness-solver*` from `skills/level-generation-and-solvers/templates/packages/game-kit/src/` verbatim. Do not copy `packages/tooling/src/levels/generate-levels.ts`: Shell step 3 (E03) copies it with the pilot's levels. Commit `feat(game-kit): add level plans, the levels contract and witness solver` (spec 8.1, 15.7).
- **Done when:**
  - `npx jest packages/game-kit/src/levels packages/game-kit/src/solver --ci --selectProjects unit` passes.
  - `node skills/level-generation-and-solvers/scripts/check-levels.mjs . | grep '^FAIL'` prints exactly one line, `FAIL packages/tooling/src/levels/generate-levels.ts [kit-file-missing] the level table generator is missing ...` (due at Shell step 3).
  - The verbatim check with `skills/level-generation-and-solvers` and `packages/game-kit/src/levels` prints nothing.
  - `npm run -s check:fast` is green.

### E02-T10 · Prove Shell step 2

- **Goal:** show with commands that Shell step 2 is done (pocket-arcade-index "done when") and that the new kit meets every gate that is due, so E03 can start on a proven base.
- **Skills:** `game-rules-engine`, `daily-and-statistics`, `level-generation-and-solvers`, `architecture-and-boundaries`, `unit-and-component-tests`, `naming-conventions`, `typescript-and-lint-rules`, `dependency-management`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`, `troubleshooting-playbook`.
- **Tests first:** no new behaviour. If any check below fails on code this epic changed, write the failing test that shows the problem first, then the fix, in its own commit. A FAIL on a verbatim copy is a library defect (see **Owner**).
- **Build:** run the "Done when" list in order and copy each RESULT line and the coverage and mutation summaries into `reports/` for the evidence report. Nothing is committed unless a fix was needed.
- **Done when:**
  1. `node skills/game-rules-engine/scripts/check-rules-engine.mjs .` prints RESULT: PASS.
  2. `npx jest packages/game-kit/src/dates packages/game-kit/src/rng --ci --selectProjects unit` passes (the date, daily-seed and RNG goldens ship as unit tests).
  3. `npx jest packages/game-kit --ci --selectProjects unit --coverage --collectCoverageFrom='packages/game-kit/src/**/*.ts' --collectCoverageFrom='!packages/game-kit/src/testing/**' --coverageThreshold='{}'` passes and its "All files" line reads at least 95 % statements, lines and functions and 90 % branches. Only `npm run test:coverage` judges the thresholds, and it is green.
  4. `npx stryker run --mutate packages/game-kit/src/rng/sfc32.ts,packages/game-kit/src/dates/date-key.ts,packages/game-kit/src/dates/daily-seed.ts,packages/game-kit/src/levels/star-rating.ts` finishes, then `node skills/unit-and-component-tests/scripts/check-mutation-report.mjs --all` prints RESULT: PASS (score at least 75). Surviving mutants go into the report.
  5. `node skills/daily-and-statistics/scripts/check-daily-stats.mjs .` prints RESULT: PASS with exactly the five SKIP lines of T03.
  6. `node skills/level-generation-and-solvers/scripts/check-levels.mjs . | grep '^FAIL'` prints only the `generate-levels.ts` line of T09.
  7. `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` prints RESULT: PASS.
  8. These print RESULT: PASS:
     - `node skills/tdd-workflow/scripts/check-tests.mjs .`
     - `node skills/unit-and-component-tests/scripts/check-test-code.mjs .`
     - `node skills/naming-conventions/scripts/check-file-names.mjs .`
     - `node skills/naming-conventions/scripts/check-code-names.mjs .`
     - `node skills/typescript-and-lint-rules/scripts/check-source.mjs .`
  9. `node skills/dependency-management/scripts/check-deps-policy.mjs .` prints RESULT: PASS.
  10. `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints RESULT: PASS with exactly the seven not-yet-due `script-target` SKIP lines from E01: `i18n:verify` (step 6); `audit:network`, `audit:privacy` and `build:ios:sim` (step 8); `e2e:ios` and `screenshots:ios` (step 10); `release:ios` (step 11).
  11. `npm run -s check:fast` is green and the verify steps due at Shell step 2 are green.
  12. `npm run test:golden` is not due: it finds no golden test until Shell step 3 (E03). Record that in the report, never make it pass early.
- **Owner:** only if a check fails on a file copied verbatim (a library defect, not something to "fix" by editing the copy). Send one stop-and-ask message (git-commits-and-reporting `templates/owner-request.md`, checked with `check-report.mjs <file> --kind request`) naming the file, the FAIL line and the template path. Meanwhile Claude finishes the other checks and T11's review of everything else.

### E02-T11 · Simplify, code review, re-run the gates and merge

- **Goal:** the branch passes an independent quality and correctness review, every confirmed finding is fixed test-first, the gates are green again, the history is clean, and the work is merged with an evidence report the owner can read.
- **Skills:** `tdd-workflow`, `golden-tests`, `git-commits-and-reporting`, `quality-gates`, `game-rules-engine`, `level-generation-and-solvers`.
- **Tests first:** every accepted finding gets a failing test that shows the problem (red for the right reason) before its fix, in its own commit.
- **Build:** follow "Close the epic" below, steps 1 to 5. In this epic almost every changed line is a verbatim canonical copy:
  - Decline any `/simplify` suggestion that rewrites a copied file (contract, rng, dates, geom, timeline, testing, solver, levels). Those files must stay byte-identical to their templates, which later steps and the checkers compare against. List each declined suggestion with this reason in the report.
  - Never accept a finding whose fix would change a pinned value: the RNG goldens, the daily seeds or the candidate seed hash (game-rules-engine rule 4, level-generation-and-solvers rule 6).
- **Done when:**
  - Every "Done when" of T01 to T10 passes again.
  - `node skills/tdd-workflow/scripts/check-tests.mjs .` prints RESULT: PASS.
  - `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD` prints RESULT: PASS.
  - `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD` prints RESULT: PASS.
  - `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD` prints RESULT: PASS (no golden path changed).
  - `npm run test:coverage` is green.
  - `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e02-game-kit-contract.md --kind slice` prints RESULT: PASS.
  - The branch is merged into `main` with `--no-ff`.
- **Owner:** only if `/code-review` confirms a correctness bug inside a verbatim canonical file, or a fix would change a pinned golden. Send one stop-and-ask message with the failing test that shows it and the template path. The fix belongs in the skill library, which the lead owns. Meanwhile Claude fixes every other finding, writes the report with this item under "Not tested or not verified", and does not merge until the owner answers.

## Close the epic

1. Re-run every task's "Done when" and `npm run verify`. At Shell step 2, verify must pass `format:check`, `lint` and `typecheck` and stop at `i18n:verify` (expected until E06). Then run the verify steps due at Shell step 2 (see "How we work"); all green.
2. Run `/simplify` over the branch's changes (`git diff main...HEAD`). Apply its fixes, except suggestions on verbatim canonical copies, which are declined (T11); where behaviour changes, test first. Then run `npm run verify` and the due verify steps again.
3. Run `/code-review` on the branch (target `epic/e02-game-kit-contract` against `main`). Fix every confirmed finding test-first (a failing test that shows the problem, then the fix). A confirmed bug in a canonical copy or in a pinned golden goes to the owner (T11 **Owner**). Then run `npm run verify` and the due verify steps again.
4. Write the epic's evidence report (git-commits-and-reporting, slice form): copy `skills/git-commits-and-reporting/templates/evidence-slice.md` to `reports/evidence-<YYYY-MM-DD>-e02-game-kit-contract.md` and fill it from `reports/` and the Jest summary.
   - Outcome in plain words: the game kit every game is built on, with frozen random numbers and daily seeds.
   - Tests line: from `npm run test:coverage`, golden 0 (the golden project has no tests until E03).
   - The red runs from `reports/red/`, the coverage and mutation summaries, and the commits.
   - "Not tested or not verified": the expected-red verify steps with their reasons, `npm run test:golden` (due at E03), and the push the pre-push hook refused.
   - "Owner steps (not blocking)": no fa or ckb texts in this epic (R3), the Line Siege play-test still open (G6), the sound previews still open (G9).

   Check it with `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e02-game-kit-contract.md --kind slice`.
5. Merge: `git switch main && git merge --no-ff epic/e02-game-kit-contract && git push origin main`, then delete the branch (`git branch -d epic/e02-game-kit-contract`, and `git push origin --delete epic/e02-game-kit-contract` if it was ever pushed). The push runs the pre-push hook, so it succeeds only once `npm run verify` is green (Shell step 8, E10) and the owner has said so. Until then `main` stays ahead of `origin/main` locally, and the report says so; never bypass the hook.
