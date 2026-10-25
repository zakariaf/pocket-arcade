// apps/merge-siege/src/board/layout-board.ts
'worklet';

import { fitGrid } from '@e07/game-kit/geom/board-layout.ts';

import type { MergeSiegeView } from './to-view.ts';
import type { BoardLayout, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { LayoutInput } from '@e07/shell/game-host/board-types.ts';

const PAD = 8;
/** The gate: one row above the board where the next enemy waits (and a tap slides tiles up). */
const GATE_ROWS = 1;

/**
 * Two regions on one grid of the largest whole-pixel square cells that fit: the 'gate' row and,
 * right below it, the 'board'. Any canvas size works. Board row -1 is the gate row, so a piece
 * entering from the gate is drawn by the board's own cellRect.
 */
export function layoutBoard(input: LayoutInput<MergeSiegeView>): BoardLayout {
  const box: Rect = {
    x: PAD,
    y: PAD,
    width: input.width - 2 * PAD,
    height: input.height - 2 * PAD,
  };
  const { cols, rows } = input.view;
  const grid = fitGrid({ box, cols, rows: rows + GATE_ROWS });
  return {
    width: input.width,
    height: input.height,
    isMirrored: input.isMirrored,
    regions: [
      { id: 'gate', ...grid, rows: GATE_ROWS },
      { id: 'board', ...grid, y: grid.y + GATE_ROWS * grid.cell, rows },
    ],
  };
}
