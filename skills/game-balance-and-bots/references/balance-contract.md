# The balance contract: report, fingerprint and bands

A game is "balanced" when its latest sim report satisfies its bands file. This reference defines both files, how the report is tied to the code it measured, and how bands are set and approved.

## Contents

- The sim report
- The fingerprint
- The bands file
- Endless mode
- Setting bands from the first run
- Owner approval
- How the check judges

## The sim report

`reports/sim/<game-id>.json` (gitignored; written by the sim in `beforeAll`; identical bytes on a rerun):

```json
{
  "gameId": "line-siege",
  "rulesFingerprint": "3ec9ac…",
  "seedsPerCell": 100,
  "maxMoves": 400,
  "cells": [
    {
      "policy": "greedy",
      "difficulty": 0,
      "runs": 100,
      "wins": 73,
      "capHits": 0,
      "winRate": 0.73,
      "medianMoves": 19,
      "p10Moves": 13,
      "p90Moves": 28,
      "medianScore": 140,
      "payoffPerRun": 3.41,
      "twistPerRun": 1.51,
      "lossReasons": { "line-siege.lose.board-full": 27 },
      "firstPayoffShare": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    }
  ]
}
```

| Cell field | Meaning |
|---|---|
| `runs`, `wins`, `winRate` | Runs played (one per seed), runs won, their share (4 decimals) |
| `capHits` | Runs still playing at `maxMoves`: a stuck or endless game. Must be 0. |
| `medianMoves`, `p10Moves`, `p90Moves` | How long runs last (moves; ticks for real-time games). p10 catches levels that end absurdly early. |
| `medianScore` | The game's score (`scoreOf`: the number the HUD and the S7 result show) at the end of a run |
| `payoffPerRun`, `twistPerRun` | Average number of payoff and twist events per run |
| `lossReasons` | Lost runs by the outcome's reason key, one `<game-id>.lose.<reason>` per way of losing (sorted keys) |
| `firstPayoffShare[k-1]` | Share of runs whose first payoff happened at or before move k, k = 1…10 (real-time games: within k seconds, see `payoffStepTicks` in bots-and-sims.md) |

Percentiles use the lower-interpolation rule (`sorted[floor(p/100 × (n-1))]`), so they are always a real run's value.

## The fingerprint

`rulesFingerprint(gameId)` is a sha256 over every source file that can change a bot result, sorted by repo-relative path, each hashed as `"<path>\n<bytes>\n"` (`fingerprintFiles(gameId)` lists them):

- `apps/<id>/src/rules/**`, `levels/**` (except the generated `levels/pack-*.json`), `sim/**`, `testing/**`
- `test/sims/<id>/**`
- the files of `packages/game-kit/src` that those files import, followed through game-kit's own imports (a source scan of every `from '...'` and `import '...'` specifier: `@e07/game-kit/<path>` and relative paths inside game-kit). That is the sim's import closure: the PRNG, the bot harness, the contracts, and the geom, timeline and fixed-step code the rules and sims actually use.

Game-kit files nothing in the closure imports do not count. The board and gesture steps of a build add game-kit files the sims never reach (`timeline/sample.ts`, `timeline/particles.ts`, `geom/stick-command.ts`), and the report stays fresh; once a rules or sim file imports one of them, it joins the fingerprint.

`.ts`, `.tsx` and `.json` files count; unit tests (`*.test.ts`) and snapshots do not; sim files (`*.sim.test.ts`) do, because they choose seeds and policies; `balance-bands.json` does not, so changing a band or approving it never makes the report stale.

