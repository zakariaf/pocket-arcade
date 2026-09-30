# Data goldens, the daily contract and level quality

How levels are pinned so a code change can never silently give players different boards, what the daily-challenge contract requires, and what the level quality checks measure.

## Contents

- Why goldens
- The golden test file
- Creating and changing goldens
- The daily challenge contract
- The levels contract test
- Level quality metrics (what `check-levels.mjs` measures)
- Bots and balance (hand-off)

## Why goldens

Properties prove that levels are solvable and deterministic, not that they are the same levels as yesterday. A small change in `create`, the RNG use or the curve regenerates different boards under the same level numbers; a player mid-way through pack 2 would find a different level 37. Data goldens pin readable pictures of chosen levels, so any such change shows up in review as an ASCII diff.

## The golden test file

`apps/<id>/src/levels/<id>-levels.golden.test.ts` (template provided) runs in Jest's `golden` project (every `*.golden.test.ts`) and pins:

- the start board of the first and last level of each pack (levels 1, 30, 31, 60, 61, 90), with the star rule;
- the daily board for three fixed dates, one of them across a year boundary (`'2026-12-31'`, `'2027-01-01'`).

The golden test knows nothing about the game's state: it adds the seed and the difficulty and asks the game's own `describeLevel(state)` (`apps/<id>/src/levels/<id>-describe.ts`, with a small test) for the rest:

```ts
function describeStart(seed: number, difficulty: number): string {
  return `seed ${String(seed)} difficulty ${String(difficulty)} ${describeLevel(create(seed, difficulty))}`;
}
```

The template's `describeLevel` suits a grid game: the move limit, then `renderCells(state.cells, state.cols)` (`testing/render-cells.ts`: '#' lit or filled, '.' empty, one line per row). A game with more than a grid renders every part a player sees at the start, the same way each time. Line Siege (`examples/line-siege/levels/line-siege-describe.ts`) prints the hearts and the tray's piece indexes, then the lanes far end first (` .` empty, else a kind letter and the health: `n5` is a normal monster with 5 health, `a` armoured, `f` fast), then the 8x8 board:

```
seed 4013825362 difficulty 45 hearts 3 tray 6,2,1
 .  .  .  . n4  .  . n4
 .  .  .  .  . n6  .  .
 (four more lane rows)
.....#..
.....#..
###..###
 (five more board rows)
```

