# The level model: packs, stars, unlocking, daily and endless

What the Shell expects from a game's `levels` member, what the spec says about levels, stars and the daily challenge, and the pure helpers that implement those rules.

## Contents

- What the spec asks for
- The types (`LevelsSpec`, `LevelEntry`, `LevelPack`, `StarRule`, `Solver`)
- One difficulty scale: the curve, the tuning rows, the daily and endless
- Pack layout and unlocking
- Stars
- The daily challenge
- Endless mode
- Who uses what

## What the spec asks for

- **Levels are generated, not drawn by hand** (spec 8.1): the same seed and difficulty always make the same level; where the game allows it, a solver checks every level before it ships ("no level is impossible") and computes **par**, the best possible result.
- **v1 layout** (decision D9): 3 packs x 30 levels = 90 levels per game, adjustable per game in `game.config.ts` `levels: { packCount, levelsPerPack }`.
- **Stars** (8.1): puzzle games give 3 stars at or under par, 2 stars up to par + 2, 1 star for finishing; score games give 3/2/1 stars at score thresholds. The best result per level is kept.
- **Unlocking** (S8): levels unlock one after another; packs unlock by stars collected in total (for example pack 2 needs 45 stars), so no player is stuck forever on one hard level; tapping a locked tile says how to unlock it; Premium never unlocks levels.
- **Modes** (8.2): LEVELS always on; DAILY on by default; ENDLESS optional (games with no natural end).
- **Daily** (8.3, S9): the level comes from today's local date plus the game's own salt, through the same generator as normal levels, at a medium difficulty; every phone gets the same level on the same date with no internet; past days cannot be replayed for streaks.

## The types (`LevelsSpec`, `LevelEntry`, `LevelPack`, `StarRule`, `Solver`)

From `packages/game-kit/src/contract/levels.ts` (installed by the game-rules-engine skill; canonical):

```ts
type StarRule =
  | { kind: 'par'; par: number }                                  // puzzle games
  | { kind: 'score'; thresholds: readonly [number, number, number] }; // score games

type LevelEntry = { level: number; seed: number; difficulty: number; stars: StarRule };
type LevelPack = { id: string; nameId: MessageId; firstLevel: number; levelCount: number; starsToUnlock: number };
type SolveResult<TState, TMove> =
  | { kind: 'solved'; par: number; line: readonly TMove[]; final: TState } // final: where the line ends
  | { kind: 'unsolvable' }                                                  // the whole space was searched
  | { kind: 'budget-exceeded' };                                            // gave up (or a witness lost)
type Solver<TState, TMove> = { solve: (start: TState, maxNodes: number) => SolveResult<TState, TMove> };

type LevelsSpec<TState, TMove> = {
  difficultyFor: (level: number) => number;        // the curve, 0..99
  packs: readonly LevelPack[];
  table: readonly LevelEntry[];                    // pack-1.json + pack-2.json + ... concatenated
  solver: Solver<TState, TMove> | null;            // tooling and tests (and hints), never needed to play
  daily: { kind: 'none' } | { kind: 'daily'; difficulty: number; salt: number };
  endless: { kind: 'none' } | { kind: 'endless'; difficulty: number }; // difficulty: ENDLESS_DIFFICULTY
};
```

