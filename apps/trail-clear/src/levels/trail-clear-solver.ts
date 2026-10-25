// apps/trail-clear/src/levels/trail-clear-solver.ts
// levels.solver: the witness of rules/trail-clear-witness.ts (the one create() proves its boards
// with). par is its winning line's length (always the bag: a level is won by its last tile), never
// shown: Trail Clear levels are rated by score.
import {
  TRAIL_CLEAR_WITNESS,
  WITNESS_BOT_SEED,
  WITNESS_MAX_NODES,
} from '@e07/trail-clear/rules/trail-clear-witness.ts';

import type { Solver } from '@e07/game-kit/contract/levels.ts';
import type { TrailClearMove, TrailClearState } from '@e07/trail-clear/rules/trail-clear-types.ts';

export { WITNESS_BOT_SEED, WITNESS_MAX_NODES };

/** levels.solver: the greedy bot's win is "solved"; a loss is only over budget, never unsolvable. */
export const TRAIL_CLEAR_SOLVER: Solver<TrailClearState, TrailClearMove> = TRAIL_CLEAR_WITNESS;
