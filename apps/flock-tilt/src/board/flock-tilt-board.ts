// apps/flock-tilt/src/board/flock-tilt-board.ts
import { TILT_KEY_REGIONS } from './board-ids.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { FlockTiltView } from './to-view.ts';
import type { FlockTiltMove, FlockTiltState } from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { GameBoard, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

type Point = readonly [number, number];

/** A closed polygon at unit size (0..1). */
function polygon(skia: SkiaApi, points: readonly Point[]): SkPath {
  const [first, ...rest] = points;
  const builder = skia.PathBuilder.Make().moveTo(first?.[0] ?? 0, first?.[1] ?? 0);
  for (const [x, y] of rest) builder.lineTo(x, y);
  return builder.close().build();
}

/**
 * Unit-size (0..1) shapes, built ONCE per kit with the immutable path API (Skia 2.6+): a lumpy
 * boulder, the wolf's angular head with pointed ears, and the tilt keys' arrow (pointing up).
 */
function buildPaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  const rock = polygon(skia, [
    [0.22, 0.12],
    [0.62, 0.06],
    [0.9, 0.3],
    [0.96, 0.66],
    [0.74, 0.94],
    [0.3, 0.92],
    [0.06, 0.66],
    [0.08, 0.32],
  ]);
  const wolf = polygon(skia, [
    [0.08, 0.02],
    [0.36, 0.26],
    [0.64, 0.26],
    [0.92, 0.02],
    [0.94, 0.52],
    [0.66, 0.78],
    [0.5, 0.98],
    [0.34, 0.78],
    [0.06, 0.52],
  ]);
  const arrow = polygon(skia, [
    [0.5, 0.04],
    [0.94, 0.5],
    [0.66, 0.5],
    [0.66, 0.96],
    [0.34, 0.96],
    [0.34, 0.5],
    [0.06, 0.5],
  ]);
  return { rock, wolf, arrow };
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const flockTiltBoard: GameBoard<FlockTiltState, FlockTiltView, BoardToken, FlockTiltMove> = {
  // Spec 7.5: a board is a physical space; tilts are physical directions in every language.
  isMirroredInRtl: false,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths,
  describe: (view) => ({
    id: 'flock-tilt.board.summary',
    values: { penned: view.pennedCount, total: view.sheep.length, wolves: view.wolves.length },
  }),
  // The hinted tilt rings its key beside the field (frame.highlight.hinted).
  targetsOfMove: (_state, move) => [{ regionId: TILT_KEY_REGIONS[move.direction], col: 0, row: 0 }],
};
