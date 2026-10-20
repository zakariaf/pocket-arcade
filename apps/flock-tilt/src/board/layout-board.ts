// apps/flock-tilt/src/board/layout-board.ts
'worklet';

import { fitGrid } from '@e07/game-kit/geom/board-layout.ts';

import { FENCE_SHARE, FIELD_REGION, TILT_KEY_REGIONS } from './board-ids.ts';

import type { FlockTiltView } from './to-view.ts';
import type { BoardLayout, GridRegion } from '@e07/game-kit/geom/board-layout.ts';
import type { LayoutInput } from '@e07/shell/game-host/board-types.ts';

const PAD = 8;
/** Space between the field and the tilt keys, in cells. */
const GAP = 0.25;

/** A point in canvas points. */
type At = { readonly x: number; readonly y: number };

/** A one-cell key region at a position. */
function key(id: string, at: At, cell: number): GridRegion {
  return { id, x: Math.floor(at.x), y: Math.floor(at.y), cell, cols: 1, rows: 1 };
}

/**
 * The four tilt keys as an arrow cluster: up on top, left, down and right below it, starting at
 * (x, y), the top-left corner of the 3 x 2 cell block.
 */
function keyCluster(corner: At, cell: number): GridRegion[] {
  const { x, y } = corner;
  return [
    key(TILT_KEY_REGIONS.up, { x: x + cell, y }, cell),
    key(TILT_KEY_REGIONS.left, { x, y: y + cell }, cell),
    key(TILT_KEY_REGIONS.down, { x: x + cell, y: y + cell }, cell),
    key(TILT_KEY_REGIONS.right, { x: x + 2 * cell, y: y + cell }, cell),
  ];
}

/**
 * The field, the largest whole-pixel square cells that fit, with the tilt keys below it (a phone
 * in portrait, within thumb reach) or beside it (a wide screen). Any canvas size works; the field
 * never mirrors (a physical space), so positions are the same in every language.
 */
export function layoutBoard(input: LayoutInput<FlockTiltView>): BoardLayout {
  const { cols, rows } = input.view;
  const box = { x: PAD, y: PAD, width: input.width - 2 * PAD, height: input.height - 2 * PAD };
  const isWide = box.width > box.height;
  // The fence frames the field on every side (FENCE_SHARE of a cell), so it is part of the fit.
  const fenced = { cols: cols + 2 * FENCE_SHARE, rows: rows + 2 * FENCE_SHARE };
  const units = isWide
    ? { cols: fenced.cols + GAP + 3, rows: fenced.rows }
    : { cols: fenced.cols, rows: fenced.rows + GAP + 2 };
  const fitted = fitGrid({ box, ...units });
  const { cell } = fitted;
  const fence = Math.ceil(FENCE_SHARE * cell);
  const x = fitted.x + fence;
  const y = fitted.y + fence;
  const field: GridRegion = { id: FIELD_REGION, x, y, cell, cols, rows };
  const gap = Math.round(GAP * cell) + fence;
  const keys = isWide
    ? keyCluster({ x: x + cols * cell + gap, y: y + (rows * cell) / 2 - cell }, cell)
    : keyCluster({ x: x + (cols * cell) / 2 - 1.5 * cell, y: y + rows * cell + gap }, cell);
  return {
    width: input.width,
    height: input.height,
    isMirrored: input.isMirrored,
    regions: [field, ...keys],
  };
}
