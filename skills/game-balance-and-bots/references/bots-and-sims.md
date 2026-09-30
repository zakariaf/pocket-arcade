# Bots and simulations

How a Pocket Arcade game is played thousands of times headless, and how those runs become numbers. Every code file named here is in this skill's `templates/` folder at the same path it takes in the app repo; the Line Siege files are in `examples/line-siege/`.

## Contents

- The harness at a glance
- What a bot needs from a game
- The three standard players
- Writing the game's bot hooks
- Payoff and twist tags
- The sim file
- Real-time and simulate-then-replay games
- Determinism rules
- Speed
- Debugging a surprising number
- Reporting to the owner

## The harness at a glance

| File (app repo) | What it does |
|---|---|
| `packages/game-kit/src/testing/play-bot.ts` | `BotPolicy`, `BotGame`, `randomPolicy()`, `playBot()`: the minimal loop (the game module's `testing.bot` is a `BotPolicy`). The `game-rules-engine` skill ships the same file with its own unit test; `trace-bot.test.ts` also proves `playBot`'s behaviour |
| `packages/game-kit/src/testing/trace-bot.ts` | `traceBot()`: the same loop as `playBot`, plus what the report needs (final score, payoff and twist tags, capped runs) |
| `packages/game-kit/src/testing/bot-policies.ts` | `greedyPolicy(rules, evaluate)` and `lookaheadPolicy(rules, evaluate, { depth, beam })` |
| `packages/game-kit/src/testing/sim-stats.ts` | `summarizeCell()`: many traces → one report cell (win rate, move spread, loss reasons, first-payoff curve) |
| `packages/game-kit/src/testing/balance-bands.ts` | `SimReport`, `BalanceBands`, `bandProblems(report, bands)` |
| `packages/game-kit/src/testing/parse-balance-bands.ts` | `parseBands(json)`: validates `balance-bands.json` and returns it typed |
| `packages/game-kit/src/testing/run-sim-bot.ts` | `runSimBot()`: the same trace for a real-time sim driven by integer commands |
| `packages/tooling/src/sims/write-sim-report.ts` | `rulesFingerprint(gameId)` (the game's logic folders, the sim and the game-kit files they import: `fingerprintFiles(gameId)`) and `writeSimReport(report)` (Node APIs, so it lives in tooling), with its test |
| `jest.sim.config.js` (repo root) | Plain-Node Jest config for `*.sim.test.ts`; `npm run test:sim` runs it |
| `test/sims/<game-id>/balance.sim.test.ts` | One game's sim: plays the grid, writes `reports/sim/<game-id>.json`, asserts the bands |
| `test/sims/<game-id>/balance-bands.json` | The game's balance contract (see balance-contract.md) |
| `apps/<game-id>/src/testing/<game-id>-bot.ts` | The game's bot hooks: `evaluate<Game>` (re-exported when it lives in `rules/`), `scoreOf<Game>`, `tag<Game>Event`, `<game>Bot` |
| `apps/<game-id>/src/rules/<game-id>-evaluate.ts` | The evaluation, when the level witness (levels/) also plays with it: levels may import only game-kit and the game's `rules/` and `levels/` |

Every harness file is pure TypeScript under the determinism policy (no clock, no `Math.random`, only exact `Math` functions), except the tooling writer, which uses `node:fs` and `node:crypto`. The harness files have colocated unit tests that run in `npm test`; only `*.sim.test.ts` files wait for `npm run test:sim`.

`jest.sim.config.js` (copied from `templates/`):

```js
module.exports = {
  rootDir: __dirname,
  displayName: 'sim',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/{apps,packages}/*/src/**/*.sim.test.ts', '<rootDir>/test/**/*.sim.test.ts'],
  transform: { '\\.ts$': ['babel-jest', { caller: { name: 'metro', bundler: 'metro', platform: 'ios' } }] },
  moduleNameMapper: {
    '^@e07/(game-kit|shell|tooling)/(.*)$': '<rootDir>/packages/$1/src/$2',
    '^@e07/([^/]+)/(.*)$': '<rootDir>/apps/$1/src/$2',
  },
  // plus modulePathIgnorePatterns and testTimeout: 300_000
};
```

The root `package.json` has `"test:sim": "jest --ci --config jest.sim.config.js"`, and the unit project of `jest.config.js` ignores `\.sim\.test\.` so sims never run in `npm test` or pre-commit. `test:sim` runs inside `verify` (pre-push). A sim that needs a React Native mock is a bug: the rules must be pure TypeScript.

## What a bot needs from a game

A bot drives only the four pure engine functions, `BotGame = Pick<GameEngine, 'create' | 'listMoves' | 'applyMove' | 'outcome'>`:

- `create(seed, difficulty)`: the start state. Same seed and difficulty, same state.
- `listMoves(state)`: every legal move; empty exactly when the game is over.
- `applyMove(state, move) → { state, events }`: pure; events say what happened (Line Siege: `'column-cleared'`, `'beam-fired'`, `'monster-defeated'`, `'wall-breached'`).
- `outcome(state)`: `playing`, `won` with a score, or `lost` with a catalog reason key. The reason key is what the report's `lossReasons` counts, so give each way of losing its own `<game-id>.lose.<reason>` key (Line Siege: `line-siege.lose.broke-through` and `line-siege.lose.board-full`).

`outcome` and `listMoves` run for every candidate move a searching bot looks at, so keep "is there any legal move" cheap: an early-exit `hasAnyMove(state)` (Line Siege's `placement.ts`) instead of listing every move inside `outcome`.

The difficulties a bot plays are the one 0..100 scale: the grid samples level difficulties (0..99, the lower bound of each tuning row: `[0, 25, 50, 75]` for four rows), and a game with an endless mode is played once more at 100 in its own `endless` block, never inside the grid (balance-contract.md, "Endless mode").

## The three standard players

| Policy | What it is | Answers |
|---|---|---|
| `random` (`randomPolicy()`) | A uniformly random legal move | The baseline: how far can someone get without thinking? Naive play should mostly lose. |
| `greedy` (`greedyPolicy(rules, evaluate)`) | The move whose next state evaluates best (one ply) | The "reasonable player": the difficulty curve, the kill test and the twist are measured with it. It is also the game module's `testing.bot`. |
| `lookahead` (`lookaheadPolicy(rules, evaluate, { depth: 2, beam: 4 })`) | Best value over `depth` plies of its own moves, searching only the `beam` best-looking moves per ply | The upper bound of skill. It sees the seeded future (the next tray, the next spawn), so it plays better than any human can. |

Details that matter:

- **Outcome-aware.** Both searching policies score a won state above any position and a lost state below any (`judge`: ±1,000,000 plus the evaluation), so `evaluate` only has to rank ongoing positions.
- **Ties** are broken with the bot's own seeded RNG, never "first move wins", so a bot has no position bias and still replays exactly.
- **The bot RNG** is seeded with `seed ^ 0x5bd1e995` by `playBot`/`traceBot`, separate from the game's RNG inside the state.
- **Depth and beam** trade strength for time: a Line Siege decision at depth 2, beam 4 costs about the number of legal moves plus 4 × that again in `applyMove` calls. If the lookahead cells dominate the sim's run time, lower the beam or run lookahead in fewer cells; a wider beam makes the upper bound stronger but slower.
- **Skill gap.** Where the three disagree tells whether decisions matter: `random < greedy < lookahead` on the skill-gap metric, each by a clear step. If random plays as well as greedy, the choices are fake; if greedy already plays like lookahead, there is no depth to master.

## Writing the game's bot hooks

`apps/<game-id>/src/testing/<game-id>-bot.ts` exports four things. The template (`templates/apps/__GAME_ID__/src/testing/__GAME_ID__-bot.ts`, with its test) is the template game's, Tap Flip's: `evaluate` counts lit cells and values a board one press from dark (a lit cross) the way a person sees it, `scoreOf` is the win's score, the payoff is `board-cleared` and the twist a press that flips four or five cells. Plain "fewest lit cells" won only 0.56 of the easiest boards because it walks away from the finishing cross, which no person does: that is the kind of evaluation fix rule 11 allows. For a game with points, monsters and a witness, imitate `examples/line-siege/apps/line-siege/src/testing/line-siege-bot.ts`:

```ts
/** The bots' evaluation (shared with the level witness, so it lives in rules/). */
export { evaluateLineSiege };

/** The report's "score": the points the top bar shows. */
export function scoreOfLineSiege(state: LineSiegeState): number {
  return state.score;
}

/** Payoff: a monster is defeated. Twist: a cleared column's beam hits a monster. */
export function tagLineSiegeEvent(event: LineSiegeEvent): readonly EventTag[] {
  if (event.kind === 'monster-defeated') return ['payoff'];
  return event.kind === 'beam-fired' && event.targetId !== null ? ['twist'] : [];
}

/** The game module's testing.bot: the greedy "reasonable player". */
export const lineSiegeBot = greedyPolicy({ listMoves, applyMove, outcome }, evaluateLineSiege);
```

and `apps/line-siege/src/rules/line-siege-evaluate.ts` holds the evaluation:

```ts
/** How good a position looks to the bots (higher is better). */
export function evaluateLineSiege(state: LineSiegeState): number {
  const danger = state.monsters.reduce((sum, monster) => sum + (monster.row + 1) * monster.hp, 0);
  const crowding = state.cells.reduce<number>((sum, cell) => sum + cell, 0);
  const gains = state.defeated * DEFEAT_WEIGHT + state.hearts * HEART_WEIGHT;
  return gains - danger * DANGER_WEIGHT - crowding * CROWDING_WEIGHT;
}
```

- **Where the evaluation lives.** When only bots use it, `evaluate<Game>` may sit in the bot file. When the level witness uses it too (a game whose levels are proven by the greedy bot, level-generation-and-solvers' `createWitnessSolver`), it lives in `apps/<game-id>/src/rules/<game-id>-evaluate.ts` and the bot file re-exports it: code in `levels/` may import only `@e07/game-kit/**` and the game's own `rules/` and `levels/` (the rules-pure import zone that both check-levels and check-boundaries enforce), never `testing/`. Changing the evaluation changes the witness, so the packs are regenerated with a `Gate-Change:` trailer.
- `evaluate` weighs what a sensible player cares about: progress toward the goal first, safety second (lives, danger close to the wall), then position quality (crowding, open lines). Name every weight as a constant. Keep it simple: the bot should play like a reasonable human, not like a solver.
- Improve `evaluate` only to match reasonable human play (a person avoids filling the board), never to push a number into a band. If a band fails, change the game (the tuning file), not the player.
- `scoreOf` returns the number the HUD and the S7 result show (`state.score` for a game with points; Tap Flip's win score); the report's `medianScore` uses it. Pops, defeats, beams and combos are counters (the stats screen's), not the score: a game with points and defeats reports the points.
- Unit-test the hooks: the tags, that `evaluate` prefers progress and dislikes danger, and that the bot takes the obvious payoff on its first move.
- The game module's testing spec (`apps/<game-id>/src/testing/<game-id>-testing.ts`, from the `game-rules-engine` skill) sets `bot: <game>Bot`, replacing its starter `greedyBot`, so the Shell's contract tests, E2E setup and the sims all use the same reasonable player.

## Payoff and twist tags

`tag<Game>Event(event)` returns the tags an event carries:

- **`payoff`**: the moment the player feels "yes": a monster is defeated, robots crash, a sheep is penned, a line clears with a bonus. The kill test measures how soon the first one comes (`firstPayoffShare`), and `payoffPerRun` counts them.
- **`twist`**: the game's special mechanic actually happening, the thing that makes it more than its base game: a cleared column's beam hitting a monster (Line Siege), scrap shoved into a robot (Scrap Shove), a loop closing around a critter (Snare Snake). `twistPerRun` counts them.

Most events carry no tag. One event may carry both.

## The sim file

`test/sims/<game-id>/balance.sim.test.ts` (from `templates/test/sims/__GAME_ID__/`; replace `__GAME_ID__` with the kebab id and `__GAME_PASCAL__` with the PascalCase name, then run `npx eslint --fix` on it, which orders the imports):

1. `parseBands(bandsJson)` reads the contract: the grid (policy → level difficulties 0..99), `seedsPerCell`, `maxMoves`, and the optional `endless` block.
2. `playCell(policy, difficulty)` runs `traceBot` for seeds `1…seedsPerCell` and `summarizeCell`s them, for every grid cell and then, with an `endless` block, once more for its policy at difficulty 100.
3. The report (`gameId`, `rulesFingerprint`, seeds, cap, cells) is written in `beforeAll`, before the assertions, so a failing run still leaves numbers to read.
4. Three tests: no run hit the move cap; replaying the first cell gives identical numbers; `bandProblems(report, bands)` is empty.

It lives under the root `test/` folder because it writes files with Node APIs (only the root `tsconfig.json` and tooling have Node types). Run it with `npm run test:sim` (all games) or `npx jest test/sims/<game-id> --ci --config jest.sim.config.js` (one game; paths first in every jest command). Keep one sim file under about 60 s. If a game needs more, first run the lookahead in fewer cells or with a smaller beam; the report is one file per game, so do not split a game's grid over two sim files.

## Real-time and simulate-then-replay games

- **Simulate-then-replay** (Bank Shot volleys, Toggle Drop, Poker Drop cascades): the continuous phase runs inside `applyMove`, so these games are turn-based for bots. Use the standard sim unchanged; a shot is one move.
- **Real-time** (Halo Drift): drive the same fixed-step `step(sim, command)` the UI thread runs with `runSimBot`. `examples/halo-drift/` is the complete worked example (a reduced Halo Drift: steer, collect sparks, dodge chasers; every third spark the halo pulses and throws close chasers back, the twist), and it passes `check-balance.mjs` in this skill's self-test.

| File (app repo) | What it is |
|---|---|
| `apps/halo-drift/src/sim/halo-drift-sim.ts` | The fixed-step sim: typed arrays, `stepHaloDriftSim(sim, command)`, `drainHaloDriftEvents`, `haloDriftOutcome` (won at the spark goal, lost at 0 hearts or when the 90 s round ends), `haloDriftScore`; a `'worklet'` module, no allocation per tick |
| `apps/halo-drift/src/sim/halo-drift-tuning.ts` | Every balance number: hearts, speeds in hundredths of a unit per tick, radii, the first-spark offset, sparks per pulse, the round length, and three level rows read by `knobsFor` on the 0..100 scale (rowFor written out, because a `'worklet'` module, which the sim imports on the UI thread, may call only worklets) |
| `apps/halo-drift/src/sim/halo-drift-sim.test.ts` | Replay from the `(tick, command)` log, frame grouping, the opening, a finished run stays still |
| `apps/halo-drift/src/testing/halo-drift-bot.ts` | `HALO_DRIFT_SIM: SimBotGame`, `tagHaloDriftEvent` (spark = payoff, a pulse that throws a chaser = twist), `commandToward` (best dot product, no angles) and the three players |
| `apps/halo-drift/src/testing/halo-drift-bot.test.ts` | The tags, the direction choice, each policy's decision, idle losing fast and dodge winning the first round |
| `test/sims/halo-drift/balance.sim.test.ts` | `playCell` maps seeds to `runSimBot(HALO_DRIFT_SIM, { seed, difficulty, policy, maxTicks: BANDS.maxMoves, decideEveryTicks: 12, payoffStepTicks: 120 })`; the report, the replay test and the bands test are the template's |
| `test/sims/halo-drift/balance-bands.json`, `reports/sim/halo-drift.json` | The bands in ticks and seconds, and the real report they were set from |

```ts
export const HALO_DRIFT_SIM: SimBotGame<HaloDriftSim> = {
  create: createHaloDriftSim,          // (seed, difficulty) => sim, knobs from knobsFor(difficulty)
  step: stepHaloDriftSim,              // the UI thread's own tick
  drainEvents: drainHaloDriftEvents,   // [kind, value, tick, ...]
  outcome: haloDriftOutcome,
  scoreOf: haloDriftScore,             // sparks collected
  tagEvent: tagHaloDriftEvent,         // (kind, value) -> ['payoff'] | ['twist'] | []
};
```

  A `CommandPolicy` reads the sim and returns an integer command (0 idle, 1-16 stick directions) plus its RNG; `runSimBot` asks it every `decideEveryTicks` = 12 ticks (about a human's 100 ms). The result is an ordinary `BotTrace` whose `moves` are ticks, so `summarizeCell` and the bands work unchanged; write move bands in ticks (120 ticks = 1 s). The first-payoff curve counts `payoffStepTicks` steps instead: with 120 at 120 Hz, `firstPayoffShare[k-1]` is the share of runs with a payoff within k seconds, so the kill test reads `"withinMoves": 1` as "within 1 second" (in ticks, the 1-10 window would end after 83 ms and the rule could never pass). The three standard real-time players:

| Policy | What it does | What the example's report shows |
|---|---|---|
| `idle` | never moves | loses in about 2.7 s (median 327 ticks): the chasers have teeth |
| `wander` | a random direction at every decision, from its own RNG | collects no sparks and never wins: where the thumb goes matters |
| `dodge` | heads for the spark, adds a push away from every chaser inside 200 units (stronger when closer) and from walls closer than 90 units, then takes the stick direction with the best dot product | wins 1.0 / 0.7 / 0.33 of the three rounds, first spark within 1 s in every run, 2 pulses per round at d34 |

  Every run must end before the cap, so a real-time game needs a round limit (Halo Drift: `roundTicks` 10 800, 90 s; the bands' `maxMoves` 12 000 sits above it); a sim that can survive forever would hit the cap. Because `skillGap` compares policies at one difficulty, use a metric that separates them (`medianScore`, sparks: wander 0 vs dodge 12 at d34); `idle` is checked by a band on `medianMoves` instead ("loses within 1 to 5 seconds"). The `SimBotGame` hooks and the policies live in `apps/<game-id>/src/testing/<game-id>-bot.ts`; the checker recognises the bot by its `CommandPolicy` and the tuning file in `src/sim/`.

## Determinism rules

- Seeds are `1…seedsPerCell`, the same every run. The bots take randomness only from their own sfc32 state; the game only from the state's.
- No `Math.random`, `Date`, `performance.now`, `Intl`, `jest.retryTimes`, `.skip`, `.only` in sims or bot hooks (`check-balance.mjs` fails on them).
- The report has no timestamps: rerunning unchanged code writes identical bytes, so a diff of `reports/sim/<id>.json` shows exactly what a change did.
- A sim that gives different numbers on a rerun is a determinism bug in the rules (a clock, an unseeded random, iteration over an object whose key order depends on insertion). Fix it before any tuning.

## Speed

Line Siege's sim (10 cells × 100 seeds: four random, four greedy, one lookahead, one endless) runs in about 11-13 s. What costs time: `listMoves` and `outcome` inside the bots' search, and the lookahead cells. Keep `outcome` cheap (early-exit move check), keep states small (flat arrays), and put lookahead only where the skill gap is measured.

## Debugging a surprising number

1. Read the cell: `lossReasons` says how runs end (Line Siege: random play loses 78 of 100 easy runs by `line-siege.lose.board-full`, not by monsters).
2. Replay one seed: `traceBot(GAME, { seed: 7, difficulty: 0, policy: greedyPolicy(GAME, evaluate), maxMoves: 400, tagEvent, scoreOf })` in a scratch test, printing `applyMove` events move by move.
3. Look at the state where it went wrong (render the board as ASCII with `renderCells` if the game has one).
4. Decide whether the game, the bot or the band is wrong (tuning-playbook.md has the table).

## Reporting to the owner

The evidence report gets one plain line per difficulty, with numbers from `reports/sim/<game-id>.json`, never from memory:

```text
- Bots (reports/sim/line-siege.json, 100 seeds each): easiest levels: a reasonable player wins 73 %,
  random 22 %; then 56 %, 39 % and 14 % for the three harder level groups. A perfect-foresight bot
  wins 100 % of the second group. First payoff on move 1 in 100 % of easy runs; the beam twist hits
  about 1.5-1.9 times per level. Endless runs last a median 26 placements.
```
