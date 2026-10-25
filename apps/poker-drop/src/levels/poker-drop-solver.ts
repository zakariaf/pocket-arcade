// apps/poker-drop/src/levels/poker-drop-solver.ts
// The level table's solver is the rules' witness (rules/poker-drop-witness.ts): the greedy bot on
// evaluatePokerDrop from a fixed bot seed; levelsContractProblems replays its winning line through
// the real engine. par is that line's length, used only to reject levels the witness wins too
// quickly: Poker Drop levels are rated by score, and par is never shown.
import { POKER_DROP_WITNESS, WITNESS_MAX_NODES } from '@e07/poker-drop/rules/poker-drop-witness.ts';

import type { Solver } from '@e07/game-kit/contract/levels.ts';
import type { PokerDropMove, PokerDropState } from '@e07/poker-drop/rules/poker-drop-types.ts';

export { WITNESS_MAX_NODES };

/** levels.solver: the greedy bot's win is "solved"; a loss is only over budget, never unsolvable. */
export const POKER_DROP_SOLVER: Solver<PokerDropState, PokerDropMove> = POKER_DROP_WITNESS;