The snapshot is written next to the test as `<test file>.snap.ios` (jest-expo's iOS snapshot resolver) and committed; `examples/tap-flip-levels.golden.test.ts.snap.ios` shows the template game's snapshot and `examples/line-siege/levels/line-siege-levels.golden.test.ts.snap.ios` a score game's.

## Creating and changing goldens

- `jest --ci` never writes a snapshot: a missing snapshot fails the run, which is what keeps goldens deliberate.
- Create or change them only on purpose, one file at a time: `npx jest apps/<id>/src/levels/<id>-levels.golden.test.ts --selectProjects golden -u`. Never `-u` in scripts, hooks or for a whole folder.
- Open the `.snap.ios` file and read the boards before committing: do they look like levels of that difficulty?
- Commit with a `Gate-Change: <reason>` trailer (snapshot files are gated paths).
- A template copied for a new game has no snapshot yet: run the golden test once with `-u`, read it, commit it.

## The daily challenge contract

- Every phone, every app version, same date: same daily level (spec 8.3). So the pieces that decide it never change for a shipped game: `dailySeed` (goldens `2026-09-26`/salt 17 = `2599028541`, `2026-09-27`/salt 17 = `2582250922`), the game's salt, the daily difficulty, and what `create` makes of that seed and difficulty.
- The daily goldens for existing dates never change. If a rules change would change them, stop and ask the owner; the usual answer is to keep the old generation path for the daily difficulty.
- Test the daily with `dailyStart(levels, date)` (seed and difficulty) and pin the boards in the golden file; `check-levels.mjs` requires at least three pinned dates for a game whose daily mode is on and runs the real `dailySeed` against its goldens.

## The levels contract test

`apps/<id>/src/levels/<id>-levels.test.ts` calls `levelsContractProblems` (`levels/levels-contract.ts`) and expects `[]`:

| Check | Message |
|---|---|
| table numbered 1..n in order | `table[4] is level 6, expected 5` |
| every difficulty equals `difficultyFor(level)` | `level 3 difficulty 9 differs from difficultyFor (3)` |
| no repeated seed and difficulty | `level 2 repeats seed/difficulty 1/1` |
| pack ids kebab-case, consecutive, sizes equal to `game.config.ts` | `pack second starts at 4, expected 3` |
| first pack needs 0 stars, later packs never fewer than earlier ones | `the first pack must need 0 stars` |
| pack count and levels per pack match `game.config.ts` | `2 packs, game.config says 3` |
| every level and the daily at or below 99; an endless mode exactly at `ENDLESS_DIFFICULTY` (100) | `the endless difficulty 99 is not ENDLESS_DIFFICULTY (100)` |
| with a solver: every level solved (a witness re-played from its fixed bot seed), its line replays through the real engine and wins, and a par level's par equals the recorded par | `level 4 par 3 differs from the solver's 4`, `level 7 is budget-exceeded` |

This is spec 15 item 7 ("every shipped level is proven winnable") as a test that runs on every commit.

## Level quality metrics (what `check-levels.mjs` measures)

`node ${CLAUDE_SKILL_DIR}/scripts/check-levels.mjs . --game <id> --report` prints per pack: level count, difficulty range and average, par range and average. The rules it enforces:

| Rule | Fails when |
|---|---|
| `pack-json` | a pack file is not a JSON array of valid entries (uint32 seed, difficulty 0..99, par >= 1 or three ascending thresholds) |
| `level-numbering` / `pack-size` / `pack-config` | levels are not 1..n across packs, packs differ in size, or differ from `game.config.ts` |
| `duplicate-level` | two levels share seed and difficulty |
| `difficulty-curve` | a level's difficulty is below the level before it |
| `trivial-level` | a level after level 3 is won in one move |
| `par-curve` | a later pack averages a lower par than an earlier pack |
| `solver-required` | par-rated levels but `solver: null` |
| `daily-mode` / `endless-mode` | `game.config.ts` modes and the `LevelsSpec` disagree, or the daily has no salt |
| `level-golden` / `golden-snapshot-missing` / `daily-golden` | no golden test, no committed snapshot, or fewer than three pinned daily dates |
| `levels-contract-test` | no test runs `levelsContractProblems` |
| `pack-stale` / `plan-failure` / `plan-run` | the committed levels are not exactly what the plan generates today (a witness's lost candidates are retries, not failures) |
| `pack-format` | the levels are right but the bytes are not what `generate-levels.ts` writes through the repo's Prettier (a hand-formatted or JSON.stringify-only pack) |
| `pure-import` / `determinism` | a level file imports outside `@e07/game-kit/**`, `@e07/<id>/rules/**` and `@e07/<id>/levels/**` (for example the game's `testing/` bot), or uses `Math.random`, a clock, `**` or transcendental `Math` |
| `kit-file-missing` / `kit-export-missing` | a level kit file (including `witness-solver.ts`) or the generator is missing or old |
| `daily-seed-golden` | the real `dailySeed` no longer gives its golden values |
| `daily-salt-shared` | two games use the same daily salt (usually the template's `0x5446` copied) |
| `star-rule` | the real `starsFor` breaks spec 8.1 (par 7: 7 moves 3 stars, 9 moves 2, 10 moves 1, a loss 0; thresholds [100, 250, 400]: 249 gives 1, 250 gives 2, 400 gives 3) |

The owner approves the bands (minimum par per pack, difficulty cap) in the game's design notes; the plan's `rate()` enforces them while generating.

## Bots and balance (hand-off)

Difficulty curves in terms of bot win rates, the endless run's length and "no endless games" are measured by bot simulations (`*.sim.test.ts`, `npm run test:sim`) with the game-balance-and-bots skill, before the packs are generated. Winnability of each shipped level is proven here: by the exact solver for par games, by the witness (the same greedy bot from a fixed seed) for score games that draw at random. Keep the solver or the witness for proofs and the sims for how a human-like player fares.
