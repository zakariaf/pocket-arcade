// apps/scrap-shove/src/rules/list-moves.test.ts
import fc from 'fast-check';

import { stateFromText } from './board-text.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });

describe('listMoves', () => {
  it('lists a step to every free neighbour in reading order, then wait (spec 13: tap the player to wait)', () => {
    const state = stateFromText(['n.....', '......', '..@...', '......', '......', '......']);
    expect(listMoves(state)).toStrictEqual([
      { kind: 'step', col: 1, row: 1 },
      { kind: 'step', col: 2, row: 1 },
      { kind: 'step', col: 3, row: 1 },
      { kind: 'step', col: 1, row: 2 },
      { kind: 'step', col: 3, row: 2 },
      { kind: 'step', col: 1, row: 3 },
      { kind: 'step', col: 2, row: 3 },
      { kind: 'step', col: 3, row: 3 },
      { kind: 'wait' },
    ]);
  });

  it('lists a shove onto a heap whose far square is free or holds a robot (the crush)', () => {
    const state = stateFromText(['.n..', '.#..', '.@#.', '....']);
    const moves = listMoves(state);
    expect(moves).toContainEqual({ kind: 'shove', col: 1, row: 1 });
    expect(moves).toContainEqual({ kind: 'shove', col: 2, row: 2 });
  });

  it('leaves out a shove into the wall or into a second heap', () => {
    const state = stateFromText(['n...', '..#.', '..#.', '..@#']);
    expect(listMoves(state)).toStrictEqual([
      { kind: 'step', col: 1, row: 2 },
      { kind: 'step', col: 3, row: 2 },
      { kind: 'step', col: 1, row: 3 },
      { kind: 'wait' },
    ]);
  });

  it('leaves out a step onto a robot', () => {
    const state = stateFromText(['....', '.nh.', '.@f.', '....']);
    expect(listMoves(state)).toStrictEqual([
      { kind: 'step', col: 0, row: 1 },
      { kind: 'step', col: 0, row: 2 },
      { kind: 'step', col: 0, row: 3 },
      { kind: 'step', col: 1, row: 3 },
      { kind: 'step', col: 2, row: 3 },
      { kind: 'wait' },
    ]);
  });

  it('lists nothing once the floor is won or lost', () => {
    const state = stateFromText(['n..', '...', '..@']);
    expect(listMoves({ ...state, robots: [] })).toStrictEqual([]);
    expect(listMoves({ ...state, caughtBy: 1 })).toStrictEqual([]);
  });

  it('keeps the pinned moves of the seed 1 opening', () => {
    expect(listMoves(create(1, 0))).toStrictEqual(GOLDEN_SEED_1_MOVES);
  });

  it('lists each move once and always offers wait', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        const moves = listMoves(create(seed, difficulty)).map((move) => JSON.stringify(move));
        expect(new Set(moves).size).toBe(moves.length);
        expect(moves.at(-1)).toBe(JSON.stringify({ kind: 'wait' }));
      }),
    );
  });
});

const GOLDEN_SEED_1_MOVES = [
  { kind: 'step', col: 3, row: 3 },
  { kind: 'shove', col: 4, row: 3 },
  { kind: 'step', col: 5, row: 3 },
  { kind: 'step', col: 3, row: 4 },
  { kind: 'step', col: 5, row: 4 },
  { kind: 'step', col: 3, row: 5 },
  { kind: 'step', col: 4, row: 5 },
  { kind: 'step', col: 5, row: 5 },
  { kind: 'wait' },
];
