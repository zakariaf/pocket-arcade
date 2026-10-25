// apps/flock-tilt/src/board/layout-board.test.ts
import fc from 'fast-check';

import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';

import { FENCE_SHARE, FIELD_REGION, TILT_KEY_REGIONS } from './board-ids.ts';
import { layoutBoard } from './layout-board.ts';

import type { FlockTiltView } from './to-view.ts';
import type { Direction } from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { BoardLayout, Rect } from '@e07/game-kit/geom/board-layout.ts';

const VIEW: FlockTiltView = {
  cols: 7,
  rows: 7,
  rocks: [],
  pen: 0,
  sheep: [],
  wolves: [],
  pennedText: '0',
  pennedCount: 0,
};

const KEYS = Object.values(TILT_KEY_REGIONS);

function isInside(rect: Rect, width: number, height: number): boolean {
  return (
    rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height
  );
}

function centreOf(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Every field cell and every key: inside the canvas, and its centre hit-tests back to it. */
function layoutProblems(layout: BoardLayout): string[] {
  const targets = [
    ...Array.from({ length: 49 }, (_, cell) => ({
      regionId: FIELD_REGION,
      col: cell % 7,
      row: Math.floor(cell / 7),
    })),
    ...KEYS.map((regionId) => ({ regionId, col: 0, row: 0 })),
  ];
  return targets
    .flatMap((target) => {
      const rect = cellRect(layout, target);
      if (rect === null) return [`${target.regionId} missing`];
      const isOut = !isInside(rect, layout.width, layout.height);
      const hit = hitTest(layout, centreOf(rect));
      const isOther = JSON.stringify(hit) !== JSON.stringify(target);
      return [isOut ? `${target.regionId} outside` : '', isOther ? `${target.regionId} hit` : ''];
    })
    .filter((problem) => problem !== '');
}

/** A cell's rectangle (col only: row 0 for keys, the last row for the field). */
function rectOf(layout: BoardLayout, regionId: string, cell: number): Rect {
  const rect = cellRect(layout, { regionId, col: cell, row: cell });
  if (rect === null) throw new Error(`no ${regionId}`);
  return rect;
}

function keyRect(layout: BoardLayout, direction: Direction): Rect {
  return rectOf(layout, TILT_KEY_REGIONS[direction], 0);
}

describe('layoutBoard', () => {
  it('keeps the field and the four tilt keys inside the canvas, each hit-testing to itself', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 240, max: 2732 }),
        fc.integer({ min: 240, max: 2732 }),
        (width, height) => {
          const layout = layoutBoard({ width, height, view: VIEW, isMirrored: false });
          expect(layoutProblems(layout)).toStrictEqual([]);
        },
      ),
      { seed: 17, numRuns: 150 },
    );
  });

  it('keeps room for the fence around the field at any size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 240, max: 2732 }),
        fc.integer({ min: 240, max: 2732 }),
        (width, height) => {
          const layout = layoutBoard({ width, height, view: VIEW, isMirrored: false });
          const first = rectOf(layout, FIELD_REGION, 0);
          const fence = Math.ceil(first.width * FENCE_SHARE);
          const outer = {
            x: first.x - fence,
            y: first.y - fence,
            width: 7 * first.width + 2 * fence,
            height: 7 * first.width + 2 * fence,
          };
          expect(isInside(outer, width, height)).toBe(true);
        },
      ),
      { seed: 23, numRuns: 100 },
    );
  });

  it('puts the tilt keys below the field on a phone and beside it on a wide screen', () => {
    const phone = layoutBoard({ width: 374, height: 660, view: VIEW, isMirrored: false });
    const field = rectOf(phone, FIELD_REGION, 6);
    expect(keyRect(phone, 'down').y).toBeGreaterThanOrEqual(field.y + field.height);
    const tablet = layoutBoard({ width: 1024, height: 700, view: VIEW, isMirrored: false });
    const lastCol = rectOf(tablet, FIELD_REGION, 6);
    expect(keyRect(tablet, 'left').x).toBeGreaterThanOrEqual(lastCol.x + lastCol.width);
  });

  it('places each key on its own side: up above down, left left of right (physical)', () => {
    const layout = layoutBoard({ width: 374, height: 660, view: VIEW, isMirrored: false });
    expect(keyRect(layout, 'up').y).toBeLessThan(keyRect(layout, 'down').y);
    expect(keyRect(layout, 'left').x).toBeLessThan(keyRect(layout, 'right').x);
  });

  it('gives field cells and keys at least 44 pt on a 402 x 874 pt phone (spec 8.11)', () => {
    const layout = layoutBoard({ width: 374, height: 660, view: VIEW, isMirrored: false });
    expect(Math.min(...layout.regions.map((region) => region.cell))).toBeGreaterThanOrEqual(44);
  });
});
