// apps/jump-chain/src/rules/jump-chain-evaluate.ts
// How good a Jump Chain position looks to a reasonable player. Lives in rules/ because both the
// bots (testing/) and the level witness (levels/) play with it, and levels may import only rules.
// A player values captures and long chains (the score), fears the enemies closest to their side
// (the fewer marches they need, the worse), and lands where the next jump is ready: next to an
// enemy, near the front of the ranks.
import { SIDE_ROW } from './board-squares.ts';
import { TUNING } from './jump-chain-tuning.ts';

import type { Enemy, JumpChainState } from './jump-chain-types.ts';

/** Weights of the evaluation: a capture is worth most, the score breaks ties between chains. */
const CAPTURE_WEIGHT = 40;
const SCORE_WEIGHT = 1;
/** What an enemy costs by the marches it still needs to reach your side (index 0: one march). */
const DANGER_BY_MARCHES = [120, 40, 12, 4, 1];
/** What each square between your piece and the nearest enemy on the board costs. */
const DISTANCE_WEIGHT = 6;

/** Marches an enemy needs to reach your side (at least 1 while it is on its way). */
function marchesLeft(enemy: Enemy): number {
  return Math.max(1, (SIDE_ROW - enemy.row) / TUNING.marchRows);
}

/** The danger of one enemy: the closer to your side in marches, the more it costs. */
function dangerOf(enemy: Enemy): number {
  const index = Math.min(marchesLeft(enemy), DANGER_BY_MARCHES.length) - 1;
  return DANGER_BY_MARCHES.reduce((picked, cost, at) => (at === index ? cost : picked), 0);
}

/** Chebyshev distance from the piece to the nearest enemy on the board (0 with none there). */
function distanceToNearest(state: JumpChainState): number {
  const onBoard = state.enemies.filter((enemy) => enemy.row >= 0);
  if (onBoard.length === 0) return 0;
  return Math.min(
    ...onBoard.map((enemy) =>
      Math.max(Math.abs(enemy.col - state.piece.col), Math.abs(enemy.row - state.piece.row)),
    ),
  );
}

/** How good a position looks to the bots (higher is better). */
export function evaluateJumpChain(state: JumpChainState): number {
  const danger = state.enemies.reduce((sum, enemy) => sum + dangerOf(enemy), 0);
  return (
    state.captured * CAPTURE_WEIGHT +
    state.score * SCORE_WEIGHT -
    danger -
    distanceToNearest(state) * DISTANCE_WEIGHT
  );
}