The level packs `apps/<id>/src/levels/pack-*.json` do not count either. They are outputs, not inputs: level-generation-and-solvers' `generate-levels.ts` writes them from the rules and the level plan, and the bots never read them. The build order runs the sims first and generates the packs after them, so the report the sims wrote stays fresh when the packs appear, and `check-balance.mjs` still passes with no sim rerun. Everything else in `levels/` (the plan, the solver, `describe`, the table file) still counts, so a change there, or in `rules/`, after the packs were generated makes the report stale as before (fixtures `pass-packs-after-sims`, `bad-rules-changed-after-report` and `bad-level-plan-changed-after-report`). A tuning change regenerates the packs and reruns the sims in the same commit. `check-balance.mjs` recomputes the fingerprint with an independent JavaScript port and fails with `report-stale` when it differs: the numbers describe code that no longer exists. Rerun `npm run test:sim`.

The fingerprint only protects what it covers, so game logic must not reach outside it: a value import from a file in those four app folders to anywhere else in the app (`../board/`, `@e07/<id>/words/`) or to the Shell fails `fingerprint-scope`. Keep word lists, tables and generators under `rules/` or `levels/`. Type-only imports are fine (they cannot change a number), and so is the one import of the engine assembly `rules/<id>-engine.ts` from `board/build-timeline.ts`: bots never animate, so the timeline decides no result.

## The bands file

`test/sims/<game-id>/balance-bands.json`:

| Field | Meaning |
|---|---|
| `gameId` | The app folder name |
| `status` | `"proposed"` until the owner has play-tested and accepted the numbers, then `"approved"` |
| `approvedOn` | `"YYYY-MM-DD"` when approved, else `null` |
| `seedsPerCell` | Runs per cell; at least 100 (the check refuses fewer) |
| `maxMoves` | The move cap for every run (ticks for real-time games) |
| `grid` | Policy → level difficulties to run (whole numbers 0..99; the lower bound of each tuning row), e.g. `{ "random": [0,25,50,75], "greedy": [0,25,50,75], "lookahead": [25] }` |
| `bands[]` | `{ policy, difficulty, metric, min, max, why }`: a number that must stay inside `[min, max]`; `why` says in plain words what it protects |
| `curve` | `{ policy, metric, direction: "up" \| "down", minStep }`: along the policy's difficulties, the metric moves in `direction` by at least `minStep` per level |
| `skillGap` | `{ difficulty, metric, order: [...policies], better: "higher" \| "lower", minStep }`: each policy in `order` beats the previous one by at least `minStep` |
| `firstPayoff` | `{ policy, difficulty, withinMoves (1-10), minShare }`: the kill test (fun-and-kill-test.md); seconds for real-time games |
| `twist` | `{ policy, difficulty, minPerRun }`, or `null` for a game with no twist event |
| `endless` | Only for a game with an endless mode: `{ policy, difficulty: 100, bands: [{ metric, min, max, why }] }` (next section); absent or `null` otherwise |
| `notes` | Plain words for the owner: where the numbers came from and why |

Metrics a band, curve or gap may use: `winRate`, `medianMoves`, `p10Moves`, `p90Moves`, `medianScore`, `payoffPerRun`, `twistPerRun`. Every policy and difficulty a rule names must be in the grid.

