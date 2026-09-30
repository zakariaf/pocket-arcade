# Generators, level plans and the generated tables

How a game's levels come into existence: the generator, the difficulty curve, the plan that picks seeds and rates candidates, and the tooling that writes the committed `pack-<n>.json` files.

## Contents

- The pipeline
- Tuning first, packs second
- The generator is `create`
- Two ways to guarantee a good level
- The difficulty curve
- The level plan
- Choosing candidate seeds
- `rate()`: quality gates and star rules
- Score games that draw at random: the witness (thresholds instead of par)
- Running the generator
- When the tables change

## The pipeline

```
difficultyFor(level) --> create(seed, difficulty) --> solver.solve(start, maxNodes) --> rate(candidate)
      (curve)              (the engine's generator)    (exact par, or a witness win,    (StarRule or null)
                                  ^                     else the next attempt)                   |
             candidateSeed(gameId, level, attempt) <--- next attempt if rejected -------------------+
                                                                                                 v
     packages/tooling/src/levels/generate-levels.ts writes apps/<id>/src/levels/pack-<n>.json (the repo's Prettier)
```

Everything left of the file write is pure game-kit and game code (`planLevelTable`), so tests and the skill's checker can rerun it and compare with the committed files, value by value and byte by byte.

## Tuning first, packs second

A level is `create(seed, difficulty)` on the game's current tuning, so the tuning must be settled before the tables exist: the game's balance sims (game-balance-and-bots) pass first, then the packs are generated. A tuning change after the packs exist (a knob, a row, a new monster kind) changes the boards behind every level number: regenerate the packs, rerun the levels contract test, update the goldens one file at a time after reading them, and commit with a `Gate-Change:` trailer. For a witness game the same holds for a change to the bot's evaluation or its seed.

## The generator is `create`

`GameEngine.create(seed, difficulty)` is the level generator (spec 10: "Level generator: seed + difficulty -> level"). There is no second generator for levels, dailies or endless runs: a level is its seed and difficulty. A game may keep the construction in its own module (`levels/generate-level.ts`, called by `create`) when it grows, but the engine function stays the entry point, and it follows the determinism policy (seeded sfc32, exact arithmetic).

## Two ways to guarantee a good level

1. **Construct from a solution (preferred when possible).** Start from a solved position and apply seeded reverse moves or presses (the template scrambles a dark board with `presses` seeded presses). Every level is solvable by construction and par is at most the number of scramble steps. The solver still computes the exact par.
2. **Generate and test.** Place pieces from the seed with the game's constraints, then let the plan's solver prove it winnable; unsolvable or over-budget candidates are skipped and the next seed is tried. Needed for games whose moves cannot be reversed (Flock Tilt's sliding sheep, Stepstone's move-changing tiles).

Either way, `create` must accept any difficulty 0..100 (clamp with `clampDifficulty`), and `outcome(create(...))` must be `playing`.

A third case is a game that draws its future during play (Line Siege draws each new tray and each spawn from the RNG in its state). No search over a fixed future exists, so each candidate is proven by a witness instead (see "Score games that draw at random" below).

## The difficulty curve

`difficultyFor(level)` maps level 1..N to 0..99 and never falls (`check-levels.mjs` fails a table whose difficulty drops from one level to the next, and any level above 99: 100 is the endless run). It starts at 0 on level 1 and rises to its cap at the last level. The cap is `MAX_LEVEL_DIFFICULTY` (99) unless the solver can only prove easier levels: the Tap Flip template stops at `LEVEL_DIFFICULTY_CAP = 60`, because bigger boards cost the exact solver too much time and are not more fun. Line Siege uses the whole scale: `floor((level - 1) * 99 / 89)`. The daily difficulty (40 to 50) and the endless difficulty (100) sit on the same scale; `levels-model.md` shows how the curve walks through the tuning rows.

Within the curve, `create` turns difficulty into the game's knobs (grid size, pieces, enemies, move limit) through the tuning table (`knobsFor` with `rowFor`). Keep each knob monotonic in difficulty.

## The level plan

`apps/<id>/src/levels/<id>-level-plan.ts` exports one `LevelPlan<State, Move>` (`levels/level-plan.ts`):

| Field | Meaning |
|---|---|
| `gameId` | kebab-case id; part of every candidate seed, so two games never share boards |
| `packs` | `[{ id, nameId }]` in order; pack n holds levels (n-1) x levelsPerPack + 1 ... |
| `levelsPerPack` | equals `game.config.ts` `levels.levelsPerPack` |
| `difficultyFor` | the curve (also used as `LevelsSpec.difficultyFor`) |
| `create` | the engine's `create` |
| `solver` | the game's exact solver, or `createWitnessSolver(...)` for a game that draws during play (never null) |
| `maxNodes` | solver budget per candidate (a witness: the legal moves its bot may be shown); over budget = skipped |
| `maxTries` | candidates per level before the plan reports a failure |
| `rate(candidate)` | `StarRule` for a good level, `null` to reject it |

`<id>-levels.ts` then assembles the `LevelsSpec` from the plan (`packsOf(plan)`, `difficultyFor`) and the committed packs (`toLevelEntries`).

## Choosing candidate seeds

`candidateSeed(gameId, level, attempt) = hashSeed('<gameId>:level:<level>:<attempt>')`. Consequences:

- the table is identical on every machine and after every regeneration while the plan and the engine are unchanged;
- renaming the game id or changing `create` changes every level: regenerate, look at the goldens, and commit with a `Gate-Change:` trailer (see "When the tables change");
- the planner also skips a candidate whose start state equals an earlier level's (no duplicate boards).

