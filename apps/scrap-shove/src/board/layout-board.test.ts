// apps/scrap-shove/src/board/layout-board.test.ts
import fc from 'fast-check';

import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';

import { layoutBoard } from './layout-board.ts';

import type { ScrapShoveView } from './to-view.ts';

/** Touch targets on boards are at least 44 pt (S5, spec 8.11). */
const MIN_TOUCH_PT = 44;

const view = (side: number): ScrapShoveView => ({
  cols: side,
  rows: side,
  player: { col: 0, row: 0 },
  robots: [],
  heaps: [],
  isCaught: false,
  scrapped: 0,
  total: 0,
  countTexts: ['0'],
});

/**
 * The board canvas S5 leaves: the screen minus the status bar, the Toybox top bar (60 pt) and the
 * board margins 4 / 14 / 40. A 375 × 667 pt phone leaves 347 pt: eight 44 pt squares need 352 pt
 * plus the frame, so it gets the largest whole square its width allows (as Line Siege's board).
 */
const SIZES = [
  { name: '402 × 874 pt phone', width: 402 - 28, height: 874 - 62 - 60 - 44, cell: MIN_TOUCH_PT },
  { name: 'tablet in landscape', width: 1024, height: 700, cell: MIN_TOUCH_PT },
];
const SMALL_PHONE = { width: 375 - 28, height: 667 - 20 - 60 - 44 };

describe('layoutBoard', () => {
  it('keeps every square inside the canvas and hit-tests its centre back to itself, at any size', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 240, max: 2732 }),
          height: fc.integer({ min: 240, max: 2732 }),
          side: fc.integer({ min: 4, max: 8 }),
        }),
        ({ width, height, side }) => {
          const layout = layoutBoard({ width, height, view: view(side), isMirrored: false });
          for (let index = 0; index < side * side; index += 1) {
            const target = { regionId: 'board', col: index % side, row: Math.floor(index / side) };
            const rect = cellRect(layout, target);
            if (rect === null) throw new Error('missing square');
            expect(rect.x >= 0 && rect.x + rect.width <= width).toBe(true);
            expect(rect.y >= 0 && rect.y + rect.height <= height).toBe(true);
            expect(
              hitTest(layout, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }),
            ).toStrictEqual(target);
          }
        },
      ),
      { seed: 20, numRuns: 150 },
    );
  });

  it.each(SIZES)('gives the 8 × 8 floor squares of at least 44 pt on a $name', (size) => {
    const layout = layoutBoard({ ...size, view: view(8), isMirrored: false });
    expect((layout.regions[0]?.cell ?? 0) >= size.cell).toBe(true);
  });

  it('gives a 375 × 667 pt phone the largest whole square its width allows', () => {
    const layout = layoutBoard({ ...SMALL_PHONE, view: view(8), isMirrored: false });
    expect(layout.regions[0]?.cell).toBe(42);
  });

  it('mirrors positions (not pixels) if a host ever asks for a mirrored layout', () => {
    const layout = layoutBoard({ width: 400, height: 400, view: view(4), isMirrored: true });
    const first = cellRect(layout, { regionId: 'board', col: 0, row: 0 });
    expect(first === null ? 0 : first.x + first.width).toBeGreaterThan(300);
  });
});
