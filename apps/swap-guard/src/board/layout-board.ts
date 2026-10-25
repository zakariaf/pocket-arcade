// apps/swap-guard/src/board/layout-board.ts
'worklet';

import { fitGrid } from '@e07/game-kit/geom/board-layout.ts';

import type { SwapGuardView } from './to-view.ts';
import type { BoardLayout, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { LayoutInput } from '@e07/shell/game-host/board-types.ts';

/** The canvas's own padding: small, so a small phone's width still gives 6 squares of 44 pt. */
const PAD = 4;
/** The strip above the grid that holds the swap pips and the swaps badge. */
export const BADGE_STRIP_PT = 36;

/** One square 'board' grid region below the swaps strip, the largest whole-pixel squares that fit. */
export function layoutBoard(input: LayoutInput<SwapGuardView>): BoardLayout {
  const box: Rect = {
    x: PAD,
    y: BADGE_STRIP_PT,
    width: input.width - 2 * PAD,
    height: input.height - BADGE_STRIP_PT - PAD,
  };
  const { size } = input.view;
  return {
    width: input.width,
    height: input.height,
    isMirrored: input.isMirrored,
    regions: [{ id: 'board', ...fitGrid({ box, cols: size, rows: size }) }],
  };
}
