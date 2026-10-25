// apps/snare-snake/src/board/layout-board.ts
'worklet';

import { fitGrid } from '@e07/game-kit/geom/board-layout.ts';

import type { SnareSnakeView } from './to-view.ts';
import type { BoardLayout, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { LayoutInput } from '@e07/shell/game-host/board-types.ts';

/** The canvas's own padding: small, so a phone's width still gives 8 columns of 44 pt or more. */
const PAD = 4;
/** The strip above the grid that holds the moves badge. */
export const BADGE_STRIP_PT = 36;

/** One 'board' grid region below the moves badge, the largest whole-pixel square cells that fit. */
export function layoutBoard(input: LayoutInput<SnareSnakeView>): BoardLayout {
  const box: Rect = {
    x: PAD,
    y: BADGE_STRIP_PT,
    width: input.width - 2 * PAD,
    height: input.height - BADGE_STRIP_PT - PAD,
  };
  return {
    width: input.width,
    height: input.height,
    isMirrored: input.isMirrored,
    regions: [{ id: 'board', ...fitGrid({ box, cols: input.view.cols, rows: input.view.rows }) }],
  };
}
