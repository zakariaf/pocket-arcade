# Writing a game's rules

The order and the decisions for turning a game design into `apps/<game-id>/src/rules/`, using the template game (Tap Flip: tap a cell to flip it and its neighbours, dark board wins, running out of moves loses) and the Line Siege example.

## Contents

- Before the first test
- Step 1: types (state, move, event)
- Step 2: create
- Step 3: listMoves and outcome
- Step 4: applyMove
- Step 5: the rules members (hud, undo, hints, continue)
- Step 6: persistence
- Step 7: statistics counters
- Step 8: bot and example states
- Step 9: the engine assembly
- Size limits and how to split
- Simulate-then-replay and real-time games

## Before the first test

1. Name the spec lines the work serves (spec 10 RULES, 8.1, 8.10, the game's row in spec 13) and quote them in the first test's title or a comment.
2. Classify the game (turn-based, simulate-then-replay or real-time; `engine-contract.md`).
3. Write down, in plain words: what a move is, when the game is won and lost, what the score is, whether undo is unlimited or limited, whether a solver can give hints, and what the one continue does. If the design notes do not say, ask the owner; the default is unlimited undo, no hints, no continue.

## Step 1: types (state, move, event)

File `<game-id>-types.ts` (`tap-flip-types.ts` in the template).

- **State** is JSON-safe and complete: plain objects, arrays, numbers, strings, booleans, `null`. No `Map`, `Set`, `Date`, class instances, functions, `undefined` values, `NaN` or typed arrays (typed arrays live only in a real-time sim). Everything the next move needs is in it, including `rng: RngState` when the game draws during play and counters such as `moves` and `maxMoves`.
- Prefer small integers: grid cells as `0 | 1` numbers, positions as `row * cols + col` indices, HP and scores as integers.
- **Move** says what the player chose in board terms (Tap Flip `{ kind: 'flip', col, row }`; Line Siege `{ kind: 'place-block', trayIndex, col, row }`, the block of tray slot `trayIndex` with its top-start anchor on that cell); `applyMove` decides what it does. Moves are imperative verb-noun kinds, logged in the save and replayed, so they are JSON-safe too. A selection (tap a block, then tap the grid) is never a move: it is UI state (`engine-contract.md`, "Tap-then-tap").
- **Events** are past tense, kebab-case, and carry every id and from/to value the animation and the statistics need (Tap Flip `'cells-flipped' { cells }`; Line Siege `'block-placed' { trayIndex, piece, cells }`, `'column-cleared' { col }`, `'beam-fired' { lane, targetId }`, `'monster-defeated' { monsterId, monsterKind, lane, row }`, `'monster-moved' { monsterId, fromRow, toRow }`, `'wall-breached' { monsterId, monsterKind, lane, heartsLeft }`). Anything that disappears (a defeated monster) must be drawable from its events alone, because the board only receives the final state.
- Export `<Pascal>State`, `<Pascal>Move`, `<Pascal>Event` and `<Pascal>Result = ApplyResult<State, Event>`.

## Step 2: create

`create(seed, difficulty)` in `create.ts`:

- Clamp difficulty to whole numbers 0..100 (`clampDifficulty` from `contract/difficulty.ts`), then map it to the game's knobs (Tap Flip's `shapeFor` reads its tuning: the board side from `knobsFor(difficulty)`, which picks one of three rows with `rowFor` (3x3, 4x4, 5x5), and 2..12 scramble presses from `pressesFor`). The level curve (`levels.difficultyFor`, 0..99) and the daily feed this function, so keep the mapping monotonic: more difficulty never makes a level easier.
- A game with an endless mode treats 100 (`ENDLESS_DIFFICULTY`) as the endless run: its tuning has an endless row with goal 0, and `outcome` never returns `won` there (`engine-contract.md`, "One difficulty scale, and the endless run"). Store the clamped difficulty in the state when later rules need it (Line Siege's `state.difficulty`).
- Draw randomness only through `seedRng(seed)` and `nextInt`; thread the state through a loop.
- Guarantee a playable start: `outcome(create(...))` is `playing`. The template scrambles a solved board with seeded presses, which also makes every level solvable in at most `presses` moves; generate-and-test generators belong to level-generation-and-solvers.
- Pin one golden in `create.test.ts` (`GOLDEN_SEED_1_BOARD`): the exact board `create(1, 0)` returns. A diff there means shipped levels changed.

## Step 3: listMoves and outcome

- `outcome(state)` checks the win first ("won beats lost": clearing with the last move wins), then the loss, then `playing`. A game may make a deliberate, documented exception: Line Siege checks hearts 0 first (a breach of the last heart loses even when that march ended the wave), then the finished wave (won), then no block fitting (lost), because the wall falling is the game's defining loss. Win score: a whole number >= 0 (Tap Flip: spare moves x 10). Loss: `{ kind: 'lost', reasonKey: '<game-id>.lose.<reason>' }`, one key per way of losing, the reason in kebab words for what happened, and every key in all four catalogs (`tap-flip.lose.out-of-moves` "No moves left", `flock-tilt.lose.wolf-got-sheep`, `line-siege.lose.broke-through` "The monsters broke through", `line-siege.lose.board-full` "No room left for the blocks").
- A game may break "won beats lost" on purpose and say so in `outcome.ts`: Line Siege checks no hearts left (lost), then the wave over (won, never at the endless difficulty), then no tray block fitting anywhere (lost), then playing, so a breach of the last heart loses even when that monster was the wave's last.
- `listMoves(state)` returns `[]` when `outcome(state).kind !== 'playing'`, else every legal move in a fixed order (row by row, then tray slot). Bots, solvers and the contract test enumerate it; its order is part of determinism.
- Keep them in separate files; `list-moves.ts` may import `outcome`.

## Step 4: applyMove

`applyMove(state, move)` in `apply-move.ts`:

1. Validate: game still playing, move inside the board, target free, tray slot exists. If not: `throw new RangeError(\`illegal move ${JSON.stringify(move)}\`)`. The Shell only passes moves `intentToMove` produced from `listMoves`, so a throw means a bug, and failing loudly beats corrupting a save.
2. Build the next state with spreads and `map`; never assign into the input (`state.cells[i] = ...` is a bug the contract test catches).
3. Collect events in the order they happen (`cells-flipped`, then `board-cleared`).
4. Return `{ state: next, events }`.

Continuous phases (a ball run, a cascade) are simulated inside `applyMove` with a fixed step and returned as timestamped events (see the last section).

## Step 5: the rules members (hud, undo, hints, continue)

In `<game-id>-engine.ts` as `<CONST>_RULES: GameRules<State, Move, Event>`:

- `hud(state)`: `{ score, goal: { id: '<game-id>.hud.<name>', values } }`. The goal is one ICU message with placeholders ("Moves {moves} / {maxMoves}"), never glued text. The Shell draws it and adds mode, level and par.
- `undo`: `{ kind: 'unlimited' }` for puzzles, `{ kind: 'limited', perLevel: n }` or `{ kind: 'none' }` otherwise. The Shell stores the states and the move log; the engine does nothing extra.
- `hints`: `{ kind: 'none' }` until the game has a solver; then `{ kind: 'solver', suggest }` where `suggest(state)` returns the first move of a solver line within a small node budget, or `null` (level-generation-and-solvers has the pattern).
- `continueRun`: `{ kind: 'once', descriptionId: '<game-id>.continue.<name>', apply }` where `apply(lost)` returns a playing state and its events, whatever way the run was lost. Tap Flip adds 3 moves and emits `moves-added`. Line Siege (`examples/line-siege/rules/continue-run.ts`, `descriptionId: 'line-siege.continue.push-back'`) rescues both of its losses: `hearts = max(hearts, 1)` (`heart-restored`), every monster back 3 rows but never past row 0 (`monsters-pushed-back`), the two fullest board rows emptied when no block fits (`rows-emptied`; no score, no beams, no shockwave), then a redrawn tray (`tray-refilled`). Test it from each loss (`continue-run.test.ts` builds a breached and a board-full state). Offer it only when the game design allows; `game.config.ts` `isContinueAllowed` can still switch it off per app, and must be `false` when `continueRun` is `none`.
- Defaults when the design is silent: unlimited undo, no hints (a game that draws its future from the RNG has no exact solver to suggest from; Line Siege: `hints: { kind: 'none' }`), no continue.
- The hints kind is a game fact the Shell and parity read (lead decision L8): `'none'` means `hasHints` is false, so the Game screen draws no Hint key and parity compares against the design's no-hints variants; `'solver'` means `hasHints` is true. Changing it changes what S5 shows: say so in the report.
- The teaching texts (tutorial and how-to-play) must describe the rules as tuned, not as first sketched. Line Siege's fourth steps say "The monsters march closer every few blocks" and "Careful: the monsters march closer every few blocks" (`line-siege.how-to-play.step-4`, `line-siege.tutorial.step-4`; the owner's question about the old "one row after every block" copy was answered by the lead on 2026-09-30, decision L4, and the copy deck now says this in all four languages). "Every few blocks" holds for any `marchEvery` of 2 or more; a tuning change to 1 would need new copy from the owner first, so keep every row's `marchEvery` at 2 or more.

