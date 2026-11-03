// apps/jump-chain/src/rules/tutorial-board.ts
// Spec S13: the tutorial's board. It lives with the rules because a saved tutorial run is read
// back by them (jump-chain-persistence.ts accepts its ranks), and the teaching module builds its
// script and its how-to-play pages on the same positions.
import { createLayout } from './create.ts';

import type { JumpChainState, Square } from './jump-chain-types.ts';

/**
 * Seed 1's own level-0 layout, the board create(1, 0) hands out too (the witness wins it; the
 * teaching test pins that), laid without the witness so loading the teaching stays cheap.
 */
const LEVEL_0 = createLayout(1, 0);

/** A level-0 position with your piece and these enemies, given as [col, row, rank]. */
export function tutorialPosition(
  piece: Square,
  enemySquares: readonly (readonly [number, number, number])[],
): JumpChainState {
  const enemies = enemySquares.map(([col, row, rank], id) => ({ id, rank, col, row }));
  const ranks = new Set(enemies.map((enemy) => enemy.rank)).size;
  return {
    ...LEVEL_0,
    piece,
    enemies,
    total: enemies.length,
    nextId: enemies.length,
    nextRank: ranks,
    marchIn: 3,
  };
}

/** Two enemies of the front rank stacked on the left, one more waiting above the board. */
export const TUTORIAL_START = tutorialPosition({ col: 3, row: 7 }, [
  [1, 5, 0],
  [1, 3, 0],
  [3, -1, 1],
]);
