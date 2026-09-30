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
