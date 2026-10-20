// apps/trail-clear/src/levels/trail-clear-levels.golden.test.ts
// DATA GOLDEN. A diff here means players get different levels. Update only on purpose with
// `npx jest <this file> --selectProjects golden -u` and a `Gate-Change:` commit trailer.
// Daily goldens are a hard compatibility contract: an existing date never changes.
import { dailySeed } from '@e07/game-kit/dates/daily-seed.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { create } from '@e07/trail-clear/rules/create.ts';

import { describeLevel } from './trail-clear-describe.ts';
import {
  TRAIL_CLEAR_DAILY_DIFFICULTY,
  TRAIL_CLEAR_DAILY_SALT,
  TRAIL_CLEAR_LEVELS,
} from './trail-clear-levels.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

function describeStart(seed: number, difficulty: number): string {
  return `seed ${String(seed)} difficulty ${String(difficulty)} ${describeLevel(create(seed, difficulty))}`;
}

describe('level table goldens', () => {
  it.each([1, 30, 31, 60, 61, 90])('keeps the frozen board of level %i', (level) => {
    const entry = pickAt(TRAIL_CLEAR_LEVELS.table, level - 1);
    expect(
      `${describeStart(entry.seed, entry.difficulty)}\n${JSON.stringify(entry.stars)}`,
    ).toMatchSnapshot();
  });
});

describe('daily challenge goldens (hard compatibility contract)', () => {
  const dates: readonly DateKey[] = ['2026-10-19', '2026-12-31', '2027-01-01'];

  it.each(dates)('keeps the frozen daily board for %s', (date) => {
    const seed = dailySeed(date, TRAIL_CLEAR_DAILY_SALT);
    expect(describeStart(seed, TRAIL_CLEAR_DAILY_DIFFICULTY)).toMatchSnapshot();
  });
});
