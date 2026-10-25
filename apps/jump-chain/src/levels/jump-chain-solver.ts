// apps/jump-chain/src/levels/jump-chain-solver.ts
// Jump Chain's levels hold many enemies and branching king chains, so no exact search fits within a
// small budget. Winnability is proven by a witness instead: the game's reasonable player (the
// greedy bot on evaluateJumpChain) plays the level from a fixed bot seed, and its winning line is
// the proof; levelsContractProblems replays it through the real engine. par is that line's length,
// used only to reject levels the witness wins too quickly: Jump Chain levels are rated by score,
// and par is never shown.
import { createWitnessSolver } from '@e07/game-kit/levels/witness-solver.ts';
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/jump-chain/rules/apply-move.ts';
import { evaluateJumpChain } from '@e07/jump-chain/rules/jump-chain-evaluate.ts';
import { listMoves } from '@e07/jump-chain/rules/list-moves.ts';
import { outcome } from '@e07/jump-chain/rules/outcome.ts';

import type { Solver } from '@e07/game-kit/contract/levels.ts';
import type { JumpChainMove, JumpChainState } from '@e07/jump-chain/rules/jump-chain-types.ts';

const RULES = { listMoves, applyMove, outcome };

/** The witness bot's own RNG seed (ties only); fixed forever, or every level table changes. */
export const WITNESS_BOT_SEED = 0x2c1b3c6d;
/** Legal moves the witness may be shown per level: far above a whole won level (a few hundred). */
export const WITNESS_MAX_NODES = 20_000;

/** levels.solver: the greedy bot's win is "solved"; a loss is only over budget, never unsolvable. */
export const JUMP_CHAIN_SOLVER: Solver<JumpChainState, JumpChainMove> = createWitnessSolver({
  rules: RULES,
  policy: greedyPolicy(RULES, evaluateJumpChain),
  botSeed: WITNESS_BOT_SEED,
});
