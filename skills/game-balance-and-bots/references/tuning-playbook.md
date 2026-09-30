# Tuning playbook: knobs, curves and the tuning loop

How to change a game's difficulty on purpose, one number at a time, with the sims as the measuring tape.

## Contents

- The tuning file
- Which knobs exist in most games
- The difficulty curve
- The tuning loop
- Symptoms and what to turn
- Worked example: tuning Line Siege
- Daily, packs and levels

## The tuning file

Every balance number of a game lives in `apps/<game-id>/src/rules/<game-id>-tuning.ts` (a real-time game keeps it in `src/sim/<game-id>-tuning.ts` with the file-level `'worklet';` directive, because its sim reads it on the UI thread).

The template (`templates/apps/__GAME_ID__/src/rules/__GAME_ID__-tuning.ts`, with its test) is the template game's, Tap Flip's: one per-row knob, the board `side` in three rows (0-33: 3x3, 34-66: 4x4, 67-99: 5x5), and scalar knobs for the scramble presses (`minPresses`, one more every `difficultyPerPress` points, through `pressesFor`), the moves per press, the points per spare move and the continue's extra moves. It is the same file the game-rules-engine templates ship; their `create.ts`, `outcome.ts` and engine read it, so the rules hold no other balance number. Tap Flip has no endless mode, so its `knobsFor` has no endless line. A game with an endless mode has the shape of Line Siege's file:

```ts
import { isEndlessDifficulty, rowFor } from '@e07/game-kit/contract/difficulty.ts';

/** The knobs that change with difficulty: one level row per band of 0..99, plus the endless row. */
export type DifficultyKnobs = {
  /** Monsters in the level's wave; the level is won when the whole wave is gone (0 = endless, never won). */
  readonly goal: number;
  /** Monsters step toward the wall every Nth placement (higher = calmer). */
  readonly marchEvery: number;
  // ... every per-difficulty knob, documented here once
};

/** Level rows, easiest first; rowFor splits 0..99 into equal bands (four rows: 0-24, 25-49, 50-74, 75-99). */
const LEVEL_ROWS = [
  { goal: 4, marchEvery: 6, spawnEvery: 6, hpMin: 3, hpMax: 5, kinds: NORMAL_ONLY },
  // one row per band, each clearly harder than the one before
] as const satisfies readonly DifficultyKnobs[];

/** The endless run (difficulty 100): goal 0, so outcome never returns won. */
const ENDLESS_ROW = { goal: 0, marchEvery: 4, spawnEvery: 3, hpMin: 4, hpMax: 7, kinds: MIXED } as const satisfies DifficultyKnobs;

export const TUNING = {
  /** Lane rows a monster walks before it breaks the wall (more = calmer). */
  laneRows: 6,
  // ... every knob that does not change with difficulty, each with a comment
  levelRows: LEVEL_ROWS,
  endlessRow: ENDLESS_ROW,
} as const;

/** The knobs of a difficulty 0..100: the endless row at 100, else the level row rowFor picks. */
export function knobsFor(difficulty: number): DifficultyKnobs {
  if (isEndlessDifficulty(difficulty)) return TUNING.endlessRow;
  const row = rowFor(difficulty, TUNING.levelRows.length);
  // A reduce over the non-empty table: no unreachable `?? table[0]` branch for the coverage gate.
  return TUNING.levelRows.reduce((picked, knobs, index) => (index === row ? knobs : picked));
}
```

The whole file is `examples/line-siege/apps/line-siege/src/rules/line-siege-tuning.ts`, with its test.

Rules:

