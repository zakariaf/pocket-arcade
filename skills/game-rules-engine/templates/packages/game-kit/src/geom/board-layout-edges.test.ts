// packages/game-kit/src/geom/board-layout-edges.test.ts
import { cellRect, EMPTY_LAYOUT, hitTest, isSameTarget } from './board-layout.ts';

import type { BoardLayout } from './board-layout.ts';

const LAYOUT: BoardLayout = {
  width: 200,
  height: 200,
  isMirrored: false,
  regions: [
    { id: 'board', x: 0, y: 0, cell: 50, cols: 2, rows: 2 },
    { id: 'tray', x: 0, y: 150, cell: 0, cols: 3, rows: 1 },
  ],
};

describe('board layout edges', () => {
  it('has no cell for an unknown region', () => {
    expect(cellRect(LAYOUT, { regionId: 'nowhere', col: 0, row: 0 })).toBeNull();
  });

  it('hits nothing outside every region, in a zero-size region, or before the canvas is sized', () => {
    expect(hitTest(LAYOUT, { x: 190, y: 10 })).toBeNull();
    expect(hitTest(LAYOUT, { x: 10, y: 160 })).toBeNull();
    expect(hitTest(EMPTY_LAYOUT, { x: 1, y: 1 })).toBeNull();
  });

  it('lets the slop catch a tap just outside the grid edge', () => {
    expect(hitTest(LAYOUT, { x: 104, y: 10 }, 8)).toStrictEqual({
      regionId: 'board',
      col: 1,
      row: 0,
    });
  });

  it('compares targets by value and treats null as its own value', () => {
    const a = { regionId: 'board', col: 1, row: 0 };
    expect(isSameTarget(a, { ...a })).toBe(true);
    expect(isSameTarget(a, { ...a, row: 1 })).toBe(false);
    expect(isSameTarget(null, null)).toBe(true);
    expect(isSameTarget(a, null)).toBe(false);
  });
});
