// packages/game-kit/src/geom/board-layout.test.ts
import fc from 'fast-check';

import { cellRect, fitGrid, hitTest } from './board-layout.ts';

import type { BoardLayout } from './board-layout.ts';

function gridLayout(
  size: { width: number; height: number },
  grid: { cols: number; rows: number },
  isMirrored: boolean,
): BoardLayout {
  const box = { x: 0, y: 0, width: size.width, height: size.height };
  return { ...size, isMirrored, regions: [{ id: 'board', ...fitGrid({ box, ...grid }) }] };
}

describe('board layout', () => {
  it('maps every cell centre back to the same cell at any canvas size, mirrored or not', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 200, max: 2732 }),
          height: fc.integer({ min: 200, max: 2732 }),
        }),
        fc.record({ cols: fc.integer({ min: 3, max: 12 }), rows: fc.integer({ min: 3, max: 12 }) }),
        fc.boolean(),
        (size, grid, isMirrored) => {
          const layout = gridLayout(size, grid, isMirrored);
          for (let row = 0; row < grid.rows; row += 1) {
            for (let col = 0; col < grid.cols; col += 1) {
              const rect = cellRect(layout, { regionId: 'board', col, row });
              if (rect === null) throw new Error('missing cell');
              const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
              expect(hitTest(layout, centre)).toStrictEqual({ regionId: 'board', col, row });
            }
          }
        },
      ),
      { seed: 11, numRuns: 200 },
    );
  });

  it('puts logical column 0 on the physical right edge when mirrored', () => {
    const layout = gridLayout({ width: 400, height: 400 }, { cols: 4, rows: 4 }, true);
    expect(cellRect(layout, { regionId: 'board', col: 0, row: 0 })?.x).toBe(300);
  });

  it('keeps the whole grid inside the canvas', () => {
    const region = fitGrid({ box: { x: 0, y: 0, width: 390, height: 520 }, cols: 8, rows: 8 });
    expect(region.x + region.cell * 8).toBeLessThanOrEqual(390);
    expect(region.y + region.cell * 8).toBeLessThanOrEqual(520);
  });
});