- The rules read knobs only through `TUNING` and `knobsFor(state.difficulty)`; they contain no other balance numbers (a `3` hearts in `create.ts` is a hidden knob). Board geometry, damage, spawn rates, goals, starting resources and opening layouts are all knobs.
- A table beats a formula: four explicit rows are easy to read, diff and tune one cell at a time. Use a formula only when a game has dozens of levels, and then keep its coefficients in the tuning file.
- Every knob has a comment saying what it controls and which direction is harder (`check-balance.mjs` fails an undocumented knob). Document each per-difficulty knob once, on the `DifficultyKnobs` type: the rows of the table are values, so Prettier may wrap a long row (a nested `kinds: { normal, armoured, fast }` object) over several lines without a comment on each.
- **Difficulty is one scale, whole numbers 0..100** (game-kit `contract/difficulty.ts`), never a table index. `create(seed, difficulty)` stores the clamped value; `knobsFor` maps it to a row with `rowFor(difficulty, rows)`, so the level curve (0..99), the daily (a medium 40-50) and every tuning row line up, and a save stays valid when a row's numbers change (the level changes; a daily golden may too, and that is a gated change). 100 (`ENDLESS_DIFFICULTY`) is the endless run of a game that has one: its own row with goal 0, never won.
- Pick the row with `rowFor` and a `reduce` over the table, as above. A real-time game's `'worklet'` tuning module may call only worklets on the UI thread, so it writes `rowFor`'s one line out instead of importing it (`examples/halo-drift/apps/halo-drift/src/sim/halo-drift-tuning.ts`). `table[index] ?? table[0]` has a branch no test can reach, and the copied file then fails the 90 % per-file branch threshold of `apps/*/src/rules/`.
- Test the mapping (`<game-id>-tuning.test.ts`): the lower and upper bound of each band, clamping below 0 and above 100, and the endless row at 100 when the game has one.

## Which knobs exist in most games

| Knob family | Examples | Harder when |
|---|---|---|
| Goal | pops, points, sheep to pen, par | higher |
| Pressure frequency | enemies march every N moves, spawn every N, flood rises every N | lower N |
| Pressure strength | enemy health, enemy count, damage to the player | higher |
| Resources | hearts, undos, moves, hand size, tray size | fewer |
| Board density | opening blocks, rocks, walls, free cells | usually more (and more lock-prone) |
| Randomness mercy | how often the helpful piece or card is dealt | rarer |

Turn pressure frequency and goals first: they move the curve predictably. Strength knobs move it in jumps. Density knobs change how runs end (lock-ups), so watch `lossReasons` when you touch them.

## The difficulty curve

- Monotone: each difficulty is clearly harder for the reasonable player (greedy win rate drops by at least `minStep`, 0.1 by default). Two levels that feel the same waste the player's time; a cliff (0.58 → 0.08) ends most players' progress.
- The easiest level is winnable by a reasonable player most of the time (60-90 %), never always: a level that cannot be lost teaches nothing.
- The hardest level is hard but winnable (8-35 % for greedy), and the lookahead bot still wins it often: the ceiling is skill, not luck.
- The daily challenge uses a medium difficulty from 40 to 50, the second of four rows (Line Siege: 45), so the daily is fair on most days.
- The sims sample the lower bound of each row for the curve (`[0, 25, 50, 75]` for four rows). The endless difficulty 100 is never a step of the curve: it has its own `endless` block in the bands file (balance-contract.md, "Endless mode").

## The tuning loop

1. Run `npm run test:sim` and read the report (`reports/sim/<game-id>.json`): win rates per policy and difficulty, move spread, `lossReasons`, the first-payoff curve, twists per run.
2. Name the problem in one sentence ("every greedy run of level 2 dies at move 10": look at `p10Moves` and `p90Moves` together).
3. Form one hypothesis and change one knob (or one row) in the tuning file.
4. Rerun and compare the two reports (same seeds, so the difference is the change).
5. Keep or revert. Repeat until the curve, the gap, the kill test and the twist hold.
6. Write the bands around the result and the story in the bands file's `notes`.

Change the bot's evaluation only to fix unreasonable play (it filled the board a human would keep open), never to reach a band. Never change seeds to find "better" numbers.

## Symptoms and what to turn

| Symptom in the report | Likely cause | Turn |
|---|---|---|
| `p10Moves == p90Moves`, low: every run dies at the same move | Pressure arrives on a fixed clock faster than the player can answer | pressure frequency down (march or spawn less often), lanes longer |
| Win rate near 0 for every policy | Too hard or a broken win condition | goal down, pressure down; check that `won` is reachable in a unit test |
| Win rate near 1 for random | Choices do not matter | goal up, pressure up; make wrong moves cost something |
| greedy ≈ lookahead | No depth to master | add a reason to plan ahead (delayed payoffs, combos) |
| random ≈ greedy | The evaluation or the choices are fake | check evaluate; strengthen the consequences of moves |
| One `lossReasons` key dominates the easy levels (e.g. `line-siege.lose.board-full`) | The game ends by attrition, not by the intended threat | density down (fewer opening blocks), smaller pieces, more clears |
| `capHits > 0` | A run can go on forever or gets stuck | fix the rules: every game must end (add pressure, a turn limit or a stuck detector) |
| First payoff late (`firstPayoffShare[2]` low) | The opening does not set up an early win moment | build the opening for it (fun-and-kill-test.md) |
| `twistPerRun` < 1 | The twist rarely matters | change the rules so the twist is the natural best move, not a curiosity |
| Curve not monotone | Two rows too close, or a knob that helps in disguise | spread the rows; change one knob per row |

