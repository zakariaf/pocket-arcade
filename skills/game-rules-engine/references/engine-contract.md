# The GameModule contract and the engine

What a game hands the Shell, member by member, and what each engine function must do. The type files themselves are in `templates/packages/game-kit/src/contract/`; copy them verbatim, they are canonical.

## Contents

- Why a contract, and why it is pure
- Where the code lives
- The engine members (`GameEngine`)
- One difficulty scale, and the endless run
- The rest of the module (`GameModule`)
- Rules beyond the engine (`GameRules`)
- Persistence, statistics, testing members
- The input the engine receives (`InputIntent`)
- Tap-then-tap: the selection is UI state
- How the Shell binds the module (hand-off)
- Contract tests every game runs
- Classifying a game (turn-based, simulate-then-replay, real-time)

## Why a contract, and why it is pure

A game plugs into the Shell by providing exactly the members of `GameModule` (spec section 10: "nothing else is needed to become a full app"). Bots, solvers, saves, undo, daily challenges and data goldens all call the engine headlessly, thousands of times, in Jest and in Node. So the engine functions are pure TypeScript on the JS thread: no React, React Native, Expo, Skia, zustand or Shell imports, no clock, no global randomness, and the same answer on every phone (spec 8.13: "a pure next state from this state and this move function").

```
 gesture --InputIntent--> intentToMove(state, intent) -> Move | null
                                   |
            GameSession store: applyMove(state, move) -> { state, events }; save written
                                   |
            board: toView(state) + buildTimeline(events, motion) -> animation (UI thread)
```

The view shown after a move is always the final state; `events` explain how the board gets there.

## Where the code lives

```
packages/game-kit/src/                  pure TS, depends on nothing of ours
  contract/  game-engine.ts game-module.ts game-identity.ts messages.ts game-rules.ts levels.ts
             teaching.ts stats.ts testing.ts persistence.ts realtime.ts input-intent.ts difficulty.ts
  rng/       sfc32.ts (+ test with golden values)  pick-at.ts
  testing/   play-choices.ts play-bot.ts json-shape.ts engine-contract.ts contract-intents.ts (+ tests)
  geom/      board-layout.ts classify-swipe.ts        (types the contract imports)
  timeline/  track.ts                                  (Track and Motion for buildTimeline)
apps/<game-id>/src/rules/               PURE + DETERMINISTIC, imports game-kit only
  <game-id>-types.ts   state, move, event types
  create.ts  list-moves.ts  apply-move.ts  outcome.ts   one engine function per file
  <helpers>.ts         e.g. flip-cells.ts, pieces.ts
  <game-id>-engine.ts  <CONST>_ENGINE and <CONST>_RULES (assembly, once the board exists)
  <game-id>-persistence.ts  <game-id>-stats.ts
  intent-to-move.ts    (the board-gestures-and-input skill writes it)
apps/<game-id>/src/testing/<game-id>-testing.ts    bot + example states
apps/<game-id>/src/board/build-timeline.ts          (the board-rendering-skia skill writes it)
```

Imports: same folder or below `./x.ts`; anything else `@e07/<package>/<path under src>.ts`; never `../`, always the extension.

## The engine members (`GameEngine`)

| Member | Signature | Must |
|---|---|---|
| `create` | `(seed, difficulty) => TState` | Same pair, same state on every device. Accept any difficulty 0..100 (`clampDifficulty`; the save schema allows that range): levels and the daily use 0..99, and 100 (`ENDLESS_DIFFICULTY`) is the endless run of a game with an endless mode (next section). Start in play (`outcome` is `playing`). |
| `listMoves` | `(state) => readonly TMove[]` | Every legal move, in a fixed order (bots, solvers and replays depend on the order). Empty exactly when `outcome` is not `playing`. |
| `applyMove` | `(state, move) => { state, events }` | Pure: never change the input. Throw `RangeError` for an illegal move instead of returning a corrupted state. |
| `outcome` | `(state) => Outcome` | `{ kind: 'playing' }`, `{ kind: 'won', score }` (whole number >= 0) or `{ kind: 'lost', reasonKey }` (a `<game-id>.*` catalog key, e.g. `'flock-tilt.lose.wolf-got-sheep'`). |
| `panMode` | `PanMode` (data) | The board's pan gesture: `'none'` (taps and long presses only), `'swipe'`, `'drag'` or `'aim'`; real-time games steer with the stick and set `'none'`. The Shell's board host passes it to the gesture layer, so it must match the intents `intentToMove` accepts (next section). |
| `selectRegions` | `readonly string[]` (data) | The board regions whose taps select instead of act: `[]` for most games, `['tray']` for Line Siege. A tap there returns `null` from `intentToMove`; the board host keeps the selection and passes it on the next tap (see "Tap-then-tap" below). |
| `intentToMove` | `(state, intent) => TMove \| null` | Pure. Legality lives here, never in gestures; every returned move is one `listMoves` offers. Written with the board-gestures-and-input skill. |
| `buildTimeline` | `(events, motion) => readonly Track[]` | Pure events to animation tracks; `'reduced'` drops shake and particles. Written with the board-rendering-skia skill. |