Level numbers are 1-based and global across packs ("Level 12"). Seeds are uint32, difficulties whole numbers on the one 0..100 scale (the save schema's ranges; levels and the daily 0..99, 100 the endless run). The generator is the engine's own `create(seed, difficulty)`: a level is nothing but its seed and difficulty, which keeps the save and the tables tiny. Every game with levels has a solver: an exact search for par games, `createWitnessSolver` for score games that draw during play (`solvers.md`).

## One difficulty scale: the curve, the tuning rows, the daily and endless

Every game uses one difficulty scale, whole numbers 0..100, from `packages/game-kit/src/contract/difficulty.ts` (game-rules-engine installs it): `create(seed, difficulty)` clamps to it with `clampDifficulty`; levels and the daily use 0..99 (`MAX_LEVEL_DIFFICULTY`); 100 (`ENDLESS_DIFFICULTY`) is reserved for the endless run and means something only in a game whose `LevelsSpec` has an endless mode.

- **The curve** (`difficultyFor`) rises from 0 at level 1 to its cap at the last level and never falls. The cap is 99 unless the game's solver can only prove easier levels. Tap Flip keeps 60 (`LEVEL_DIFFICULTY_CAP` in the template plan): past 4x4 boards with 8 scramble presses the exact solver's cost grows too fast for the generator's budget, and harder boards are not more fun.
- **The tuning rows.** A game's tuning table lists rows easiest first; `knobsFor(d)` returns the endless row at 100 and otherwise row `rowFor(d, rows.length) = floor(min(max(floor(d), 0), 99) * rows / 100)`. With four rows, 0-24 plays row 0, 25-49 row 1, 50-74 row 2 and 75-99 row 3, so the 90 levels of a 0..99 curve walk through every row (about 22 levels each).
- **The daily** uses a medium difficulty from 40 to 50 on the level scale, fixed forever per game. Line Siege uses 45: the second of its four rows (the balance sims sample each row at its lower bound, 0/25/50/75, so the daily's row is measured).
- **Endless** is `create(freshSeed, 100)`. There is no mode argument: the engine sees `isEndlessDifficulty(difficulty)` and plays its endless row (Line Siege: no wave goal, rising health, never won).

Line Siege in numbers: levels 1..90 on `difficultyFor(level) = floor((level - 1) * 99 / 89)` (0 at level 1, 99 at level 90), packs of 30 covering difficulties 0-32, 33-65 and 66-99; the daily at 45 (row 1 of rows 0-3); the endless run at 100. Tap Flip: levels on 0..60, daily 40, no endless mode.

`toLevelEntries(json)` (`levels/level-table.ts`) turns a committed pack file into typed entries and throws a `RangeError` on anything invalid: JSON widens `kind` to `string`, so the table is validated, never cast.

## Pack layout and unlocking

`packsOf(plan)` (`levels/plan-level-table.ts`) builds the packs from the plan: consecutive level ranges, `starsToUnlock = defaultStarsToUnlock(index, levelsPerPack)` = half of all stars of the packs before it (0, 45, 90 for packs of 30). Pack ids are kebab-case (`'first-sparks'`), pack names are catalog keys numbered by pack (`'<game-id>.pack-name.1'`, `.2`, `.3`, the same keys the copy deck and the i18n skill use) in all four catalogs.

`levels/pack-progress.ts` holds the S8 rules as pure functions over "best stars per completed level":

| Function | Rule |
|---|---|
| `totalStars(stars)` | sum of best stars |
| `packOf(packs, level)` | the pack holding a level |
| `isPackUnlocked(pack, stars)` | total stars >= `starsToUnlock` |
| `isLevelUnlocked(packs, stars, level)` | its pack is unlocked, and it is the pack's first level or the level before it was won |
| `starsMissing(pack, stars)` | the "Collect n more stars" line on a locked pack |
| `nextLevel(table, level)` | the level after this one, or null (the S7 "Next level" key) |

## Stars

`starsFor(rule, { isWon, moves, score })` (`levels/star-rating.ts`):

- a loss: 0 (only wins are recorded);
- `par` rule: 3 when `moves <= par`, 2 when `moves <= par + 2`, else 1;
- `score` rule `[win, two, three]`: `thresholds[0]` is the lowest score a win can have, 0 when the win is not score-based (Line Siege is won by clearing the wave, whatever the score); the game's `outcome` decides the win, so `starsFor` never reads it. 2 stars at `thresholds[1]`, 3 at `thresholds[2]`; thresholds are three strictly ascending whole numbers. A witness game sets two at the witness score (at least 1) and three 20 % above it (at least 1 more).

Moves count what the player kept: undone moves do not count (the Shell's move counter goes down on undo). The game-host-integration skill calls `starsFor` at run end with the level's table entry and records the result.

## The daily challenge

- `dailyStart(levels, dateKey)` (`levels/daily-start.ts`) returns `{ seed: dailySeed(dateKey, levels.daily.salt), difficulty: levels.daily.difficulty }`, or `null` for a game without a daily mode. The Shell calls `create(seed, difficulty)` with it.
- `dailySeed(date, salt)` (`dates/daily-seed.ts`) is FNV-1a over the `'YYYY-MM-DD'` key mixed with the salt. Its goldens are a hard compatibility contract: `dailySeed('2026-09-26', 17) = 2599028541`, `dailySeed('2026-09-27', 17) = 2582250922`. Changing it, or a game's salt, changes every player's daily level between app versions.
- Pick each game's salt once and never change it: a 16-bit number no other game uses (`daily-salt-shared` fails on a copy). Default: the value new-game-scaffold printed, which is FNV-1a of the game id folded to 16 bits (`h = FNV-1a(id); (h ^ (h >>> 16)) & 0xffff`). The template's `0x5446` belongs to Tap Flip: replace it. The daily difficulty is a medium value, 40 to 50 on the level scale (Line Siege 45, the second of its four tuning rows).
- Day boundaries are the Shell's: "today" is `ClockPort.today()` (local calendar date), read on every focus; a daily run keeps the date it started with, so finishing after midnight records the day it was played.

## Endless mode

`endless: { kind: 'endless', difficulty: ENDLESS_DIFFICULTY }` for games that can run until the player loses (Line Siege), exactly when `game.config.ts` has `modes.endless: true` (`endless-mode` in the checker; the levels contract test fails any other endless difficulty). The run is `create(freshSeed, ENDLESS_DIFFICULTY)`: the Shell draws the fresh seed from the clock outside the rules and saves it with the run, so a resumed run replays exactly. The tuning's endless row has goal 0, and `outcome` never returns `won` at difficulty 100 (the engine contract test proves it with seeded random play): an endless run only ever ends lost. Endless has no stars and no table entry; its result shows "New best!" whenever the score beats the stored best, win or not.

## Who uses what

| Consumer | Uses |
|---|---|
| S8 Levels screen | `packs`, `table`, `isLevelUnlocked`, `starsMissing`, `totalStars` |
| S5/S7 Game and Result | `table` entry (seed, difficulty, stars), `starsFor`, `nextLevel` (game-host-integration) |
| S9 Daily, S4 Home card | `dailyStart` and the daily model (daily-and-statistics) |
| Hints (spec 8.5) | `rules.hints.suggest` built on the solver (see `solvers.md`) |
| Tooling | the level plan, `planLevelTable`, `generate-levels.ts` |
| Tests | `levelsContractProblems`, goldens, the solver properties |
