# Writing data goldens

How to pin generated levels, daily levels and output formats as readable text snapshots.

## Contents

- What deserves a data golden
- Make the snapshot readable
- The level and daily golden file
- What the snapshot file looks like
- Reading a data golden diff
- Other formats worth pinning

## What deserves a data golden

- Every level generator: a few seeds across the difficulty range (`[1, 0]`, `[2, 1]`, `[3, 3]`).
- Every game with a daily challenge: at least three dates through `dailySeed(date, SALT)` at the daily difficulty, including a year boundary pair.
- Every hand-made level pack: one golden per pack listing each level's id, size and par, so an accidental edit shows up.
- Output formats that players or saves depend on and that are easier to review as text than as assertions (a share string, a stats summary line).

A generator's properties (winnable, in range, deterministic) are tested in the ordinary `unit` project; the golden pins the exact output on top.

## Make the snapshot readable

A golden is reviewed by reading its diff, so it should look like what the player sees:

- Boards as ASCII rows with `renderCells(cells, cols)` from `packages/game-kit/src/testing/render-cells.ts` (`#` filled, `.` empty). A game with more cell kinds writes its own small renderer in the same folder (one character per kind, a legend in its comment).
- One header line with the inputs and the headline numbers: `seed 3211492107 difficulty 2 target 70`.
- Short lines for the rest (`tray [[0,0],[1,0]] ...`); `JSON.stringify` of small pieces is fine.
- Snapshot a string, not an object, so Jest prints it as text rather than as an `Object { ... }` tree.
- Keep each entry under about 60 lines; `check-goldens.mjs` fails entries above 120.

## The level and daily golden file

`templates/level.golden.test.ts` is the pattern (and `examples/generate-level.golden.test.ts` the verified Line Siege file):

```ts
// apps/line-siege/src/levels/generate-level.golden.test.ts
// DATA GOLDEN. A diff here means players get different levels. Update only with
// `npx jest <this file> --selectProjects golden -u` plus a `Gate-Change:` commit trailer.
import { dailySeed } from '@e07/game-kit/dates/daily-seed.ts';
import { renderCells } from '@e07/game-kit/testing/render-cells.ts';

import { generateLevel } from './generate-level.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

const LINE_SIEGE_DAILY_SALT = 0x4c53;
const DAILY_DIFFICULTY = 2;

function describeLevel(seed: number, difficulty: number): string {
  const level = generateLevel(seed, difficulty);
  const tray = level.start.tray.map((piece) => JSON.stringify(piece)).join(' ');
  return [
    `seed ${String(seed)} difficulty ${String(difficulty)} target ${String(level.targetScore)}`,
    renderCells(level.start.cells, level.start.cols),
    `tray ${tray}`,
  ].join('\n');
}

describe('generateLevel goldens', () => {
  it.each([
    [1, 0],
    [2, 1],
    [3, 3],
  ])('generates the frozen layout for seed %i at difficulty %i', (seed, difficulty) => {
    expect(describeLevel(seed, difficulty)).toMatchSnapshot();
  });
});

describe('daily challenge goldens (hard compatibility contract)', () => {
  const dates: readonly DateKey[] = ['2026-09-26', '2026-12-31', '2027-01-01'];

  it.each(dates)('generates the frozen daily level for %s', (date) => {
    expect(
      describeLevel(dailySeed(date, LINE_SIEGE_DAILY_SALT), DAILY_DIFFICULTY),
    ).toMatchSnapshot();
  });
});
```

Rules for the file:

- The salt and the daily difficulty are the game's real values (the game's level config `levels.daily.salt` and `levels.daily.difficulty`); import them instead of repeating them once the config exists, so a changed salt shows up as a golden diff.
- The word `daily` stays in the describe title of the daily goldens: `check-golden-changes.mjs` recognises daily entries by the word `daily` in the snapshot key. Never rename a daily golden's describe or test title either: the key is part of the entry, so the history check sees the old daily entry deleted and fails the commit (verified), even when the level is unchanged.
- Titles start with a third-person verb (`generates ...`), like every test title.
- No clock, no `Math.random`: the seed and the date are literals.

## What the snapshot file looks like

`generate-level.golden.test.ts.snap.ios` next to the test:

```
exports[`daily challenge goldens (hard compatibility contract) generates the frozen daily level for 2026-09-26 1`] = `
"seed 3211492107 difficulty 2 target 70
......#
.......
.#.....
..#....
.......
.#...#.
.#.....
tray [[0,0],[1,0]] [[0,0],[1,0],[0,1]] [[0,0]]"
`;
```

The key is the full test title plus a counter; renaming a test title makes the old entry obsolete and the new one missing, which `--ci` reports as a failure. So a renamed golden test is also a Gate-Change commit.

## Reading a data golden diff

```
- Snapshot  - 1
+ Received  + 1

  "seed 1 difficulty 0 target 30
  .....
  .....
- ..##.
+ .##..
  tray [[0,0],[1,0]] ...
```

A moved block in the level of seed 1 means the generator now draws differently for the same seed: every saved "level 1" of every player would change. Unless the change is the point of the commit, it is a bug: find what consumed the random stream differently (an extra `nextU32` call, a reordered loop, a changed constant).

## Other formats worth pinning

- A pack golden: `pack classic: 1 5x5 par 7 | 2 5x5 par 9 | ...`.
- A save document shape is pinned by frozen fixtures (`fixtures/save-vN.minimal.json` and `save-vN.full.json`) with a checksum test, not by a snapshot; the save work owns them, and they are gated the same way.
- The RNG sequence and `dailySeed` values are pinned with `toBe(...)` in their unit tests; treat an edit there exactly like a daily golden edit.
