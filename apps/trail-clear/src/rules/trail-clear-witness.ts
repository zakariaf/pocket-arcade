// apps/trail-clear/src/rules/trail-clear-witness.ts
// Spec 8.1: "each level is checked by a solver before it ships, so no level is impossible".
// Trail Clear deals its tiles from the RNG in the state during play, so no exact search fits (25
// cells, up to 100 placements a tile, a seeded future). Winnability is proven by a witness instead:
// the game's reasonable player (the greedy bot on evaluateTrailClear) plays the board from a fixed
// bot seed, and its winning line is the proof. It lives with the rules because create() proves
// every level board it hands out (the daily and any seed outside the packs); the level table uses
// the same witness.
import { createWitnessSolver } from '@e07/game-kit/levels/witness-solver.ts';
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';

import { applyMove } from './apply-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { evaluateTrailClear } from './trail-clear-evaluate.ts';

import type { TrailClearMove, TrailClearState } from './trail-clear-types.ts';
import type { Solver } from '@e07/game-kit/contract/levels.ts';

const RULES = { listMoves, applyMove, outcome };

/** The witness bot's own RNG seed (ties only); fixed forever, or every level table changes. */
export const WITNESS_BOT_SEED = 0x7c1ea4;
/** Legal moves the witness may be shown per board: far above a whole won level (about 3,000). */
export const WITNESS_MAX_NODES = 60_000;

/** The greedy bot's win is "solved"; a loss is only over budget, never unsolvable. */
export const TRAIL_CLEAR_WITNESS: Solver<TrailClearState, TrailClearMove> = createWitnessSolver({
  rules: RULES,
  policy: greedyPolicy(RULES, evaluateTrailClear),
  botSeed: WITNESS_BOT_SEED,
});
