// apps/toggle-drop/src/levels/toggle-drop-levels.golden.test.ts
// DATA GOLDEN. A diff here means players get different levels. Update only on purpose with
// `npx jest <this file> --selectProjects golden -u` and a `Gate-Change:` commit trailer.
// Daily goldens are a hard compatibility contract: an existing date never changes.
import { dailySeed } from '@e07/game-kit/dates/daily-seed.ts';
import { create } from '@e07/toggle-drop/rules/create.ts';

import { describeLevel } from './toggle-drop-describe.ts';
import {
  TOGGLE_DROP_DAILY_DIFFICULTY,
  TOGGLE_DROP_DAILY_SALT,
  TOGGLE_DROP_LEVELS,
} from './toggle-drop-levels.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

/** The frozen text of a level start: its seed and difficulty, then the game's own describeLevel. */
function describeStart(seed: number, difficulty: number): string {
  return `seed ${String(seed)} difficulty ${String(difficulty)} ${describeLevel(create(seed, difficulty))}`;
}

describe('level table goldens', () => {
  it.each([1, 30, 31, 60, 61, 90])('keeps the frozen board of level %i', (level) => {
    const entry = TOGGLE_DROP_LEVELS.table[level - 1];
    if (entry === undefined) throw new Error(`level ${String(level)} missing`);
    expect(
      `${describeStart(entry.seed, entry.difficulty)}\n${JSON.stringify(entry.stars)}`,
    ).toMatchSnapshot();
  });
});

describe('daily challenge goldens (hard compatibility contract)', () => {
  const dates: readonly DateKey[] = ['2026-09-28', '2026-12-31', '2027-01-01'];

  it.each(dates)('keeps the frozen daily board for %s', (date) => {
    const seed = dailySeed(date, TOGGLE_DROP_DAILY_SALT);
    expect(describeStart(seed, TOGGLE_DROP_DAILY_DIFFICULTY)).toMatchSnapshot();
  });
});
