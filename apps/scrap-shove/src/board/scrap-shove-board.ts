// apps/scrap-shove/src/board/scrap-shove-board.ts
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { ScrapShoveView } from './to-view.ts';
import type { ScrapShoveMove, ScrapShoveState } from '@e07/scrap-shove/rules/scrap-shove-types.ts';
import type { GameBoard, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

/** Unit-size (0…1) shapes, built ONCE per kit with the immutable path API (Skia 2.6+). */
function buildPaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  // The next-step arrow points east; draw turns it toward the robot's step.
  const arrow = skia.PathBuilder.Make()
    .moveTo(1, 0.5)
    .lineTo(0.35, 0.05)
    .lineTo(0.35, 0.32)
    .lineTo(0, 0.32)
    .lineTo(0, 0.68)
    .lineTo(0.35, 0.68)
    .lineTo(0.35, 0.95)
    .close()
    .build();
  // A fast robot's fins, one on each side of its head: the shape that sets fast robots apart.
  const finWest = skia.PathBuilder.Make()
    .moveTo(1, 0.1)
    .lineTo(0, 0.5)
    .lineTo(1, 0.9)
    .close()
    .build();
  const finEast = skia.PathBuilder.Make()
    .moveTo(0, 0.1)
    .lineTo(1, 0.5)
    .lineTo(0, 0.9)
    .close()
    .build();
  return { arrow, finWest, finEast };
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const scrapShoveBoard: GameBoard<
  ScrapShoveState,
  ScrapShoveView,
  BoardToken,
  ScrapShoveMove
> = {
  // A floor is a physical space: it never mirrors in fa and ckb (spec 7.5).
  isMirroredInRtl: false,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths,
  describe: (view) => ({
    id: 'scrap-shove.board.summary',
    values: { robotsCount: view.robots.length, heapsCount: view.heaps.length },
  }),
  // A step or shove is a tap on the square it goes to; a wait is a tap on the player.
  targetsOfMove: (state, move) => {
    const cell = move.kind === 'wait' ? state.player : move;
    return [{ regionId: 'board', col: cell.col, row: cell.row }];
  },
};
