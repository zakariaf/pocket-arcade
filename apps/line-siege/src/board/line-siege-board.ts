// apps/line-siege/src/board/line-siege-board.ts
import { pieceAt } from '@e07/line-siege/rules/pieces.ts';

import { drawBoard } from './draw-board.ts';
import { DRAG_LIFT_PT, layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { LineSiegeView } from './to-view.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { LineSiegeMove, LineSiegeState } from '@e07/line-siege/rules/line-siege-types.ts';
import type { GameBoard, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

/** Unit-size (0…1) shapes, built ONCE per kit with the immutable path API (Skia 2.6+). */
function buildPaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  // The fast monster's speed mark: a chevron pointing at the wall.
  const arrow = skia.PathBuilder.Make()
    .moveTo(0.2, 0)
    .lineTo(0.5, 0.6)
    .lineTo(0.8, 0)
    .lineTo(0.65, 0)
    .lineTo(0.5, 0.3)
    .lineTo(0.35, 0)
    .close()
    .build();
  // A heart for the wall: filled while kept, an outline once lost.
  const heart = skia.PathBuilder.Make()
    .moveTo(0.5, 0.92)
    .cubicTo(0.1, 0.62, 0, 0.42, 0.06, 0.26)
    .cubicTo(0.14, 0.06, 0.4, 0.04, 0.5, 0.24)
    .cubicTo(0.6, 0.04, 0.86, 0.06, 0.94, 0.26)
    .cubicTo(1, 0.42, 0.9, 0.62, 0.5, 0.92)
    .close()
    .build();
  return { arrow, heart };
}

/** The hinted move's tray slot and the board cells its block would cover. */
function targetsOfMove(state: LineSiegeState, move: LineSiegeMove): readonly BoardTarget[] {
  const piece = state.tray[move.trayIndex];
  if (piece === undefined || piece === null) return [];
  const cells = pieceAt(piece).map(([dx, dy]) => ({
    regionId: 'board',
    col: move.col + dx,
    row: move.row + dy,
  }));
  return [{ regionId: 'tray', col: move.trayIndex, row: 0 }, ...cells];
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const lineSiegeBoard: GameBoard<LineSiegeState, LineSiegeView, BoardToken, LineSiegeMove> = {
  isMirroredInRtl: false,
  // The ghost of a dragged block floats this far above the finger (applied by the gesture layer).
  dragLiftPt: DRAG_LIFT_PT,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths,
  describe: (view) => ({
    id: 'line-siege.board.summary',
    values: { monstersCount: view.monsters.length, heartsCount: view.hearts },
  }),
  targetsOfMove,
};
