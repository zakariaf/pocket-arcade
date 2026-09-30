---
name: game-rules-engine
description: Builds a game's pure rules - GameModule contract, create/listMoves/applyMove/outcome, events, sfc32 RNG goldens, determinism, persistence, counters, property tests. Use when writing rules, moves, scoring or randomness. Not for levels (level-generation-and-solvers) or wiring (game-host-integration).
---

# Game rules engine

Makes every Pocket Arcade game's rules a pure, deterministic TypeScript engine behind the `GameModule` contract: the same seed and moves give the same states on every phone, in Jest and in Node, so bots, solvers, saves, undo, replays and daily challenges can all trust it. A script proves the contract files, the seeded RNG against its golden values, and each game's rules, by running them.

## Rules that must hold

1. **The engine functions are pure and live in `apps/<game-id>/src/rules/`, one per file:** `create.ts`, `list-moves.ts`, `apply-move.ts`, `outcome.ts`, importing only `@e07/game-kit` and their own files. Why: bots, solvers, goldens and the save replay call them headlessly thousands of times; one React Native import breaks all of that.
2. **Determinism policy:** only `+ - * /`, `%`, bitwise operators and `Math.sqrt/imul/floor/round/abs/min/max/PI`; no `**`, no other `Math.*`, no `Math.random`, `Date`, `performance.now` or `Intl` (tests too: no clock, no random). Why: Hermes and V8 compute transcendental maths differently, so replays and daily levels would diverge between phones.
3. **All randomness comes from the seeded sfc32 RNG**, and a game that draws after `create()` keeps `rng: RngState` in its state and threads it through every draw. Why: same seed, same level, same daily, same replay on every device (spec 8.3, 8.13).
4. **`sfc32.ts` and its golden values never change:** `seedRng(1)` draws `1828152527, 3394835397, 2967886022, 2251045104, 4148684523` and `hashSeed('line-siege:2026-09-26')` is `2224665572`. Why: they are the compatibility contract of every generated level, daily challenge and saved replay; a change is a new RNG and a question for the owner.
5. **Copy the contract files verbatim** from `templates/packages/game-kit/src/contract/` and never rename a member (`create`, `listMoves`, `applyMove`, `outcome`, `panMode`, `selectRegions`, `intentToMove`, `buildTimeline`, `hud`, `undo`, `hints`, `continueRun`; `identity` is `{ id, nameId, winTitleId, taglineId }`). Why: the Shell, the board skills and the checks all depend on these exact names and shapes.
6. **The engine declares the board's pan gesture as `panMode`** (`'none'` taps only, `'swipe'`, `'drag'`, `'aim'`; real-time games `'none'`), and `intentToMove` turns only the intents that mode sends into moves. Why: the Shell's board host enables exactly that gesture; a game expecting swipes on a `'none'` board is unplayable, and `engineContractProblems` reports it.
7. **Difficulty is one scale, whole numbers 0..100** (`contract/difficulty.ts`): `create` clamps to it, levels and the daily use 0..99, and 100 (`ENDLESS_DIFFICULTY`) is the endless run of a game with an endless mode, which is never won. Why: the curve, the tuning rows, the daily and the save schema must mean the same numbers, and there is no mode argument to tell an endless run apart.
8. **A selection is UI state, never a move.** Tap-then-tap games list their selecting regions in `selectRegions` (`[]` for most, `['tray']` for Line Siege); `intentToMove` returns `null` for a tap there and reads `intent.selected` on the next tap. Why: a `select` move would be seen by bots, the witness solver, par, undo and the counters.
9. **State, moves and events are JSON-safe:** plain objects, arrays, finite numbers, strings, booleans, `null`; no `Map`, `Set`, `Date`, classes or `undefined`. Why: runs are saved as JSON after every move and replayed; anything JSON drops corrupts a save.
10. **`applyMove` never changes its input and throws `RangeError` for an illegal move.** Why: the undo history keeps old states by reference, and a loud failure beats a silently corrupted save.
11. **`listMoves` is empty exactly when `outcome` is not `playing`, in a fixed order; each way of losing has its own `<game-id>.lose.<reason>` catalog key; win scores are whole numbers >= 0.** Why: bots, solvers and the Shell's end-of-run logic rely on it, and every visible sentence is a translated message.
12. **Events are past tense, kebab-case, and carry every id and from/to value the animation and counters need.** Why: the board only receives the final state; the events alone explain how it got there.
13. **Every rules module has example tests, fast-check properties (determinism, invariants, end state, JSON round trip) and one pinned `GOLDEN_*` value, at 95/95/95/90 coverage.** Why: the owner never reads code; tests are the specification, and properties alone let real bugs survive.

