// apps/line-siege/src/rules/create.test.ts
import fc from 'fast-check';

import { renderCells } from '@e07/game-kit/testing/render-cells.ts';

import { fullLines } from './board-lines.ts';
import { create } from './create.ts';
import { TUNING } from './line-siege-tuning.ts';
import { HORIZONTAL_TWO, VERTICAL_TWO } from './pieces.ts';

import type { LineSiegeState } from './line-siege-types.ts';

const SIZE = TUNING.boardSize;
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });

function filledIn(state: LineSiegeState, line: (index: number) => number): number[] {
  return Array.from({ length: SIZE }, (_, value) => {
    const counts = state.cells.filter((cell, index) => cell === 1 && line(index) === value);
    return counts.length;
  });
}

function expectFairStart(state: LineSiegeState): void {
  expect(fullLines(state.cells)).toStrictEqual({ rows: [], cols: [] });
  const isInLanes = state.monsters.every((monster) => monster.lane < SIZE && monster.hp > 0);
  expect(isInLanes).toBe(true);
  expect(new Set(state.monsters.map((monster) => monster.lane)).size).toBe(3);
}

describe('create', () => {
  it('stores the difficulty whole and inside 0..100 (the save schema range)', () => {
    expect([-4, 37.9, 180].map((difficulty) => create(1, difficulty).difficulty)).toStrictEqual([
      0, 37, 100,
    ]);
  });

  it('starts one 8x8 board with three hearts, three offered blocks and three monsters (spec 13)', () => {
    const state = create(1, 0);
    expect(state.cells).toHaveLength(SIZE * SIZE);
    expect(state.tray).toHaveLength(3);
    expect(state.hearts).toBe(TUNING.hearts);
    expect(state.monsters).toHaveLength(3);
    expect(state).toMatchObject({ placements: 0, spawned: 3, defeated: 0, score: 0, nextId: 4 });
  });

  it('prepares one column and one row two cells short, with the two bars in the tray', () => {
    const state = create(9, 0);
    expect(filledIn(state, (index) => index % SIZE)).toContain(SIZE - 2);
    expect(filledIn(state, (index) => Math.floor(index / SIZE))).toContain(SIZE - 2);
    expect(state.tray.slice(1)).toStrictEqual([VERTICAL_TWO, HORIZONTAL_TWO]);
  });

  it('puts a monster one beam can defeat in the lane of the prepared column', () => {
    const state = create(9, 0);
    const column = filledIn(state, (index) => index % SIZE).indexOf(SIZE - 2);
    const first = state.monsters[0];
    expect(first?.lane).toBe(column);
    expect(first?.hp).toBeLessThanOrEqual(TUNING.beamDamage);
  });

  it('stores the clamped difficulty', () => {
    expect(create(1, 250).difficulty).toBe(100);
  });

  describe('properties', () => {
    it('gives the same state for the same seed and difficulty', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(create(seed, difficulty)).toStrictEqual(create(seed, difficulty));
        }),
      );
    });

    it('starts without a full line, with three monsters in three lanes', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expectFairStart(create(seed, difficulty));
        }),
      );
    });
  });

  it('keeps the pinned opening for seed 1 at difficulty 0 (a changed opening breaks saved levels)', () => {
    const state = create(1, 0);
    const text = [
      renderCells(state.cells, SIZE),
      JSON.stringify(state.tray),
      JSON.stringify(state.monsters),
    ].join('\n');
    expect(text).toBe(GOLDEN_SEED_1_OPENING);
  });
});

const GOLDEN_SEED_1_OPENING = [
  '..#...##',
  '.......#',
  '..#....#',
  '........',
  '...#....',
  '..######',
  '..#....#',
  '#......#',
  '[3,2,1]',
  '[{"id":1,"kind":"normal","lane":7,"row":1,"hp":6},{"id":2,"kind":"normal","lane":6,"row":0,"hp":3},{"id":3,"kind":"normal","lane":4,"row":0,"hp":4}]',
].join('\n');