## `rate()`: quality gates and star rules

`rate({ level, seed, difficulty, start, par, line, final })` is where the owner's level quality rules live. `par` is the solver line's length, `line` the proof and `final` the state it ends in (so a score rule reads `final.score` without a replay):

- **No trivial levels:** reject `par` below a minimum that rises by pack (template: 2, 3, 4). Only the first two or three levels may be won in one move (`trivial-level` in the checker).
- **Not too hard for the pack:** reject a par above the band the owner approved for that pack, or rely on `maxNodes` (a board the solver cannot finish within budget is skipped).
- **Game-specific shape rules:** at least one enemy in reach, no piece already on its goal, a minimum number of lit cells.
- Return `{ kind: 'par', par }` for puzzle games; the recorded par is exactly the solver's (the contract test re-solves every level and compares).

The checker's `par-curve` rule fails when a later pack's average par is below an earlier pack's.

## Score games that draw at random: the witness (thresholds instead of par)

Games rated by score have no exact par, and games that draw their future from the RNG (Line Siege: a new tray of three blocks and each spawn are drawn during play) have no exact search either. Their winnability is proven by a **witness**: the game's reasonable player plays the level, and its win is the proof.

- **The solver** is `createWitnessSolver({ rules: { listMoves, applyMove, outcome }, policy, botSeed })` from `packages/game-kit/src/levels/witness-solver.ts`. `policy` is the game's greedy bot on its own evaluation (`greedyPolicy(RULES, evaluate<Game>)`), and `botSeed` a fixed number (Line Siege `WITNESS_BOT_SEED = 0x5bd1e995`). `solve(start, maxNodes)` plays until the run ends: a win returns `{ kind: 'solved', par: line.length, line, final }`; a loss or the node cap returns `budget-exceeded`, never `unsolvable` (a lost witness proves nothing about the level). `planLevelTable` simply tries the next candidate seed, so a witness plan needs a larger `maxTries` (Line Siege 60, `maxNodes` 60,000).
- **Where the evaluation lives:** `rules/<id>-evaluate.ts`, because level files may import only `@e07/game-kit/**` and the game's `rules/` and `levels/` (the levels import zone; check-boundaries' `rules-pure` zone agrees). `testing/<id>-bot.ts` re-exports it for the balance sims.
- **`rate`** rejects levels the witness wins too quickly (Line Siege: fewer than 8 placements; this is all `par` is used for, and it is never shown to the player: the Result screen's win line for a score-rated level is "Score {score} – best {bestScore}", the lead's decision L3 of 2026-09-30) and returns `{ kind: 'score', thresholds: [win, two, three] }`:
  - `win` = `thresholds[0]`, the lowest score a win can have: 0 when the win is not score-based (Line Siege is won by clearing the wave, whatever the score);
  - `two` = the witness's final score (at least 1): what a reasonable player reaches;
  - `three` = `two` plus 20 % (at least 1 more): clearly better play.
- **The contract test** (`levelsContractProblems`) re-runs the witness for every level and replays its line through the real engine with `verifyLine`; a level whose witness no longer wins fails.
- **Fixed forever:** the bot seed and the evaluation. Changing either (or the tuning) regenerates the packs, with a `Gate-Change:` trailer.

`examples/line-siege/levels/` is the complete worked example: `line-siege-solver.ts`, `line-siege-level-plan.ts` (`scoreThresholds`, `MIN_WITNESS_PLACEMENTS`), the `LevelsSpec`, the tests and the 90 generated levels.

## Running the generator

Copy the generator and the plan, never packs: the templates ship no `pack-*.json`, and an example's packs belong to that example's plan. Then run:

```sh
# write apps/<id>/src/levels/pack-1.json ... (one per pack)
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/levels/generate-levels.ts --app <id>
# compare only: exits 1 and names the packs whose bytes differ
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/levels/generate-levels.ts --app <id> --check
npx prettier --check apps/<id>/src/levels
```

The flag silences Node's notice that Expo apps have no `"type"` field (apps must not get one). The generator loads `@e07/<id>/levels/<id>-level-plan.ts` through the workspace link, runs `planLevelTable`, prints failures (a level with no accepted candidate) and exits 1 on any failure. It formats every pack through the repo's own Prettier (`resolveConfig` for the pack's path, the `json` parser), so short arrays such as score thresholds are written `[0, 150, 180]` exactly as `prettier --check` wants them, and `--check` compares those bytes. That is why a pack is never formatted by hand and never listed in `.prettierignore`: the two checks can only disagree when someone edits the file. `check-levels.mjs` makes the same comparison (`pack-stale` for different levels, `pack-format` for different bytes). Commit the packs it wrote, then run the levels tests and the goldens.

## When the tables change

A changed pack file means players get different levels. That is fine before the game ships and a deliberate decision after:

1. Regenerate with the tooling (never edit a pack file by hand; `check-levels.mjs` regenerates and fails on any difference, `pack-stale` or `pack-format`). A tuning change, a changed `create`, a new witness seed or evaluation all count.
2. Run the levels contract test (every level proven by a replayed line, at its par for par levels) and the goldens with `-u` only for the files that should change; open the new snapshots and look at the boards.
3. Commit with a `Gate-Change: <why the levels changed>` trailer. After release, ask the owner first: saved runs keep their own seed and difficulty, but players see different boards under the same level numbers.

Daily levels are different: the daily seed and the generator for existing dates never change (see `goldens-and-quality.md`).
