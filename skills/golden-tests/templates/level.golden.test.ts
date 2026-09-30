// apps/__GAME_ID__/src/levels/generate-level.golden.test.ts
// DATA GOLDEN. A diff here means players get different levels. Update only with
// `npx jest <this file> --selectProjects golden -u` plus a `Gate-Change:` commit trailer.
// The daily entries are a hard compatibility contract (spec 8.3): never change or delete one;
// adding a date is fine. Keep the word "daily" in their describe title (the history check reads it).
import { dailySeed } from '@e07/game-kit/dates/daily-seed.ts';
import { renderCells } from '@e07/game-kit/testing/render-cells.ts';

import { generateLevel } from './generate-level.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

/** The game's real daily salt and difficulty (import them from the level config once it exists). */
const DAILY_SALT = __DAILY_SALT__;
const DAILY_DIFFICULTY = __DAILY_DIFFICULTY__;

/** What a player sees: the inputs, the headline numbers, the board as ASCII rows. */
function describeLevel(seed: number, difficulty: number): string {
  const level = generateLevel(seed, difficulty);
  return [
    `seed ${String(seed)} difficulty ${String(difficulty)} target ${String(level.__TARGET_FIELD__)}`,
    renderCells(level.start.cells, level.start.cols),
  ].join('\n');
}

describe('generateLevel goldens', () => {
  it.each([
    [1, 0],
    [2, 1],
    [3, __MAX_DIFFICULTY__],
  ])('generates the frozen layout for seed %i at difficulty %i', (seed, difficulty) => {
    expect(describeLevel(seed, difficulty)).toMatchSnapshot();
  });
});

describe('daily challenge goldens (hard compatibility contract)', () => {
  // At least three dates, with a year boundary pair: date-key bugs live at month and year ends.
  const dates: readonly DateKey[] = ['2026-09-26', '2026-12-31', '2027-01-01'];

  it.each(dates)('generates the frozen daily level for %s', (date) => {
    expect(describeLevel(dailySeed(date, DAILY_SALT), DAILY_DIFFICULTY)).toMatchSnapshot();
  });
});
