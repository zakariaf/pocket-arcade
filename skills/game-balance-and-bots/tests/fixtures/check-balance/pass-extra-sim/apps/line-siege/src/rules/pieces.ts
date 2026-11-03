// apps/line-siege/src/rules/pieces.ts
// Spec 13 (line-siege) v1 content: "about 10 block shapes". Offsets are [dx, dy] from the anchor,
// the top-start cell of the shape; rotation is not a move (the tray offers each shape as drawn).
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import type { Piece } from './line-siege-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

export const PIECES: readonly Piece[] = [
  [[0, 0]],
  [
    [0, 0],
    [1, 0],
  ],
  [
    [0, 0],
    [0, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
];

/** The single block: it always fits, because a full row is always cleared at once. */
export const SINGLE_BLOCK = 0;
/** The two-cell bars the opening tray guarantees (they complete the prepared gaps). */
export const HORIZONTAL_TWO = 1;
export const VERTICAL_TWO = 2;
export const TRAY_SIZE = 3;

export function pieceAt(index: number): Piece {
  const piece = PIECES[index];
  if (piece === undefined) throw new RangeError(`no piece ${String(index)}`);
  return piece;
}

/** Three random pieces for an empty tray, drawn from the run's own stream. */
export function drawTray(rng: RngState): { readonly tray: number[]; readonly rng: RngState } {
  const tray: number[] = [];
  let state = rng;
  for (let slot = 0; slot < TRAY_SIZE; slot += 1) {
    const draw = nextInt(state, PIECES.length);
    tray.push(draw.value);
    state = draw.state;
  }
  return { tray, rng: state };
}
