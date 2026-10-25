// apps/merge-siege/src/rules/merge-siege-witness.ts
// Spec 8.1: "each level is checked by a solver before it ships, so no level is impossible."
// Merge Siege draws new tiles and enemies during play, so no exact search fits (thirty cells and a
// seeded future: far too many states). Winnability is proven by a witness instead: the game's
// reasonable player (the greedy bot on evaluateMergeSiege) plays the board from a fixed bot seed,
// and its winning line is the proof. It lives with the rules because create() proves every board
// it hands out (levels, the daily and any other seed); the level table uses the same witness.
import { createWitnessSolver } from '@e07/game-kit/levels/witness-solver.ts';
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';

import { applyMove } from './apply-move.ts';
import { listMoves } from './list-moves.ts';
import { evaluateMergeSiege } from './merge-siege-evaluate.ts';
import { outcome } from './outcome.ts';

import type { MergeSiegeMove, MergeSiegeState } from './merge-siege-types.ts';
import type { Solver } from '@e07/game-kit/contract/levels.ts';

const RULES = { listMoves, applyMove, outcome };

/** The witness bot's own RNG seed (ties only); fixed forever, or every level table changes. */
export const WITNESS_BOT_SEED = 0x5bd1e995;
/** Legal moves the witness may be shown per board: far above a whole won level (about 100). */
export const WITNESS_MAX_NODES = 5_000;

/** The greedy bot's win is "solved"; a loss is only over budget, never unsolvable. */
export const MERGE_SIEGE_WITNESS: Solver<MergeSiegeState, MergeSiegeMove> = createWitnessSolver({
  rules: RULES,
  policy: greedyPolicy(RULES, evaluateMergeSiege),
  botSeed: WITNESS_BOT_SEED,
});