`Outcome`, `ApplyResult<TState, TEvent> = { state, events }` and `PanMode` live in `contract/game-engine.ts`. The names are canonical: never rename them.

## One difficulty scale, and the endless run

Every game uses one scale: whole numbers 0..100, the save schema's range. `contract/difficulty.ts` holds it:

| Export | Meaning |
|---|---|
| `ENDLESS_DIFFICULTY = 100` | Reserved for the endless run. Only a game whose `LevelsSpec` has an endless mode gives it a meaning; for any other game 100 is simply the hardest value `create` must still accept. |
| `MAX_LEVEL_DIFFICULTY = 99` | The top of the level scale: every level, pack entry and the daily stay at or below it. |
| `clampDifficulty(d)` | `min(max(floor(d), 0), 100)`: what `create` stores. |
| `isEndlessDifficulty(d)` | `clampDifficulty(d) === 100`. |
| `rowFor(d, rowCount)` | `floor(min(max(floor(d), 0), 99) * rowCount / 100)`: the row of a tuning table (rows easiest first). With four rows, 0-24 is row 0, 25-49 row 1, 50-74 row 2, 75-99 row 3. |

- **The curve, the rows and the daily line up on this scale.** `levels.difficultyFor(level)` rises from 0 at level 1 to its cap at the last level (99, unless the game's solver can only prove easier levels: Tap Flip stops at 60). The tuning file maps a difficulty to knobs with `rowFor` (game-balance-and-bots owns the table), so every level and the daily land on a real row. The daily difficulty is a medium value from 40 to 50 (Line Siege: 45, the second of four rows).
- **An endless run is `create(freshSeed, ENDLESS_DIFFICULTY)`.** There is no mode argument. The game's tuning has an endless row (goal 0: no wave to finish), `knobsFor(100)` returns it, and `outcome` never returns `won` at difficulty 100: an endless run only ever ends lost. `LevelsSpec.endless` is `{ kind: 'endless', difficulty: ENDLESS_DIFFICULTY }` exactly when `game.config.ts` has `modes.endless: true`. Its result screen shows "New best!" whenever the score beats the stored best, and endless has no stars.
- `engineContractProblems` proves it: given `endless: LEVELS.endless`, it also plays seeded random games from `create(seed, 100)` and reports any `won`. `check-rules-engine.mjs` does the same (`endless-won`) for a game whose `game.config.ts` or levels file declares an endless mode.

## The rest of the module (`GameModule`)

`GameModule<TState, TMove, TEvent, TPresentation, TSim = never>` (spec 10, item by item):

| Spec 10 item | Member |
|---|---|
| Game id, name in 4 languages, win title, tagline | `identity.id` (kebab-case, equals `apps/<id>`), `identity.nameId` (`'<id>.name'`), `identity.winTitleId` (`'<id>.win-title'`, the S7 win heading), `identity.taglineId` (`'<id>.tagline'`, under the name on S1, S4 and S11b) |
| Logo, icon, palette, sound set | `presentation` (typed by the Shell: board, art with the logo and credits, sounds, palette) |
| Start state, moves, apply, is it over | `engine.create`, `listMoves`, `applyMove`, `outcome` |
| Score and goal line, undo/hints/continue | `rules.hud`, `rules.undo`, `rules.hints`, `rules.continueRun` |
| Level generator, solver and par, packs, stars, daily, endless | `levels` (the level-generation-and-solvers skill) |
| Board drawing, taps to moves (pan mode), animation, RTL mirror flag | `presentation.board`, `engine.panMode`, `engine.intentToMove`, `engine.buildTimeline` |
| Tutorial and how-to-play | `teaching` |
| 2-4 game counters | `stats.counters` |
| Every string in en, de, fa, ckb | `texts` |
| Bot, example states | `testing.bot`, `testing.examples` |
| Save points (real-time games) | `persistence.savePolicy`, `realtime.savePoints`, `realtime.snapshot` |

`realtime` is `null` for turn-based and simulate-then-replay games (about 24 of 26).

## Rules beyond the engine (`GameRules`)

| Member | Type | Meaning |
|---|---|---|
| `hud(state)` | `{ score, goal: Message }` | Top bar (S5): the score and the goal/progress line, e.g. `{ id: 'tap-flip.hud.moves', values: { moves: 3, maxMoves: 6 } }`. The Shell adds mode, level and par. |
| `undo` | `none` / `unlimited` / `limited(perLevel)` | Spec 8.5: unlimited in puzzle games; the game may limit it. The Shell keeps the history. |
| `hints` | `none` / `solver(suggest)` | `suggest(state)` returns the next good move or null (usually the first move of a solver line; see level-generation-and-solvers). |
| `continueRun` | `none` / `once(descriptionId, apply)` | Spec 8.10: one rescue per run, only after a loss. `apply(lost)` returns `{ state, events }` whose state is playing again from every way of losing (Tap Flip adds 3 moves; Line Siege gives a heart back, pushes the monsters back 3 rows, empties the two fullest rows after a board-full loss and redraws the tray). The Shell forbids undo across it. |

## Persistence, statistics, testing members

- **`PersistenceSpec`**: `stateVersion` (bump when the shape of state or move changes), `parseState(json)` and `parseMove(json)` (validate JSON from disk; return a fresh typed value or `null`: the Shell then drops only the run, or only the undo history), `migrateState(json, fromVersion)` (`null` = cannot), `savePolicy` (`after-every-move` for turn-based games; `save-points` with `wave-end`, `turn-end`, `pause`, `background`, `level-end` for real-time games, never per frame).
- **`StatsSpec`**: 2 to 4 `CounterSpec { id, labelId, aggregate: 'sum' | 'max', measure(events) }`. `measure` sees one move's events; at run end the Shell replays the kept move line and folds each counter (undone moves never count). Ids are kebab-case and permanent (keys in the save document).
- **`TestingSpec`**: `bot: BotPolicy` (`(state, moves, rng) => { move, rng }`, its own seeded RNG, never `Math.random`) and `examples` for `start`, `middle`, `win`, `lose` (screenshots, the debug menu, E2E setup).
- **`TeachingSpec`** (tutorial steps, 3-5 how-to-play pages) and **`GameTexts`** (four flat ICU catalogs) are types here; their content comes later in the game's build order.

## The input the engine receives (`InputIntent`)

`tap { target, selected }`, `long-press { target }`, `swipe { direction, from }`, `drag-end { from, to }`, `aim { dx, dy }`, where a target is `{ regionId, col, row }` of the board layout and directions are physical (`up`/`down`/`left`/`right`). One gesture yields at most one intent; `intentToMove` handles every kind explicitly and returns `null` for the ones the game ignores. `contract/input-intent.ts` is one shared file: the board skills ship the same text.

Which intents the board sends depends on `engine.panMode`: taps and long presses always, `swipe` only with `'swipe'`, `drag-end` only with `'drag'`, `aim` only with `'aim'`. `engineContractProblems` fails when `intentToMove` turns an intent into a move that the declared pan mode never sends (for example a swipe game left on `'none'`), and when `panMode` is not one of the four. The board-gestures-and-input skill's input table lists the mode per game (Line Siege `'drag'`, Flock Tilt `'swipe'`, Scrap Shove `'none'`, Bank Shot `'aim'`).

## Tap-then-tap: the selection is UI state

Some games are played by tapping a piece, then its target (Line Siege: "tap a block, then tap the grid"). The selection is never game state and never a move, so bots, sims, the witness solver, par, undo and the move counters never see it:

1. The engine lists the regions whose taps select in `selectRegions` (`['tray']`); most games use `[]`.
2. The gesture layer always sends `tap` with `selected: null`. The board host (game-host-integration) keeps the selection: a tap inside a select region toggles it (tapping the same target clears it) and announces it to VoiceOver; any other tap calls `intentToMove(state, { ...intent, selected })`. A non-null move is applied and clears the selection; undo, restart, the end of the run and a tap outside every region clear it too, and a drag ignores and clears it.
3. `intentToMove` stays pure: a tap inside a select region returns `null`; a tap with a selection returns the move it names (Line Siege: the selected slot's block on the tapped cell) only when `listMoves` lists it.

`engineContractProblems` proves both halves: taps inside `selectRegions` return `null`, and every tap outside them is tried again with each tapped select target as `selected`, each resulting move must be listed.

## How the Shell binds the module (hand-off)

game-kit may not name Skia or Shell types, so `GameModule` is generic over `TPresentation`, and the Shell binds it as `ShellGameModule<T>` with a `ShellGameTypes` bag (`state`, `move`, `event`, `view`, `token`, `sim`). `createGameHost<T>` is the only generic seam; screens never see the game's types. Assembling `apps/<id>/src/index.ts` and wiring it into the Game screen belong to the game-host-integration skill.

## Contract tests every game runs

| Test | Asserts | Tool |
|---|---|---|
| start and determinism | `create(seed, d)` starts in play (`outcome` is `playing`) and twice gives deep-equal states; replaying a move line twice gives identical states | `engineContractProblems` |
| legality | every move `intentToMove` returns is in `listMoves(state)` | `engineContractProblems` (`intents`) |
| end state | `listMoves` empty exactly when `outcome` is not `playing`; lose reasons are catalog keys; win scores whole | `engineContractProblems` |
| serialisation | `JSON.parse(JSON.stringify(state))` deep-equals the state; `parseState`/`parseMove` return saved values unchanged | `engineContractProblems`, `jsonShapeProblems` |
| purity | `applyMove` leaves its input untouched; events have kebab-case kinds | `engineContractProblems` |
| pan mode | `panMode` is one of the four and every intent `intentToMove` accepts is one that mode sends | `engineContractProblems` |
| selection | `selectRegions` is a list; a tap inside it returns `null`; taps carrying a selection yield only listed moves | `engineContractProblems` |
| endless | with `endless: LEVELS.endless`, seeded play from `create(seed, 100)` never reaches `won` | `engineContractProblems`, `check-rules-engine.mjs` (`endless-won`) |
| identity, texts, levels, teaching, stats, config | module-wide checks | game-host-integration and level-generation-and-solvers |

## Classifying a game (turn-based, simulate-then-replay, real-time)

| Class | Games | What changes |
|---|---|---|
| Turn-based | 22 of 26 (Line Siege, Flock Tilt, Scrap Shove, Snare Snake, Merge Siege, Jump Chain, Stepstone, Swap Guard, Trail Clear, Dig Site, Floodline, Sonar Hand, Deep Sweep, Grove Shift, Rank Ladder, Letter Bugs, Exact Zero, Dice Foundry, Fuseban, Ripple Ten, Dock Slide, Last Stop) | Nothing: apply the move, then animate its events. Fuseban's timers count turns, never wall-clock time. |
| Simulate-then-replay | Toggle Drop, Poker Drop cascades, Bank Shot | The continuous phase runs inside `applyMove` with the same fixed step (1/120 s), and the result is an ordinary event list with timestamps (`{ kind: 'ball-bounced', ballId, x, y, atMs }`). Saving, undo, bots and goldens stay turn-based. |
| Real-time | Halo Drift | A typed-array sim in `apps/<id>/src/sim/` stepped on the UI thread; integer input commands recorded as `(tick, command)`; `realtime: RealtimeSpec` and `savePolicy: save-points`. Use the realtime-game-loop skill. |

Input modes per game (tap, swipe, drag, aim, stick) are the board-gestures-and-input skill's table.
