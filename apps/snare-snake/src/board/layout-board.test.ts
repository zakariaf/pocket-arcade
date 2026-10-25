// apps/snare-snake/src/board/layout-board.test.ts
// Spec S5 and 8.11: the board fits any canvas, its cells are the touch targets (44 pt or more on a
// phone), and drawing and touch read the same layout.
import fc from 'fast-check';

import { cellRect, hitTest, isSameTarget } from '@e07/game-kit/geom/board-layout.ts';

import { BADGE_STRIP_PT, layoutBoard } from './layout-board.ts';

import type { SnareSnakeView } from './to-view.ts';
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

const view = (cols: number, rows: number): SnareSnakeView => ({
  cols,
  rows,
  snake: [0],
  heading: 'right',
  critters: [],
  movesLeftText: '9',
  movesLeft: 9,
  caught: 0,
  total: 4,
});

type FitInput = { width: number; height: number; cols: number; rows: number; isMirrored: boolean };

/** True when one cell lies inside the canvas below the badge strip and hit-tests back to itself. */
function cellFits(layout: BoardLayout, input: FitInput, target: BoardTarget): boolean {
  const rect = cellRect(layout, target);
  if (rect === null) return false;
  const isInsideX = rect.x >= 0 && rect.x + rect.width <= input.width;
  const isInsideY = rect.y >= BADGE_STRIP_PT && rect.y + rect.height <= input.height;
  const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  return isInsideX && isInsideY && isSameTarget(hitTest(layout, centre), target);
}

/** True when every cell of the board fits (cellFits). */
function cellsFit(input: FitInput): boolean {
  const layout = layoutBoard({ ...input, view: view(input.cols, input.rows) });
  const targets = Array.from({ length: input.cols * input.rows }, (_cell, index) => ({
    regionId: 'board',
    col: index % input.cols,
    row: Math.floor(index / input.cols),
  }));
  return targets.every((target) => cellFits(layout, input, target));
}

describe('layoutBoard', () => {
  it('keeps every cell inside the canvas below the moves badge and hit-tests its centre back to itself, at any size', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 240, max: 2732 }),
          height: fc.integer({ min: 240, max: 2732 }),
          cols: fc.integer({ min: 7, max: 8 }),
          rows: fc.integer({ min: 8, max: 10 }),
          isMirrored: fc.boolean(),
        }),
        (input) => {
          expect(cellsFit(input)).toBe(true);
        },
      ),
      { seed: 17, numRuns: 150 },
    );
  });

  it('gives the largest board cells of 44 pt or more on a 402 x 874 pt phone (spec 8.11)', () => {
    const layout = layoutBoard({ width: 374, height: 660, view: view(8, 10), isMirrored: false });
    expect(layout.regions[0]?.cell).toBeGreaterThanOrEqual(44);
  });

  it('mirrors positions (not pixels) when a game opts in to RTL mirroring', () => {
    const layout = layoutBoard({ width: 400, height: 500, view: view(7, 8), isMirrored: true });
    const first = cellRect(layout, { regionId: 'board', col: 0, row: 0 });
    expect(first === null ? 0 : first.x + first.width).toBeGreaterThan(300);
  });
});