## Worked example: tuning Line Siege

The example in `examples/line-siege/` is Line Siege v1, the same code every skill uses: an 8x8 block board, a tray of three blocks (all three refill once all are used), every column a lane of 6 rows, three monster kinds (normal; armoured, which only beams hurt; fast, two rows per march) and 3 hearts on the wall. A cleared column fires a beam (8 damage) at the monster nearest the wall in its lane (the twist); the cleared rows send one shockwave (2 per row) to every monster but the armoured. A level is won when its wave of `goal` monsters is gone; it is lost when the last heart goes (`line-siege.lose.broke-through`) or no tray block fits (`line-siege.lose.board-full`). Every number is a default until the owner's play-test.

**First run** of the four level rows (0/25/50/75, the lower bound of each row) and the endless row, 100 seeds per cell:

| | d0 | d25 | d50 | d75 |
|---|---|---|---|---|
| greedy win rate | 0.73 | 0.56 | 0.39 | 0.04 |

The curve had a cliff at the last row (0.39 to 0.04): its monsters marched every 3rd placement.

**One change:** the last row's `marchEvery` 3 to 4.

**Result** (the example's `reports/sim/line-siege.json`):

| | d0 | d25 | d50 | d75 | endless (d100) |
|---|---|---|---|---|---|
| greedy win rate | 0.73 | 0.56 | 0.39 | 0.14 | 0 (never won) |
| random win rate | 0.22 | 0.14 | 0.11 | 0.02 | |
| lookahead win rate | | 1.0 | | | |
| greedy median placements | 19 | 20 | 24 | 24 | 26 |
| greedy first payoff on move 1 | 100 % | 100 % | 100 % | 100 % | 100 % |
| greedy beam hits (twist) per run | 1.51 | 1.56 | 1.59 | 1.87 | 2.35 |

The curve drops by at least 0.17 per row, the skill gap is clear (0.14 < 0.56 < 1.0 at d25), the first placement always fires a beam that defeats a monster (the prepared opening), and the twist happens one and a half to two times per level. `lossReasons` show how runs end: random play mostly fills the board (`line-siege.lose.board-full` 78 of 100 at d0), while at d75 greedy loses more often by a breach (`line-siege.lose.broke-through` 49) than by a full board (37). The endless run lasts a median 26 placements and ends about half by a full board and half by a breach. The bands in `examples/line-siege/test/sims/line-siege/balance-bands.json` are written around these numbers, `status: "proposed"` until the owner plays it.

**A rejected cadence:** the brief's "the monsters march one lane row per placement" (`marchEvery` 1 with 6-row lanes) was measured too: greedy won 0.16/0/0/0 and random 0, every run lost by a breach within 6-12 placements. So the march stays a per-row knob. The teaching copy now says "The monsters march closer every few blocks" (the lead's decision L4, 2026-09-30, in all four languages), which holds for any `marchEvery` of 2 or more: keep every row at 2 or more, or ask the owner for new copy first.

## Daily, packs and levels

- Levels are generated from a seed plus a difficulty; the pack layout maps level numbers to difficulties 0..99 (`levels.difficultyFor`), `knobsFor` maps each difficulty to its row, and the daily uses a medium difficulty (Line Siege 45: row 2 of 4). The sims measure the difficulty rows; the level generator and solver (proving each shipped level winnable, par, stars) belong to the `level-generation-and-solvers` skill.
- A pack's difficulty curve over its 30 levels is a sequence of rows: use the sims to make sure neighbouring rows differ, then let the generator pick seeds per level.
- Tune before the packs exist: the balance sims pass first, then level-generation-and-solvers generates the packs. Changing a row later changes every level and daily built from it: regenerate the packs (`generate-levels.ts`) in the same commit with a `Gate-Change:` trailer. Daily goldens are a compatibility contract: a tuning change that alters an existing date's daily also needs the owner's OK.
