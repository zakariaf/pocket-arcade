// apps/stepstone/src/board/stepstone-board.ts
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { KIND_OF_CODE, toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { StepstoneView } from './to-view.ts';
import type { GameBoard, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { StepstoneMove, StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

/**
 * Unit-size (0…1) shapes, built ONCE per kit with the immutable path API (Skia 2.6+). Each hop kind
 * has its own glyph, so stones differ by shape as well as colour: a ring (king: one square any way),
 * a plus (rook: straight lines), a cross (bishop: diagonals), an L (knight). The flag and the frog's
 * dome complete the set.
 */
function buildPaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  const make = (): ReturnType<SkiaApi['PathBuilder']['Make']> => skia.PathBuilder.Make();
  return {
    king: skia.Path.Circle(0.5, 0.5, 0.38),
    rook: make().moveTo(0.5, 0.08).lineTo(0.5, 0.92).moveTo(0.08, 0.5).lineTo(0.92, 0.5).build(),
    bishop: make()
      .moveTo(0.16, 0.16)
      .lineTo(0.84, 0.84)
      .moveTo(0.84, 0.16)
      .lineTo(0.16, 0.84)
      .build(),
    knight: make().moveTo(0.3, 0.1).lineTo(0.3, 0.86).lineTo(0.78, 0.86).build(),
    flag: make().moveTo(0.3, 0.92).lineTo(0.3, 0.08).lineTo(0.84, 0.28).lineTo(0.3, 0.48).build(),
    frog: make()
      .moveTo(0.04, 0.92)
      .cubicTo(0.04, 0.4, 0.26, 0.18, 0.5, 0.18)
      .cubicTo(0.74, 0.18, 0.96, 0.4, 0.96, 0.92)
      .close()
      .build(),
  };
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const stepstoneBoard: GameBoard<StepstoneState, StepstoneView, BoardToken, StepstoneMove> = {
  isMirroredInRtl: false,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths,
  // VoiceOver: the pond's size, the frog's hop kind and how many stones it reaches (spec 8.11).
  describe: (view) => ({
    id: 'stepstone.board.summary',
    values: {
      side: view.side,
      hop: pickAt(KIND_OF_CODE, pickAt(view.cells, view.frog)),
      reachCount: view.reach.length,
    },
  }),
  // The hinted hop is one stone; the host rings it (frame.highlight.hinted).
  targetsOfMove: (state, move) => [
    { regionId: 'board', col: move.to % state.side, row: Math.floor(move.to / state.side) },
  ],
};
