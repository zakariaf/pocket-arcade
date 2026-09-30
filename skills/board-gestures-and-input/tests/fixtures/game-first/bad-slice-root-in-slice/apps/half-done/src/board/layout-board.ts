// apps/half-done/src/board/layout-board.ts
'worklet';

import { fitGrid } from '@e07/game-kit/geom/board-layout.ts';

import type { TapFlipView } from './to-view.ts';
import type { BoardLayout, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { LayoutInput } from '@e07/shell/game-host/board-types.ts';

const PAD = 8;

/** One 'board' grid region, the largest whole-pixel square cells that fit. Any canvas size works. */
export function layoutBoard(input: LayoutInput<TapFlipView>): BoardLayout {
  const box: Rect = {
    x: PAD,
    y: PAD,
    width: input.width - 2 * PAD,
    height: input.height - 2 * PAD,
  };
  return {
    width: input.width,
    height: input.height,
    isMirrored: input.isMirrored,
    regions: [{ id: 'board', ...fitGrid({ box, cols: input.view.cols, rows: input.view.rows }) }],
  };
}
