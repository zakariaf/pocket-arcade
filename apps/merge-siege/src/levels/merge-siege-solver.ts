// apps/merge-siege/src/levels/merge-siege-solver.ts
// The level table's solver is the rules' witness (rules/merge-siege-witness.ts): the greedy bot on
// evaluateMergeSiege from a fixed bot seed; levelsContractProblems replays its winning line through
// the real engine. par is that line's length, used only to reject levels the witness wins too
// quickly: Merge Siege levels are rated by score, and par is never shown.
import {
  MERGE_SIEGE_WITNESS,
  WITNESS_MAX_NODES,
} from '@e07/merge-siege/rules/merge-siege-witness.ts';

import type { Solver } from '@e07/game-kit/contract/levels.ts';
import type { MergeSiegeMove, MergeSiegeState } from '@e07/merge-siege/rules/merge-siege-types.ts';

export { WITNESS_MAX_NODES };

/** levels.solver: the greedy bot's win is "solved"; a loss is only over budget, never unsolvable. */
export const MERGE_SIEGE_SOLVER: Solver<MergeSiegeState, MergeSiegeMove> = MERGE_SIEGE_WITNESS;
