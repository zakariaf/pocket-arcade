// apps/stepstone/src/board/layout-board.test.ts
// Spec S5 and 8.11: every touch target on the board is at least 44 pt; the board fits any canvas.
import fc from 'fast-check';

import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';

import { layoutBoard } from './layout-board.ts';

import type { StepstoneView } from './to-view.ts';

const MIN_TOUCH_PT = 44;

const view = (side: number): StepstoneView => ({
  side,
  cells: Array.from({ length: side * side }, () => 0),
  frog: 0,
  reach: [],
  movesText: '0',
});

/**
 * The board canvas S5 leaves (the screen minus the status bar, the 60 pt game top bar and the
 * board margins 4 / 14 / 40): a 402 × 874 pt phone, a 375 × 667 pt phone and an iPad in landscape.
 */
const CANVASES = [
  { name: '402 × 874 phone', width: 402 - 28, height: 874 - 62 - 60 - 44 },
  { name: '375 × 667 phone', width: 375 - 28, height: 667 - 20 - 60 - 44 },
  { name: 'tablet landscape', width: 1024, height: 700 },
];

describe('layoutBoard', () => {
  it('keeps every cell inside the canvas and hit-tests its centre back to itself, at any size', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 240, max: 2732 }),
          height: fc.integer({ min: 240, max: 2732 }),
          side: fc.integer({ min: 5, max: 7 }),
          isMirrored: fc.boolean(),
        }),
        ({ width, height, side, isMirrored }) => {
          const layout = layoutBoard({ width, height, view: view(side), isMirrored });
          for (let index = 0; index < side * side; index += 1) {
            const target = { regionId: 'board', col: index % side, row: Math.floor(index / side) };
            const rect = cellRect(layout, target);
            if (rect === null) throw new Error('missing cell');
            expect(rect.x >= 0 && rect.x + rect.width <= width).toBe(true);
            expect(rect.y >= 0 && rect.y + rect.height <= height).toBe(true);
            const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            expect(hitTest(layout, centre)).toStrictEqual(target);
          }
        },
      ),
      { seed: 17, numRuns: 150 },
    );
  });

  it.each(CANVASES)('gives the 7 × 7 pond cells of at least 44 pt on a $name', (canvas) => {
    const layout = layoutBoard({ ...canvas, view: view(7), isMirrored: false });
    expect(layout.regions.map((region) => region.cell >= MIN_TOUCH_PT)).toStrictEqual([true]);
  });

  it('keeps the pond square: as many columns as rows', () => {
    const [region] = layoutBoard({
      width: 600,
      height: 400,
      view: view(6),
      isMirrored: false,
    }).regions;
    expect([region?.cols, region?.rows]).toStrictEqual([6, 6]);
  });
});
