// apps/line-siege/src/rules/opening.test.ts
import fc from 'fast-check';

import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { fullLines } from './board-lines.ts';
import { TUNING } from './line-siege-tuning.ts';
import { drawOpening, openingCells, openingMonsters, scatter } from './opening.ts';

import type { Cell } from './line-siege-types.ts';

const SIZE = TUNING.boardSize;
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });

describe('drawOpening', () => {
  it('keeps both gaps off the crossing of the prepared column and row', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const { opening } = drawOpening(seedRng(seed));
        expect([opening.gapRow, opening.gapRow + 1]).not.toContain(opening.row);
        expect([opening.gapCol, opening.gapCol + 1]).not.toContain(opening.col);
      }),
    );
  });
});

describe('openingCells', () => {
  it('fills the prepared column and row except their two-cell gaps', () => {
    const cells = openingCells({ col: 2, row: 5, gapRow: 0, gapCol: 6 });
    const column = cells.filter((_, index) => index % SIZE === 2);
    const row = cells.slice(5 * SIZE, 6 * SIZE);
    expect(column).toStrictEqual([0, 0, 1, 1, 1, 1, 1, 1]);
    expect(row).toStrictEqual([1, 1, 1, 1, 1, 1, 0, 0]);
  });
});

describe('scatter', () => {
  it('adds the opening blocks off the prepared lines without completing a line', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const { opening, rng } = drawOpening(seedRng(seed));
        const base = openingCells(opening);
        const { cells } = scatter(base, opening, rng);
        const added = cells.filter((cell, index) => cell !== base[index]);
        expect(added).toHaveLength(TUNING.openingBlocks);
        expect(fullLines(cells)).toStrictEqual({ rows: [], cols: [] });
      }),
    );
  });
});

describe('openingMonsters', () => {
  it('puts a monster one beam defeats one row down the prepared lane', () => {
    const opening = { col: 3, row: 5, gapRow: 0, gapCol: 6 };
    const { monsters } = openingMonsters(opening, 0, seedRng(1));
    expect(monsters[0]).toMatchObject({ id: 1, lane: 3, row: 1 });
    expect(monsters[0]?.hp).toBeLessThanOrEqual(TUNING.beamDamage);
    expect(JSON.stringify(monsters)).toBe(GOLDEN_SEED_1_MONSTERS);
  });
});

const GOLDEN_SEED_1_MONSTERS =
  '[{"id":1,"kind":"normal","lane":3,"row":1,"hp":6},{"id":2,"kind":"normal","lane":5,"row":0,"hp":3},{"id":3,"kind":"normal","lane":6,"row":0,"hp":3}]';

describe('scatter limits', () => {
  const opening = { col: 0, row: 0, gapRow: 4, gapCol: 4 };

  it('gives up after its tries on a board with no free cell, drawing exactly that often', () => {
    const full = Array.from({ length: SIZE * SIZE }, (): Cell => 1);
    let rng = seedRng(5);
    for (let tries = 0; tries < 300; tries += 1) rng = nextInt(rng, SIZE * SIZE).state;
    expect(scatter(full, opening, seedRng(5))).toStrictEqual({ cells: full, rng });
  });

  it('adds no block that would complete a row, even when its column stays open', () => {
    const cells = Array.from({ length: SIZE * SIZE }, (_, index): Cell =>
      index % SIZE === 2 && index >= SIZE ? 0 : 1,
    );
    expect(scatter(cells, opening, seedRng(5)).cells).toStrictEqual(cells);
  });
});
