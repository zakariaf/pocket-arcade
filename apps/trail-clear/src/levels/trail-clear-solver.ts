// apps/trail-clear/src/levels/trail-clear-solver.ts
// Trail Clear deals its tiles from the RNG in the state during play, so no exact search fits (25
// cells, up to 100 placements a tile, a seeded future). Winnability is proven by a witness instead:
// the game's reasonable player (the greedy bot on evaluateTrailClear) plays the level from a fixed
// bot seed, and its winning line is the proof; levelsContractProblems replays it through the real
// engine. par is that line's length (always the bag: a level is won by its last tile), never shown:
// Trail Clear levels are rated by score.
import { createWitnessSolver } from '@e07/game-kit/levels/witness-solver.ts';
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { listMoves } from '@e07/trail-clear/rules/list-moves.ts';
import { outcome } from '@e07/trail-clear/rules/outcome.ts';
import { evaluateTrailClear } from '@e07/trail-clear/rules/trail-clear-evaluate.ts';

import type { Solver } from '@e07/game-kit/contract/levels.ts';
import type { TrailClearMove, TrailClearState } from '@e07/trail-clear/rules/trail-clear-types.ts';

const RULES = { listMoves, applyMove, outcome };

/** The witness bot's own RNG seed (ties only); fixed forever, or every level table changes. */
export const WITNESS_BOT_SEED = 0x7c1ea4;
/** Legal moves the witness may be shown per level: far above a whole won level (about 3,000). */
export const WITNESS_MAX_NODES = 60_000;

/** levels.solver: the greedy bot's win is "solved"; a loss is only over budget, never unsolvable. */
export const TRAIL_CLEAR_SOLVER: Solver<TrailClearState, TrailClearMove> = createWitnessSolver({
  rules: RULES,
  policy: greedyPolicy(RULES, evaluateTrailClear),
  botSeed: WITNESS_BOT_SEED,
});
