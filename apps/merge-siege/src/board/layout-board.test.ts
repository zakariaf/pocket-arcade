// apps/merge-siege/src/board/layout-board.test.ts
// One pure layout for draw and touch (board-rendering-skia rule 9): the 5 x 6 board with the gate
// row above it, where the next enemy waits, at any canvas size.
import fc from 'fast-check';

import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';
import { create } from '@e07/merge-siege/rules/create.ts';

import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

const VIEW = toView(create(1, 0), { formatNumber: (value) => String(value) });

describe('layoutBoard', () => {
  it('keeps every cell inside the canvas and hit-tests its centre back to itself, at any size', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 240, max: 2732 }),
          height: fc.integer({ min: 240, max: 2732 }),
          isMirrored: fc.boolean(),
        }),
        ({ width, height, isMirrored }) => {
          const layout = layoutBoard({ width, height, view: VIEW, isMirrored });
          for (let row = 0; row < VIEW.rows; row += 1) {
            for (let col = 0; col < VIEW.cols; col += 1)
              expectCellInside({ layout, col, row, width, height });
          }
        },
      ),
      { seed: 17, numRuns: 150 },
    );
  });

  it('puts the gate row, as wide as the board, right above its top row', () => {
    const layout = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });
    const gate = cellRect(layout, { regionId: 'gate', col: 0, row: 0 });
    const top = cellRect(layout, { regionId: 'board', col: 0, row: 0 });
    expect(gate).not.toBeNull();
    expect(gate?.x).toBe(top?.x);
    expect((gate?.y ?? 0) + (gate?.height ?? 0)).toBe(top?.y);
    expect(layout.regions.map((region) => [region.id, region.cols, region.rows])).toStrictEqual([
      ['gate', 5, 1],
      ['board', 5, 6],
    ]);
  });

  it('uses the largest whole-pixel cells that fit seven rows', () => {
    const layout = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });
    expect(cellRect(layout, { regionId: 'board', col: 0, row: 0 })?.width).toBe(74);
  });

  // The S5 board canvases of a 402 x 874 pt phone, a 375 x 667 pt small phone and a 1194 x 834 pt
  // tablet in landscape (the screen less the top bar and the 14 pt margins).
  it.each([
    { name: 'phone', width: 374, height: 660 },
    { name: 'small phone', width: 347, height: 470 },
    { name: 'tablet in landscape', width: 1166, height: 640 },
  ])('gives cells of at least 44 pt on a $name', ({ width, height }) => {
    const layout = layoutBoard({ width, height, view: VIEW, isMirrored: false });
    const cells = layout.regions.map((region) => region.cell);
    expect(cells).toHaveLength(2);
    expect(Math.min(...cells)).toBeGreaterThanOrEqual(44);
  });
});

type CellCheck = {
  readonly layout: ReturnType<typeof layoutBoard>;
  readonly col: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
};

function expectCellInside({ layout, col, row, width, height }: CellCheck): void {
  const rect = cellRect(layout, { regionId: 'board', col, row });
  if (rect === null) throw new Error('missing cell');
  expect(rect.x >= 0 && rect.x + rect.width <= width).toBe(true);
  expect(rect.y >= 0 && rect.y + rect.height <= height).toBe(true);
  const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  expect(hitTest(layout, centre)).toStrictEqual({ regionId: 'board', col, row });
}