## Workflow

1. **Classify and plan.** Read [references/engine-contract.md](references/engine-contract.md). Classify the game (turn-based, simulate-then-replay, real-time), write down moves, win, each way of losing, score, undo, hints, continue, whether it has an endless mode (difficulty 100) and the input (taps only, swipe, drag or aim: the engine's `panMode`; tap-then-tap: its `selectRegions`) in plain words, and ask the owner if the design notes do not say (defaults: unlimited undo, no hints, no continue).
2. **Install the game-kit contract once per repo.** First install fast-check, which the kit's and the rules' tests import and the bootstrap leaves out (without it `tsc` and `eslint` fail with TS2307 on every copied test): `npm install -D -E fast-check@4.10.2` at the repo root (skip it when the root `devDependencies` already pin it), then `npm approve-scripts --allow-scripts-pending` and, if it lists `fsevents` (the macOS file watcher of jest-haste-map), `npm approve-scripts fsevents`. Then run `node ${CLAUDE_SKILL_DIR}/scripts/check-rules-engine.mjs .`; for each `kit-file-missing` copy `templates/packages/game-kit/src/<path>` to `packages/game-kit/src/<path>` verbatim (with its test). `geom/board-layout.ts`, `geom/classify-swipe.ts`, `timeline/track.ts` and `contract/input-intent.ts` are shared with the board skills: copy them only when missing, they are the same text. A `kit-member-missing` line names an older contract copy (no `selectRegions`, no tap `selected`, no solver `final`): replace that file with the template and fix what `tsc` then reports. Read [references/determinism-and-rng.md](references/determinism-and-rng.md) before touching anything random.
3. **Copy the rules templates.** `templates/apps/__GAME_ID__/src/rules/` to `apps/<game-id>/src/rules/` and `templates/apps/__GAME_ID__/src/testing/` to `apps/<game-id>/src/testing/`, renaming files and replacing `__GAME_ID__` (kebab-case), `__GAME_PASCAL__` and `__GAME_CONST__` (UPPER_SNAKE). The template is a complete small game (Tap Flip); keep its structure and replace its logic test by test. Its balance numbers live in `<game-id>-tuning.ts` (board side by tuning row, scramble presses, moves per press, points, continue moves); keep every new balance number there too.
4. **Add these keys** to `apps/<game-id>/src/i18n/{en,de,fa,ckb}.json`: every catalog key the templates name, with its four texts, is in [assets/template-catalog-keys.json](assets/template-catalog-keys.json) (`__GAME_ID__.hud.moves`, `.continue.more-moves`, `.lose.out-of-moves`, `.stats.cells-flipped`, `.stats.boards-cleared`, `.stats.biggest-flip`), with `__GAME_ID__` replaced. When a key is renamed for the game (a new lose reason, hud line or counter), add the new key in all four languages instead (a game scaffolded with `--lose-reason <slug>` already has `<game-id>.lose.<slug>` in its catalogs: rename the `lose.out-of-moves` key in the copied `outcome.ts` and its test to it), put fa and ckb on the native review list, and keep the catalogs sorted. Without them the contract test and `check-rules-engine.mjs` (`catalog-key-missing`) fail.
5. **Write the rules test-first, in this order,** following [references/writing-rules.md](references/writing-rules.md) and [references/testing-rules.md](references/testing-rules.md): types, `create` (with its pinned golden), `outcome` and `listMoves`, `applyMove`, then persistence, statistics counters, and the bot and example states. For each behaviour: one failing test, read the failure (an assertion, not an import error), minimum code, green. Imitate [examples/line-siege/rules/](examples/line-siege/rules/apply-move.ts) (Line Siege v1: tray refills and spawns drawn from `rng` in the state, two ways of losing, an endless row, a continue for both losses) for a game that draws during play.
6. **Assemble the engine** (`<game-id>-engine.ts`) once the board skills have written `rules/intent-to-move.ts` and `board/build-timeline.ts`: set `panMode` and `selectRegions` from the input chosen in step 1, then write its contract test (`<game-id>-engine.test.ts`) with the game's real intents (taps with `selected: null`, taps on the select regions, plus the swipes, drags or aims its pan mode sends) and, with an endless mode, `endless: <CONST>_LEVELS.endless` ([examples/line-siege/rules/line-siege-engine.test.ts](examples/line-siege/rules/line-siege-engine.test.ts)). The pilot (Line Siege, Shell step 3) is copied, not written: its rules come from this example, and because `line-siege-engine.ts` names `buildTimeline`, the same step copies the three board files the timeline needs from board-rendering-skia's Line Siege example (`board/build-timeline.ts`, `board/board-ids.ts` and `board/monster-tracks.ts`, with their tests); the rest of `board/` waits for the board kit at Shell step 7.
7. **Format and lint the new files:** `npx eslint --fix apps/<game-id>` and `npx prettier --write apps/<game-id>/src` (import order and wrapping depend on the game id), then `npx tsc --noEmit -p apps/<game-id>` and `npx tsc --noEmit -p packages/game-kit`.
8. **Run the tests with coverage:** `npx jest apps/<game-id>/src/rules apps/<game-id>/src/testing --ci --selectProjects unit --coverage --collectCoverageFrom='apps/<game-id>/src/rules/**/*.ts' --collectCoverageFrom='apps/<game-id>/src/testing/**/*.ts' --coverageThreshold='{}'` (paths first: `--selectProjects` takes every following word as a project name; `--coverageThreshold='{}'` because a subset run cannot meet the global numbers) and read the table: the rules stay at 95/95/95/90. Only `npm run test:coverage` judges the thresholds. When a module is finished, run Stryker on it (break threshold 75 %).
9. **Run the check** `node ${CLAUDE_SKILL_DIR}/scripts/check-rules-engine.mjs . --game <game-id>`; fix every `FAIL` line (each names the file, the rule and the fix) and rerun until it prints `RESULT: PASS`. An `engine-contract` line names the seed and difficulty: add that case as an example test first, then fix the engine.

## Definition of done

- [ ] The root `package.json` pins `fast-check` exactly in `devDependencies` (no `kit-test-dependency` line).
- [ ] `packages/game-kit/src/contract/` holds the thirteen contract files (with `difficulty.ts` and its test), `rng/sfc32.ts` with its golden test, `pick-at.ts`, and the five testing helpers (`play-choices`, `play-bot`, `json-shape`, `engine-contract`, `contract-intents`), all passing their tests.
- [ ] `apps/<game-id>/src/rules/` has `<game-id>-types.ts`, `create.ts`, `list-moves.ts`, `apply-move.ts`, `outcome.ts`, persistence and stats files, each with tests; `apps/<game-id>/src/testing/<game-id>-testing.ts` has a bot and the four example states.
- [ ] Every rules test file follows the loop: examples, fast-check properties, one `GOLDEN_*` value; coverage of the rules folder is at least 95/95/95/90.
- [ ] Every catalog key the rules name (hud, stats, continue, each `.lose.<reason>`) is in all four catalogs.
- [ ] Once assembled, the engine sets `panMode` and `selectRegions`, and `<game-id>-engine.test.ts` runs `engineContractProblems` with the game's intents (and `endless` when the game has an endless mode) and returns `[]`.
- [ ] `npx tsc --noEmit`, `npx eslint --max-warnings 0` and `npx prettier --check` pass for `packages/game-kit` and `apps/<game-id>`; no `__GAME_` placeholder is left.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-rules-engine.mjs . --game <game-id>` prints `RESULT: PASS`

## Anti-patterns

- **`Math.random()` "just for a quick shuffle", or a seed from the clock.** Replays and daily levels break silently; thread `nextInt(state.rng, n)` and keep the RNG in the state.
- **Re-seeding inside `applyMove` from the move count** to avoid storing the RNG. Two runs that reach the same position by different paths then draw different futures; carry the stream in the state.
- **Mutating the state in place for speed** (`state.cells[i] = 1`). The undo stack and the saved snapshot share references; build new arrays with `map` and spreads.
- **Returning the old state for an illegal move.** The bug hides until a save is corrupted; throw a `RangeError`.
- **Legality in the gesture code or in the Shell.** Bots and solvers would disagree with players; only `listMoves` and `intentToMove` decide.
- **Choosing the pan mode in the Shell or in `game.config.ts`.** It belongs to the engine next to `intentToMove`, where the contract test can prove the two agree.
- **A `select` move for tap-then-tap.** It pollutes bots, the witness, par, undo and the counters; list the region in `selectRegions` and read `intent.selected`.
- **A `mode` argument, or a tuning table indexed 0..3.** Difficulty is one 0..100 scale; pick tuning rows with `rowFor` and mark the endless run with difficulty 100.
- **Casting `json as State` in `parseState`.** A damaged or old save then crashes later; rebuild the typed value with explicit checks and return `null` otherwise.
- **Editing a golden to make a test pass.** A changed golden means shipped levels changed; change it only on purpose, with a `Gate-Change:` trailer, and never the RNG goldens.
- **`Math.atan2` for a direction or `**` for a square.** Use dot products, committed direction tables and `x * x`.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/engine-contract.md](references/engine-contract.md) | GameModule members, engine semantics, rules members, persistence, stats, testing spec, contract tests, game classes | Workflow step 1 |
| [references/determinism-and-rng.md](references/determinism-and-rng.md) | The determinism policy and why, sfc32, its API and golden values, randomness in rules | Step 2, and before anything random |
| [references/writing-rules.md](references/writing-rules.md) | Types, create, listMoves, outcome, applyMove, hud/undo/hints/continue, persistence, counters, bot, assembly, size limits | Steps 3, 5 and 6 |
| [references/testing-rules.md](references/testing-rules.md) | The loop, examples, property checklist, pinned goldens, the contract test, gates, commands, traps | Steps 5 and 8 |
| `templates/packages/game-kit/src/contract/` | The thirteen contract files (canonical, copy verbatim): the types, `input-intent.ts` (shared with the board skills; tap carries `selected`) and `difficulty.ts` (`ENDLESS_DIFFICULTY`, `MAX_LEVEL_DIFFICULTY`, `clampDifficulty`, `isEndlessDifficulty`, `rowFor`) with its test | Step 2 |
| `templates/packages/game-kit/src/rng/` | `sfc32.ts` with its golden test, `pick-at.ts` with its test | Step 2 |
| `templates/packages/game-kit/src/testing/` | `play-choices`, `play-bot`, `json-shape`, `engine-contract` and `contract-intents` (pan mode, select regions, tap selections, endless never won), each with its test | Step 2 |
| `templates/packages/game-kit/src/geom/` | `board-layout.ts` (+ two tests), `classify-swipe.ts` (+ test): types the contract imports; copy only when missing | Step 2 |
| `templates/packages/game-kit/src/timeline/` | `track.ts` (+ test): `Track` and `Motion` for `buildTimeline`; copy only when missing | Step 2 |
| `templates/apps/__GAME_ID__/src/rules/` | The template game's types, create, list-moves, apply-move, outcome, flip-cells, engine, persistence, stats, and their tests, plus its tuning (`__GAME_ID__-tuning.ts` and test: every balance number, rows picked with `rowFor`; synced from the library, the same file game-balance-and-bots ships) | Step 3 |
| `templates/apps/__GAME_ID__/src/testing/` | Greedy bot and example states, with a test | Step 3 |
| `examples/line-siege/rules/` | Line Siege v1, the whole verified rules folder (types, tuning with the endless row, create and opening, placement, board lines, monster attack and march, outcome, continue, intent-to-move with tap-then-tap, engine, persistence, stats, the evaluation the bot and witness use) with example, property and golden tests | Step 5, for games that draw during play |
| `examples/line-siege/i18n/` | Line Siege's four catalogs: every key its rules name (`line-siege.lose.broke-through`, `.lose.board-full`, `.progress`, `.progress.endless`, `.continue.push-back`, the stats labels) | Step 4, as a model of complete game catalogs |
| `assets/template-catalog-keys.json` | Every catalog key the Tap Flip templates name, with its en, de, fa and ckb text | Step 4 |
| `scripts/check-rules-engine.mjs` | Checker: kit files and current contract members, the exact fast-check pin its tests need, RNG goldens (run for real), purity, determinism, JSON state, events, throws, reason keys, catalog keys, tests, assembly with `panMode` and `selectRegions`, a seeded run of the rules, endless never won | Steps 2 and 9, and at the end |
| `scripts/lib/` | `app-modules.mjs` (loads the repo's TypeScript), `ts-scan.mjs`, `kit-checks.mjs`, `rules-checks.mjs`, `engine-run.mjs`, `assemble-fixtures.mjs` | When changing the checker |
| `scripts/selftest.mjs` | Proves the checker: the templates installed as a game must pass, 27 planted bugs must fail | After changing the checker or a template |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | `check-rules-engine/bad-*/`: one planted bug each (`mutation.json`) and the expected output (`EXPECT.txt`) | When adding a rule to the checker |

## Related skills

- `level-generation-and-solvers` - generators, solvers and par, packs, stars and the daily level built on `create`.
- `game-host-integration` - `ShellGameModule`, `src/index.ts` assembly and the Game screen session.
- `board-gestures-and-input` - `intentToMove` and the intents the contract test feeds in.
- `board-rendering-skia` - `buildTimeline`, `toView` and the board that shows the events.
- `realtime-game-loop` - sims for real-time games and simulate-then-replay physics.
- `game-balance-and-bots` - bot policies, `*.sim.test.ts` and difficulty curves.
- `tdd-workflow` - the red-green loop and evidence for every change.
- `new-game-scaffold` - creating `apps/<game-id>` before the rules.
