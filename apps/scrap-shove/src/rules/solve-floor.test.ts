// apps/scrap-shove/src/rules/solve-floor.test.ts
import fc from 'fast-check';

import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';

import { applyMove } from './apply-move.ts';
import { stateFromText } from './board-text.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { floorKey, solveFloor } from './solve-floor.ts';

const ENGINE = { listMoves, applyMove, outcome };

describe('floorKey', () => {
  it('keeps the player, the robots with their ids and the heap squares, and nothing else', () => {
    const state = stateFromText(['n..#', '.@..', '..*.', 'f..h']);
    expect(floorKey(state)).toBe(GOLDEN_KEY);
    const shoved = { ...state, heaps: state.heaps.map((heap) => ({ ...heap, isShoved: true })) };
    expect(floorKey(shoved)).toBe(floorKey(state));
    expect(floorKey({ ...state, player: { col: 0, row: 1 } })).not.toBe(floorKey(state));
  });
});

describe('solveFloor (spec 8.1: the solver also calculates par)', () => {
  it('finds the one-shove win of a heavy robot lined up behind a heap', () => {
    const result = solveFloor(stateFromText(['.....', '.....', '..h..', '...#.', '....@']), 1000);
    expect(result).toMatchObject({
      kind: 'solved',
      par: 1,
      line: [{ kind: 'shove', col: 3, row: 3 }],
    });
  });

  it('reports a floor no line can win as unsolvable', () => {
    expect(solveFloor(stateFromText(['...', '.n.', '..@']), 1000).kind).toBe('unsolvable');
  });

  it('reports a search over its node budget as budget-exceeded', () => {
    expect(solveFloor(create(1, 0), 3).kind).toBe('budget-exceeded');
  });

  it('keeps the pinned par of the seed 1 floor', () => {
    expect(solveFloor(create(1, 0), 60_000)).toMatchObject({
      kind: 'solved',
      par: GOLDEN_SEED_1_PAR,
    });
  });

  it('returns lines the real rules replay to a win', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 99 }),
        (seed, difficulty) => {
          const start = create(seed, difficulty);
          const result = solveFloor(start, 60_000);
          if (result.kind !== 'solved') throw new Error(`seed ${String(seed)} is not solved`);
          expect(verifyLine(ENGINE, start, result.line)).toStrictEqual({
            kind: 'wins',
            moves: result.par,
          });
        },
      ),
      { numRuns: 30 },
    );
  });
});

const GOLDEN_KEY = '11|1n0.0,4f0.3,5h3.3|3,10';
const GOLDEN_SEED_1_PAR = 5;
