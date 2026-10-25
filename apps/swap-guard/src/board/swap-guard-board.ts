// apps/swap-guard/src/board/swap-guard-board.ts
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { SwapGuardView } from './to-view.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { GameBoard, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SwapGuardMove, SwapGuardState } from '@e07/swap-guard/rules/swap-guard-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

/** Unit-size (0..1) shapes pointing up, built ONCE per kit with the immutable path API. */
function buildPaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  // The arrow of a strike's way (and of an enemy's facing).
  const chevron = skia.PathBuilder.Make()
    .moveTo(0.5, 0.05)
    .lineTo(0.95, 0.6)
    .lineTo(0.68, 0.6)
    .lineTo(0.68, 0.95)
    .lineTo(0.32, 0.95)
    .lineTo(0.32, 0.6)
    .lineTo(0.05, 0.6)
    .close()
    .build();
  // A spear: a triangle pointing where it strikes.
  const spear = skia.PathBuilder.Make()
    .moveTo(0.5, 0)
    .lineTo(1, 0.95)
    .lineTo(0, 0.95)
    .close()
    .build();
  // An archer: a diamond.
  const archer = skia.PathBuilder.Make()
    .moveTo(0.5, 0)
    .lineTo(1, 0.5)
    .lineTo(0.5, 1)
    .lineTo(0, 0.5)
    .close()
    .build();
  // The guard's crest: a shield.
  const shield = skia.PathBuilder.Make()
    .moveTo(0.1, 0.08)
    .lineTo(0.9, 0.08)
    .lineTo(0.9, 0.5)
    .quadTo(0.9, 0.85, 0.5, 1)
    .quadTo(0.1, 0.85, 0.1, 0.5)
    .close()
    .build();
  return { chevron, spear, archer, shield };
}

/** The square a swap goes to: the host rings it when that swap is the hint. */
function targetsOfMove(state: SwapGuardState, move: SwapGuardMove): readonly BoardTarget[] {
  return [
    { regionId: 'board', col: move.cell % state.size, row: Math.floor(move.cell / state.size) },
  ];
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const swapGuardBoard: GameBoard<SwapGuardState, SwapGuardView, BoardToken, SwapGuardMove> = {
  // A board is a physical space: it never mirrors in fa and ckb (spec 7.5).
  isMirroredInRtl: false,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths,
  describe: (view) => ({
    id: 'swap-guard.board.summary',
    values: { defeated: view.defeated, total: view.total, swapsLeft: view.swapsLeft },
  }),
  targetsOfMove,
};
