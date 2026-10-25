// apps/swap-guard/src/board/layout-board.test.ts
// Spec S5 and 8.11: the board fits any canvas, its squares are the touch targets (44 pt or more on
// a phone), and drawing and touch read the same layout.
import fc from 'fast-check';

import { cellRect, hitTest, isSameTarget } from '@e07/game-kit/geom/board-layout.ts';

import { BADGE_STRIP_PT, layoutBoard } from './layout-board.ts';

import type { SwapGuardView } from './to-view.ts';
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

const view = (size: number): SwapGuardView => ({
  size,
  guard: 0,
  enemies: [],
  fallen: [],
  marks: [],
  swapsLeftText: '9',
  swapsLeft: 9,
  maxSwaps: 12,
  defeated: 0,
  total: 3,
  isHit: false,
});

type FitInput = { width: number; height: number; size: number; isMirrored: boolean };

/** True when one square lies inside the canvas below the badge strip and hit-tests back to itself. */
function cellFits(layout: BoardLayout, input: FitInput, target: BoardTarget): boolean {
  const rect = cellRect(layout, target);
  if (rect === null) return false;
  const isInsideX = rect.x >= 0 && rect.x + rect.width <= input.width;
  const isInsideY = rect.y >= BADGE_STRIP_PT && rect.y + rect.height <= input.height;
  const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  return isInsideX && isInsideY && isSameTarget(hitTest(layout, centre), target);
}

/** True when every square of the board fits (cellFits). */
function cellsFit(input: FitInput): boolean {
  const layout = layoutBoard({ ...input, view: view(input.size) });
  const targets = Array.from({ length: input.size * input.size }, (_cell, index) => ({
    regionId: 'board',
    col: index % input.size,
    row: Math.floor(index / input.size),
  }));
  return targets.every((target) => cellFits(layout, input, target));
}

describe('layoutBoard', () => {
  it('keeps every square inside the canvas below the swaps badge and hit-tests its centre back to itself, at any size', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 240, max: 2732 }),
          height: fc.integer({ min: 240, max: 2732 }),
          size: fc.integer({ min: 5, max: 6 }),
          isMirrored: fc.boolean(),
        }),
        (input) => {
          expect(cellsFit(input)).toBe(true);
        },
      ),
      { seed: 25, numRuns: 150 },
    );
  });

  it.each([
    ['a 402 x 874 pt phone', 374, 660],
    ['a small phone', 320, 400],
    ['a tablet in landscape', 1024, 700],
  ])('gives the 6 x 6 board squares of 44 pt or more on %s (spec 8.11)', (_name, width, height) => {
    const layout = layoutBoard({ width, height, view: view(6), isMirrored: false });
    expect(layout.regions[0]?.cell).toBeGreaterThanOrEqual(44);
  });

  it('mirrors positions (not pixels) when a game opts in to RTL mirroring', () => {
    const layout = layoutBoard({ width: 400, height: 500, view: view(5), isMirrored: true });
    const first = cellRect(layout, { regionId: 'board', col: 0, row: 0 });
    expect(first === null ? 0 : first.x + first.width).toBeGreaterThan(300);
  });
});
