// apps/toggle-drop/src/board/layout-board.test.ts
import fc from 'fast-check';

import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';

import { layoutBoard, unitPoint } from './layout-board.ts';

import type { ToggleDropView } from './to-view.ts';
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

const view = (cols: number, rows: number): ToggleDropView => ({
  cols,
  rows,
  pegs: Array.from({ length: cols * rows }, () => -1),
  needs: Array.from({ length: cols }, () => 0),
  filled: Array.from({ length: cols }, () => 0),
  needTexts: Array.from({ length: cols }, () => ''),
  pendingTexts: Array.from({ length: cols }, () => ''),
  ballsLeft: 8,
});

/** Whether one cell lies inside the canvas and hit-tests back to itself. */
function isCellSound(layout: BoardLayout, target: BoardTarget): boolean {
  const rect = cellRect(layout, target);
  if (rect === null) return false;
  const isInside =
    rect.x >= 0 &&
    rect.x + rect.width <= layout.width &&
    rect.y >= 0 &&
    rect.y + rect.height <= layout.height;
  const hit = hitTest(layout, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  return isInside && hit?.col === target.col && hit.row === target.row;
}

/** Cells of the grid that fall outside the canvas or do not hit-test back to themselves. */
function cellProblems(layout: BoardLayout, cols: number, rows: number): string[] {
  const problems: string[] = [];
  for (let row = 0; row < rows + 2; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isCellSound(layout, { regionId: 'board', col, row })) {
        problems.push(`cell ${String(col)},${String(row)}`);
      }
    }
  }
  return problems;
}

describe('layoutBoard', () => {
  it('keeps every cell, chute to cups, inside the canvas and hit-tests it back, at any size', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 240, max: 2732 }),
          height: fc.integer({ min: 240, max: 2732 }),
          cols: fc.integer({ min: 5, max: 7 }),
          rows: fc.integer({ min: 3, max: 5 }),
        }),
        ({ width, height, cols, rows }) => {
          const layout = layoutBoard({ width, height, view: view(cols, rows), isMirrored: false });
          expect(cellProblems(layout, cols, rows)).toStrictEqual([]);
        },
      ),
      { seed: 17, numRuns: 150 },
    );
  });

  it('fits a phone, a small phone and a tablet in landscape with cells of at least 44 pt', () => {
    // 402 x 874 pt phone (board area 374 x 660), iPhone SE (375 pt wide: 347 between the 14 pt
    // margins), a tablet in landscape.
    const sizes = [
      { width: 374, height: 660 },
      { width: 347, height: 480 },
      { width: 1024, height: 700 },
    ];
    const cells = sizes.map((size) =>
      layoutBoard({ ...size, view: view(7, 5), isMirrored: false }),
    );
    expect(cells.map((layout) => layout.regions[0]?.cell ?? 0).every((cell) => cell >= 44)).toBe(
      true,
    );
  });

  it('places the points of the fall at the centres of their cells', () => {
    const layout = layoutBoard({ width: 400, height: 400, view: view(5, 3), isMirrored: false });
    const region = layout.regions[0];
    if (region === undefined) throw new Error('no board region');
    const chute = cellRect(layout, { regionId: 'board', col: 1, row: 0 });
    const cup = cellRect(layout, { regionId: 'board', col: 3, row: 4 });
    expect(unitPoint(region, 180, 0)).toStrictEqual({
      x: (chute?.x ?? 0) + region.cell / 2,
      y: (chute?.y ?? 0) + region.cell / 2,
    });
    expect(unitPoint(region, 420, 480)).toStrictEqual({
      x: (cup?.x ?? 0) + region.cell / 2,
      y: (cup?.y ?? 0) + region.cell / 2,
    });
  });
});
