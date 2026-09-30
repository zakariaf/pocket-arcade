// apps/demo-grid/src/board/demo-grid-board.ts

import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { DemoGridView } from './to-view.ts';
import type { DemoGridState } from '@e07/demo-grid/rules/demo-grid-types.ts';
import type { GameBoard, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

/** Unit-size (0…1) shapes, built ONCE per kit with the immutable path API (Skia 2.6+). */
function buildPaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  const piece = skia.Path.Make();
  piece.addCircle(0.5, 0.5, 0.4);
  return { piece };
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const demoGridBoard: GameBoard<DemoGridState, DemoGridView, BoardToken> = {
  isMirroredInRtl: false,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths,
  describe: (view) => ({
    id: 'demo-grid.board.summary',
    values: {
      piecesCount: view.pieces.length,
      filledCount: view.cells.filter((cell) => cell !== 0).length,
    },
  }),
};
