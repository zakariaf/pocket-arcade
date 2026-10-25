// apps/trail-clear/src/board/trail-clear-board.ts
import { distinctTurns } from '@e07/trail-clear/rules/tiles.ts';

import { drawBoard } from './draw-board.ts';
import { DRAG_LIFT_PT, layoutBoard, traySlotTarget, trayTargetRect } from './layout-board.ts';
import { buildTilePaths } from './tile-paths.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { TrailClearView } from './to-view.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { GameBoard } from '@e07/shell/game-host/board-types.ts';
import type { TrailClearMove, TrailClearState } from '@e07/trail-clear/rules/trail-clear-types.ts';

/** One step towards each side (north, east, south, west) as a column and a row change. */
const STEPS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

/** The cell beyond `side` of `index` on the board, or -1 off the board. */
function neighbour(view: TrailClearView, index: number, side: number): number {
  const { size } = view;
  const [dx, dy] = STEPS[side] ?? [0, 0];
  const col = (index % size) + dx;
  const row = Math.floor(index / size) + dy;
  return col < 0 || row < 0 || col >= size || row >= size ? -1 : row * size + col;
}

/** Road and river edges that face an empty cell: where a loop can still grow or close. */
function looseEnds(view: TrailClearView): number {
  let count = 0;
  view.cells.forEach((edges, index) => {
    edges.forEach((edge, side) => {
      const next = neighbour(view, index, side);
      if (edge !== 0 && next >= 0 && view.cells[next]?.length === 0) count += 1;
    });
  });
  return count;
}

/** The hinted or coached move: the tray slot of its turn and the cell it places on. */
function targetsOfMove(state: TrailClearState, move: TrailClearMove): readonly BoardTarget[] {
  const slot = state.offered === null ? -1 : distinctTurns(state.offered).indexOf(move.turns);
  if (slot < 0) return [];
  return [traySlotTarget(slot), { regionId: 'board', col: move.col, row: move.row }];
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const trailClearBoard: GameBoard<
  TrailClearState,
  TrailClearView,
  BoardToken,
  TrailClearMove
> = {
  // Spec 7.5: a board is a physical space; it never mirrors in fa and ckb.
  isMirroredInRtl: false,
  // The ghost of a dragged tile floats this far above the finger (applied by the gesture layer).
  dragLiftPt: DRAG_LIFT_PT,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths: buildTilePaths,
  describe: (view) => ({
    id: 'trail-clear.board.summary',
    values: {
      tilesCount: view.cells.filter((edges) => edges.length > 0).length,
      looseEndsCount: looseEnds(view),
    },
  }),
  targetsOfMove,
  // A tray target names its slot; the layout says where that slot is (a row or a column).
  targetRect: trayTargetRect,
};
