// apps/jump-chain/src/board/layout-board.ts
'worklet';

import { fitGrid } from '@e07/game-kit/geom/board-layout.ts';

import type { JumpChainView } from './to-view.ts';
import type { BoardLayout, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { LayoutInput } from '@e07/shell/game-host/board-types.ts';

/** Inner padding of the canvas (S5 already sets the board 14 pt from the screen's sides). */
const PAD = 4;
/** Half a square above the board shows the rank waiting to come in (row -1). */
export const PEEK_CELLS = 0.5;
/**
 * A dragged piece's ghost (and its drop square) sits this many points above the finger, so the
 * thumb does not hide it. The gesture layer applies it (GameBoard.dragLiftPt); this layout keeps
 * this much canvas free below the last row, so your side's row stays reachable.
 */
export const DRAG_LIFT_PT = 40;

/**
 * The peek band, then the 7 x 10 board, the largest whole-pixel squares that fit above the lift
 * strip, centred. Only the board is a tappable region. Any canvas size works.
 */
export function layoutBoard(input: LayoutInput<JumpChainView>): BoardLayout {
  const { view } = input;
  const box: Rect = {
    x: PAD,
    y: PAD,
    width: input.width - 2 * PAD,
    height: input.height - 2 * PAD - DRAG_LIFT_PT,
  };
  const stack = fitGrid({ box, cols: view.cols, rows: view.rows + PEEK_CELLS });
  const board = {
    id: 'board',
    ...stack,
    y: Math.ceil(stack.y + PEEK_CELLS * stack.cell),
    rows: view.rows,
  };
  return {
    width: input.width,
    height: input.height,
    isMirrored: input.isMirrored,
    regions: [board],
  };
}
