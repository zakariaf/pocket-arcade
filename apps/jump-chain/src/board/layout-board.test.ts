// apps/jump-chain/src/board/layout-board.test.ts
import fc from 'fast-check';

import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';

import { DRAG_LIFT_PT, PEEK_CELLS, layoutBoard } from './layout-board.ts';

import type { JumpChainView } from './to-view.ts';
import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';

/** Touch targets on boards are at least 44 pt (spec S5). */
const MIN_TOUCH_PT = 44;

const VIEW: JumpChainView = {
  cols: 7,
  rows: 10,
  piece: { col: 3, row: 7 },
  enemies: [],
  enemiesLeft: 0,
  marchIn: 4,
  marchInText: '4',
  targets: [],
};

/** The board canvas S5 leaves: a 402 x 874 pt phone, a 375 x 667 pt phone, an iPad on its side. */
const CANVASES = [
  { name: 'a 402 x 874 pt phone', width: 374, height: 660 },
  { name: 'a 375 x 667 pt phone', width: 347, height: 543 },
  { name: 'a tablet in landscape', width: 1024, height: 700 },
];

function board(layout: BoardLayout): BoardLayout['regions'][number] {
  const [region] = layout.regions;
  if (region === undefined) throw new Error('no board region');
  return region;
}

describe('layoutBoard', () => {
  it('keeps every square inside the canvas and hit-tests its centre back to itself, at any size', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 240, max: 2732 }),
          height: fc.integer({ min: 240, max: 2732 }),
        }),
        ({ width, height }) => {
          const layout = layoutBoard({ width, height, view: VIEW, isMirrored: false });
          for (let row = 0; row < VIEW.rows; row += 1) {
            for (let col = 0; col < VIEW.cols; col += 1) {
              const rect = cellRect(layout, { regionId: 'board', col, row });
              if (rect === null) throw new Error('missing square');
              expect(rect.x >= 0 && rect.x + rect.width <= width).toBe(true);
              expect(rect.y >= 0 && rect.y + rect.height <= height).toBe(true);
              const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
              expect(hitTest(layout, centre)).toStrictEqual({ regionId: 'board', col, row });
            }
          }
        },
      ),
      { seed: 23, numRuns: 150 },
    );
  });

  it('keeps the waiting rank’s peek band above the board and a drag lift below it, at any size', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 240, max: 2732 }),
          height: fc.integer({ min: 240, max: 2732 }),
        }),
        ({ width, height }) => {
          const region = board(layoutBoard({ width, height, view: VIEW, isMirrored: false }));
          expect(region.y - region.cell * PEEK_CELLS).toBeGreaterThanOrEqual(0);
          expect(region.y + region.cell * region.rows + DRAG_LIFT_PT).toBeLessThanOrEqual(height);
        },
      ),
      { seed: 23, numRuns: 150 },
    );
  });

  it.each(CANVASES)('gives $name squares of at least 44 pt', ({ width, height }) => {
    const region = board(layoutBoard({ width, height, view: VIEW, isMirrored: false }));
    expect([region.cols, region.rows]).toStrictEqual([7, 10]);
    expect(region.cell).toBeGreaterThanOrEqual(MIN_TOUCH_PT);
  });

  it('passes the host’s mirroring through (the board never asks for it)', () => {
    const layout = layoutBoard({ width: 400, height: 640, view: VIEW, isMirrored: true });
    const first = cellRect(layout, { regionId: 'board', col: 0, row: 0 });
    expect(first === null ? 0 : first.x + first.width).toBeGreaterThan(300);
  });
});
