// apps/__GAME_ID__/src/board/layout-board.test.ts
import fc from 'fast-check';

import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';

import { layoutBoard } from './layout-board.ts';

import type { __GAME_PASCAL__View } from './to-view.ts';

const view = (cols: number, rows: number): __GAME_PASCAL__View => ({
  cols,
  rows,
  cells: Array.from({ length: cols * rows }, () => 0),
  movesLeftText: '0',
});

describe('layoutBoard', () => {
  it('keeps every cell inside the canvas and hit-tests its centre back to itself, at any size', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 240, max: 2732 }),
          height: fc.integer({ min: 240, max: 2732 }),
          side: fc.integer({ min: 3, max: 6 }),
          isMirrored: fc.boolean(),
        }),
        ({ width, height, side, isMirrored }) => {
          const layout = layoutBoard({ width, height, view: view(side, side), isMirrored });
          for (let row = 0; row < side; row += 1) {
            for (let col = 0; col < side; col += 1) {
              const rect = cellRect(layout, { regionId: 'board', col, row });
              if (rect === null) throw new Error('missing cell');
              expect(rect.x >= 0 && rect.x + rect.width <= width).toBe(true);
              expect(rect.y >= 0 && rect.y + rect.height <= height).toBe(true);
              const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
              expect(hitTest(layout, centre)).toStrictEqual({ regionId: 'board', col, row });
            }
          }
        },
      ),
      { seed: 17, numRuns: 150 },
    );
  });

  it('mirrors positions (not pixels) when the game opts in to RTL mirroring', () => {
    const layout = layoutBoard({ width: 400, height: 400, view: view(4, 4), isMirrored: true });
    const first = cellRect(layout, { regionId: 'board', col: 0, row: 0 });
    expect(first === null ? 0 : first.x + first.width).toBeGreaterThan(300);
  });
});
