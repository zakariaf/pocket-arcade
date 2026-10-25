// apps/jump-chain/src/board/jump-chain-board.ts
import { drawBoard } from './draw-board.ts';
import { DRAG_LIFT_PT, layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { JumpChainView } from './to-view.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { JumpChainMove, JumpChainState } from '@e07/jump-chain/rules/jump-chain-types.ts';
import type { GameBoard, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

/** Unit-size (0…1) shapes, built ONCE per kit with the immutable path API (Skia 2.6+). */
function buildPaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  // Your piece's crown: it is a king, so it jumps every way (and differs from an enemy by shape).
  const crown = skia.PathBuilder.Make()
    .moveTo(0.1, 0.8)
    .lineTo(0.1, 0.3)
    .lineTo(0.32, 0.52)
    .lineTo(0.5, 0.16)
    .lineTo(0.68, 0.52)
    .lineTo(0.9, 0.3)
    .lineTo(0.9, 0.8)
    .close()
    .build();
  return { crown };
}

/** The landing squares of a move (a hinted move's rings). */
function targetsOfMove(_state: JumpChainState, move: JumpChainMove): readonly BoardTarget[] {
  const squares = move.kind === 'step' ? [move.to] : move.path;
  return squares.map((square) => ({ regionId: 'board', col: square.col, row: square.row }));
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const jumpChainBoard: GameBoard<JumpChainState, JumpChainView, BoardToken, JumpChainMove> = {
  // A board is a physical space: it never mirrors in fa and ckb (spec 7.5).
  isMirroredInRtl: false,
  // S13: the Toybox checker illustration is drawn in a 320 x 222 viewBox, taller than the default.
  exampleAspect: 320 / 222,
  // The ghost of the dragged piece floats this far above the finger (applied by the gesture layer).
  dragLiftPt: DRAG_LIFT_PT,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths,
  describe: (view) => ({
    id: 'jump-chain.board.summary',
    values: { enemiesCount: view.enemiesLeft, marchCount: view.marchIn },
  }),
  targetsOfMove,
};