## Step 6: persistence

`<game-id>-persistence.ts` exports `<CONST>_PERSISTENCE: PersistenceSpec<State, Move>`:

- `parseState(json)` rebuilds a fresh typed object from unknown JSON with explicit checks (whole numbers, array lengths, allowed cell values), returning `null` on anything unexpected. Never cast `json as State`.
- `parseMove(json)` the same for one logged move.
- `stateVersion: 1` at first; when the state or move shape changes after a release, bump it and make `migrateState(json, fromVersion)` upgrade older runs (or return `null`, which drops only the run in progress; results are kept).
- `savePolicy: { kind: 'after-every-move' }` for turn-based and simulate-then-replay games.

## Step 7: statistics counters

`<game-id>-stats.ts` exports `<CONST>_STATS: StatsSpec<Event>` with 2 to 4 counters (spec 10 STATISTICS, S10 game card):

- `id`: kebab-case and permanent (a key in the save document), e.g. `'cells-flipped'`.
- `labelId`: `'<game-id>.stats.<id>'`, in all four catalogs.
- `aggregate: 'sum'` (totals) or `'max'` (records such as "Biggest combo").
- `measure(events)`: a number from one move's events. It must be pure and cheap: the Shell replays the whole kept move line at run end.

## Step 8: bot and example states

