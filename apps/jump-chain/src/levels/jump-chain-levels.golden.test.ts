// apps/jump-chain/src/levels/jump-chain-levels.golden.test.ts
// DATA GOLDEN. A diff here means players get different levels. Update only on purpose with
// `npx jest <this file> --selectProjects golden -u` and a `Gate-Change:` commit trailer.
// Daily goldens are a hard compatibility contract: an existing date never changes.
import { dailySeed } from '@e07/game-kit/dates/daily-seed.ts';
import { create } from '@e07/jump-chain/rules/create.ts';

import { describeLevel } from './jump-chain-describe.ts';
import {
  JUMP_CHAIN_DAILY_DIFFICULTY,
  JUMP_CHAIN_DAILY_SALT,
  JUMP_CHAIN_LEVELS,
} from './jump-chain-levels.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

function describeStart(seed: number, difficulty: number): string {
  return `seed ${String(seed)} difficulty ${String(difficulty)} ${describeLevel(create(seed, difficulty))}`;
}

describe('level table goldens', () => {
  it.each([1, 30, 31, 60, 61, 90])('keeps the frozen board of level %i', (level) => {
    const entry = JUMP_CHAIN_LEVELS.table[level - 1];
    if (entry === undefined) throw new Error(`level ${String(level)} missing`);
    expect(
      `${describeStart(entry.seed, entry.difficulty)}\n${JSON.stringify(entry.stars)}`,
    ).toMatchSnapshot();
  });
});

describe('daily challenge goldens (hard compatibility contract)', () => {
  const dates: readonly DateKey[] = ['2026-10-19', '2026-12-31', '2027-01-01'];

  it.each(dates)('keeps the frozen daily board for %s', (date) => {
    const seed = dailySeed(date, JUMP_CHAIN_DAILY_SALT);
    expect(describeStart(seed, JUMP_CHAIN_DAILY_DIFFICULTY)).toMatchSnapshot();
  });
});
