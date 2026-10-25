// apps/toggle-drop/src/rules/drop-path.test.ts
import fc from 'fast-check';

import { create } from './create.ts';
import { dropPath, flipPath, nextColumn, pegAt } from './drop-path.ts';

import type { PegBoard } from './drop-path.ts';

/** Row 0: a right switch in the middle; row 1: left switches at both ends. */
const BOARD: PegBoard = { cols: 3, rows: 2, pegs: [-1, 1, -1, 0, -1, 0] };

describe('pegAt', () => {
  it('reads the switch of a cell, and none outside the board', () => {
    expect(pegAt(BOARD, 0, 1)).toBe(1);
    expect(pegAt(BOARD, 1, 0)).toBe(0);
    expect(pegAt(BOARD, 0, 0)).toBe(-1);
    expect([pegAt(BOARD, -1, 0), pegAt(BOARD, 2, 0), pegAt(BOARD, 0, 3)]).toStrictEqual([
      -1, -1, -1,
    ]);
  });

  it('treats a cell missing from a short peg list as empty', () => {
    expect(pegAt({ ...BOARD, pegs: [] }, 1, 1)).toBe(-1);
  });
});

describe('nextColumn', () => {
  it('sends the ball one column to the side the switch points to', () => {
    expect(nextColumn(5, 2, 0)).toBe(1);
    expect(nextColumn(5, 2, 1)).toBe(3);
  });

  it('lets the ball fall straight on when the switch points into a wall', () => {
    expect(nextColumn(5, 0, 0)).toBe(0);
    expect(nextColumn(5, 4, 1)).toBe(4);
  });
});

describe('dropPath', () => {
  // Catalogue: "every switch it passes sends it left or right and flips".
  it('follows each switch the ball meets, row by row', () => {
    expect(dropPath(BOARD, 1)).toStrictEqual({
      steps: [
        { row: 0, col: 1, side: 1 },
        { row: 1, col: 2, side: 0 },
      ],
      landing: 1,
    });
  });

  it('falls straight down a column without switches', () => {
    expect(dropPath(BOARD, 0)).toStrictEqual({
      steps: [
        { row: 0, col: 0, side: null },
        { row: 1, col: 0, side: 0 },
      ],
      landing: 0,
    });
  });

  it('meets every peg row once and moves at most one column per row (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 99 }),
        (seed, difficulty) => {
          const state = create(seed, difficulty);
          for (let col = 0; col < state.cols; col += 1) {
            const path = dropPath(state, col);
            expect(path.steps.map((step) => step.row)).toStrictEqual(
              Array.from({ length: state.rows }, (_, row) => row),
            );
            const cols = [...path.steps.map((step) => step.col), path.landing];
            cols.slice(1).forEach((at, index) => {
              expect(Math.abs(at - (cols[index] ?? at))).toBeLessThanOrEqual(1);
            });
            expect(path.landing).toBeGreaterThanOrEqual(0);
            expect(path.landing).toBeLessThan(state.cols);
          }
        },
      ),
    );
  });
});

describe('flipPath', () => {
  it('flips exactly the switches on the path and leaves its input alone', () => {
    const before = [...BOARD.pegs];
    expect(flipPath(BOARD, dropPath(BOARD, 1))).toStrictEqual([-1, 0, -1, 0, -1, 1]);
    expect(BOARD.pegs).toStrictEqual(before);
  });

  it('changes nothing for a path without switches', () => {
    const path = { steps: [{ row: 0, col: 0, side: null }], landing: 0 };
    expect(flipPath(BOARD, path)).toStrictEqual(BOARD.pegs);
  });
});
