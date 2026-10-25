// apps/merge-siege/src/board/merge-siege-board.ts
import { ENEMY_KIND, TILE_KIND } from './board-ids.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { MergeSiegeView } from './to-view.ts';
import type { MergeSiegeMove, MergeSiegeState } from '@e07/merge-siege/rules/merge-siege-types.ts';
import type { GameBoard, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

/**
 * cos and sin of the 16 steps of 22.5 degrees, committed (no transcendental Math): the enemy's
 * outline alternates a spike tip and a notch on each step, eight spikes around its body.
 */
const STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0.92388, 0.38268],
  [0.70711, 0.70711],
  [0.38268, 0.92388],
  [0, 1],
  [-0.38268, 0.92388],
  [-0.70711, 0.70711],
  [-0.92388, 0.38268],
  [-1, 0],
  [-0.92388, -0.38268],
  [-0.70711, -0.70711],
  [-0.38268, -0.92388],
  [0, -1],
  [0.38268, -0.92388],
  [0.70711, -0.70711],
  [0.92388, -0.38268],
];
const TIP = 0.5;
const NOTCH = 0.37;

/** Unit-size (0…1) shapes, built ONCE per kit with the immutable path API (Skia 2.6+). */
function buildPaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  // An enemy is spiky and a tile square, so the two differ by shape in every palette.
  const builder = skia.PathBuilder.Make();
  STEPS.forEach(([cos, sin], index) => {
    const radius = index % 2 === 0 ? TIP : NOTCH;
    const x = 0.5 + radius * cos;
    const y = 0.5 + radius * sin;
    if (index === 0) builder.moveTo(x, y);
    else builder.lineTo(x, y);
  });
  return { enemy: builder.close().build() };
}

/** The spoken summary's numbers: tiles, the biggest tile (0 when none) and enemies on the board. */
function describe(view: MergeSiegeView): { id: string; values: Record<string, number> } {
  const tiles = view.pieces.filter((piece) => piece.kind === TILE_KIND);
  return {
    id: 'merge-siege.board.summary',
    values: {
      tiles: tiles.length,
      biggest: tiles.reduce((biggest, tile) => Math.max(biggest, tile.value), 0),
      enemies: view.pieces.filter((piece) => piece.kind === ENEMY_KIND).length,
    },
  };
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const mergeSiegeBoard: GameBoard<
  MergeSiegeState,
  MergeSiegeView,
  BoardToken,
  MergeSiegeMove
> = {
  // Spec 7.5: a board is a physical space; a swipe right moves tiles right in every language.
  isMirroredInRtl: false,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths,
  describe,
};
