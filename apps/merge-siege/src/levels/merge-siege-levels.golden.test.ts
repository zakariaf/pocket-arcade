// apps/merge-siege/src/levels/merge-siege-levels.golden.test.ts
// DATA GOLDEN. A diff here means players get different levels. Update only on purpose with
// `npx jest <this file> --selectProjects golden -u` and a `Gate-Change:` commit trailer.
// Daily goldens are a hard compatibility contract: an existing date never changes.
import { dailySeed } from '@e07/game-kit/dates/daily-seed.ts';
import { create } from '@e07/merge-siege/rules/create.ts';

import { describeLevel } from './merge-siege-describe.ts';
import {
  MERGE_SIEGE_DAILY_DIFFICULTY,
  MERGE_SIEGE_DAILY_SALT,
  MERGE_SIEGE_LEVELS,
} from './merge-siege-levels.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

function describeStart(seed: number, difficulty: number): string {
  return `seed ${String(seed)} difficulty ${String(difficulty)} ${describeLevel(create(seed, difficulty))}`;
}

describe('level table goldens', () => {
  it.each([1, 30, 31, 60, 61, 90])('keeps the frozen board of level %i', (level) => {
    const entry = MERGE_SIEGE_LEVELS.table[level - 1];
    if (entry === undefined) throw new Error(`level ${String(level)} missing`);
    expect(
      `${describeStart(entry.seed, entry.difficulty)}\n${JSON.stringify(entry.stars)}`,
    ).toMatchSnapshot();
  });
});

describe('daily challenge goldens (hard compatibility contract)', () => {
  const dates: readonly DateKey[] = ['2026-09-28', '2026-12-31', '2027-01-01'];

  it.each(dates)('keeps the frozen daily board for %s', (date) => {
    const seed = dailySeed(date, MERGE_SIEGE_DAILY_SALT);
    expect(describeStart(seed, MERGE_SIEGE_DAILY_DIFFICULTY)).toMatchSnapshot();
  });
});