Good defaults for a game with runs of a few minutes (Line Siege's bands): greedy wins 60-90 % of the easiest level and 8-35 % of the hardest; random wins at most 30 % of the easiest ("naive play should lose"); a level lasts a few minutes (median moves 15-60); the greedy win rate drops by at least 0.1 per row; random < greedy < lookahead by 0.15 win rate at the second row; the first payoff within 3 moves in 90 % of greedy runs on the easiest level; at least one twist per greedy run. The template file holds the template game's own measured bands instead (Tap Flip, three rows sampled at 0/34/67: a short puzzle whose first row is a warm-up that a reasonable player always wins, 0.9-1.0), with the same curve, skill-gap, first-payoff and twist rules; a new game sets every band from its own first run. For a game whose levels are never won (a pure score game), use `medianScore` or `medianMoves` for the curve and the gap instead of `winRate`.

## Endless mode

A game with an endless mode (`game.config.ts` `modes.endless: true`) plays it as `create(freshSeed, 100)`: the tuning's endless row, never won, only survived. Its win rate is 0 by definition, so it must never be a step of the win-rate curve: put 100 in the greedy grid and the curve silently gains a last step "down to 0", which hides a cliff and says nothing about the endless run.

So the grid lists level difficulties only (0..99), and the endless run gets its own block:

```json
"endless": {
  "policy": "greedy",
  "difficulty": 100,
  "bands": [
    { "metric": "medianMoves", "min": 20, "max": 80, "why": "An endless run outlasts a level (median 26 placements measured) and still ends." },
    { "metric": "medianScore", "min": 120, "max": 300, "why": "A reasonable endless run scores more than a level (median 185 measured)." },
    { "metric": "twistPerRun", "min": 1.5, "max": 10, "why": "Endless runs are where aimed beams matter most (2.35 beam hits per run measured)." }
  ]
}
```

- The sim plays the grid, then this one extra cell (`policy` at difficulty 100), and writes it into the same report; the template sim already does so when the block exists.
- The endless bands judge how long a run lasts (`medianMoves`, `p10Moves`, `p90Moves`), how far it gets (`medianScore`) and whether the twist still matters (`twistPerRun`, `payoffPerRun`); never `winRate`. Every endless run must still end (no cap hits): the pressure rises until the run is lost (Line Siege adds 1 health per 12 placements).
- `check-balance.mjs` validates the block (`difficulty` 100, a grid policy, band fields; `bands-invalid`), refuses 100 inside the grid, reports a missing endless cell (`report-cell-missing`), a won endless run (`endless-won`) and a band outside its range (`band-violated`).

## Setting bands from the first run

1. Copy the template bands, keep `status: "proposed"`, and run `npm run test:sim` once. The band assertion may fail; the report is written anyway.
2. Read every cell (`cat reports/sim/<id>.json`). First fix what is broken, not what is unbalanced: cap hits, a replay difference, a first payoff that never comes, a twist that never happens.
3. Tune the game (tuning-playbook.md) until the curve and gap hold and the numbers match the game's intent (a calm puzzle wins more; a siege loses more).
4. Write the bands around the final numbers with a margin that allows small rule changes (about ±0.1 on rates, ±25 % on move counts), each with a `why`, and write `notes` in plain words: what the first run showed, what changed, what the numbers now are.
5. Rerun: the sim and `check-balance.mjs` pass.

Never widen a band, lower `minStep`, cut `seedsPerCell` or edit the report to make a check pass. A band changes only when the game's intent changes, and then the owner hears about it (the bands file is the design record of the game's difficulty).

## Owner approval

The owner does not read JSON. Tell them, in the evidence report, what the bots found per level in plain words (see bots-and-sims.md, "Reporting to the owner") and ask them to play the first levels on a phone. When they agree the pace feels right, set `"status": "approved"` and `"approvedOn"`. The play-test is the owner's personal step and never blocks (owner decision O6, 2026-09-30): until it is done, every report lists "Play-test <game> on a phone" under "Owner steps (not blocking)", and `check-balance.mjs --release` passes with proposed bands, printing `OWNER STEP (not blocking) ... [bands-unapproved]` for the release report instead of a problem. If the owner's play-test disagrees with the bots ("level 1 is too easy"), the owner wins: retune toward their feel and move the bands with them.

## How the check judges

`check-balance.mjs` reads the report and the bands with its own JavaScript port of `parseBands`/`bandProblems`, so a bug in the TypeScript harness cannot hide a failure. It checks, per game: the report exists and has the right shape, its fingerprint matches the code, it ran the bands' seeds and cap, every grid cell exists without cap hits, and every band, the curve, the skill gap, the first payoff and the twist hold; with an endless block, the endless cell exists, is never won, has no cap hits and stays inside its own bands. Each problem line names the file and line (the band in the bands file, or the cell in the report) and the fix.
