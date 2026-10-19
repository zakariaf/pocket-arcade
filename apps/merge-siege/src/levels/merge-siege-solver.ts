// apps/merge-siege/src/levels/merge-siege-solver.ts
// Merge Siege draws new tiles and enemies during play, so no exact search fits (thirty cells and a
// seeded future: far too many states). Winnability is proven by a witness instead: the game's
// reasonable player (the greedy bot on evaluateMergeSiege) plays the level from a fixed bot seed,
// and its winning line is the proof; levelsContractProblems replays it through the real engine.
// par is that line's length, used only to reject levels the witness wins too quickly: Merge Siege
// levels are rated by score, and par is never shown.
import { createWitnessSolver } from '@e07/game-kit/levels/witness-solver.ts';
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/merge-siege/rules/apply-move.ts';
import { listMoves } from '@e07/merge-siege/rules/list-moves.ts';
import { evaluateMergeSiege } from '@e07/merge-siege/rules/merge-siege-evaluate.ts';
import { outcome } from '@e07/merge-siege/rules/outcome.ts';

import type { Solver } from '@e07/game-kit/contract/levels.ts';
import type { MergeSiegeMove, MergeSiegeState } from '@e07/merge-siege/rules/merge-siege-types.ts';

const RULES = { listMoves, applyMove, outcome };

/** The witness bot's own RNG seed (ties only); fixed forever, or every level table changes. */
export const WITNESS_BOT_SEED = 0x5bd1e995;
/** Legal moves the witness may be shown per level: far above a whole won level (about 100). */
export const WITNESS_MAX_NODES = 5_000;

/** levels.solver: the greedy bot's win is "solved"; a loss is only over budget, never unsolvable. */
export const MERGE_SIEGE_SOLVER: Solver<MergeSiegeState, MergeSiegeMove> = createWitnessSolver({
  rules: RULES,
  policy: greedyPolicy(RULES, evaluateMergeSiege),
  botSeed: WITNESS_BOT_SEED,
});