`apps/<game-id>/src/testing/<game-id>-testing.ts` exports `<CONST>_TESTING: TestingSpec<State, Move>`:

- `bot`: a reasonable player, e.g. greedy on an immediate measure (fewest lit cells, best score). It receives an `rng` and returns it (advanced if it drew). `randomPolicy()` from `testing/play-bot.ts` is the baseline for winnability.
- `examples.start/middle/win/lose`: functions returning states whose `outcome` matches the name; the screenshot matrix and E2E setup load them.

Bot balance runs (`*.sim.test.ts`, difficulty curves) belong to the game-balance-and-bots skill.

## Step 9: the engine assembly

`<game-id>-engine.ts` exports `<CONST>_ENGINE: GameEngine<State, Move, Event>` (`create, listMoves, applyMove, outcome, panMode, selectRegions, intentToMove, buildTimeline`) and `<CONST>_RULES`. `panMode` is a literal (`'none'` for the Tap Flip template; `'swipe'`, `'drag'` or `'aim'` when the game uses that gesture) and must agree with the intents `intentToMove` accepts. `selectRegions` is `[]` unless a tap in a region selects first (Line Siege: `['tray']`, with drag as the second way to place). It is assembly only. `intentToMove` (`rules/intent-to-move.ts`) comes from the board-gestures-and-input skill and `buildTimeline` (`board/build-timeline.ts`) from board-rendering-skia; write the assembly once both exist, then copy `<game-id>-engine.test.ts`, which runs `engineContractProblems` with a tap on every cell as intents (swap in the game's own intents: swipes in four directions, drags between every pair of regions it uses, taps on the select regions) and, for a game with an endless mode, `endless: <CONST>_LEVELS.endless`. `examples/line-siege/rules/line-siege-engine.test.ts` shows all of it.

## Size limits and how to split

The project's lint limits apply to rules too: at most 250 lines per file, 40 lines per function, cyclomatic complexity 10, cognitive complexity 15, 3 parameters, nesting depth 3, 3 nested callbacks (4 in tests), no nested ternaries. Split by responsibility: one engine function per file, geometry helpers in their own file (`flip-cells.ts`, `pieces.ts`), group parameters into one object when a helper needs more than three inputs. Under `noUncheckedIndexedAccess`, read arrays through `pickAt(items, index)` or handle `undefined` explicitly instead of adding branches the tests cannot reach.

## Simulate-then-replay and real-time games

- **Simulate-then-replay** (Bank Shot volleys, Toggle Drop ball runs, Poker Drop cascades): `applyMove` runs the continuous phase with the fixed step `1000 / 120` ms and the determinism policy, then returns events with timestamps (`atMs`). `buildTimeline` turns them into tracks. Everything else (saving, undo, bots, goldens) stays turn-based. The geometry kit (swept circles, reflect) and its tests are the realtime-game-loop skill's.
- **Real-time** (Halo Drift): the rules still own `create`, the JSON snapshot state and `outcome`; the moving world is a typed-array sim in `apps/<game-id>/src/sim/`, stepped with integer commands, with `realtime: RealtimeSpec` and `savePolicy: { kind: 'save-points', points: [...] }`. Build it with the realtime-game-loop skill.
