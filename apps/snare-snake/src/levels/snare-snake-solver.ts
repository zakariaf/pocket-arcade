// apps/snare-snake/src/levels/snare-snake-solver.ts
// Snare Snake's critters hop by the run's seeded RNG, so no exact search fits (every hop branches
// the future). Winnability is proven by a witness instead (spec 8.1, 15.7): the game's reasonable
// player (the greedy bot on evaluateSnareSnake) plays the level from a fixed bot seed, and its
// winning line is the proof; levelsContractProblems replays it through the real engine. par is that
// line's length, used only to reject levels the witness wins too quickly: Snare Snake levels are
// rated by score, and par is never shown.
import { createWitnessSolver } from '@e07/game-kit/levels/witness-solver.ts';
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/snare-snake/rules/apply-move.ts';
import { listMoves } from '@e07/snare-snake/rules/list-moves.ts';
import { outcome } from '@e07/snare-snake/rules/outcome.ts';
import { evaluateSnareSnake } from '@e07/snare-snake/rules/snare-snake-evaluate.ts';

import type { Solver } from '@e07/game-kit/contract/levels.ts';
import type { SnareSnakeMove, SnareSnakeState } from '@e07/snare-snake/rules/snare-snake-types.ts';

const RULES = { listMoves, applyMove, outcome };

/** The witness bot's own RNG seed (ties only); fixed forever, or every level table changes. */
export const WITNESS_BOT_SEED = 0x5bd1e995;
/** Legal moves the witness may be shown per level: far above a whole won level (about 120). */
export const WITNESS_MAX_NODES = 2_000;

/** levels.solver: the greedy bot's win is "solved"; a loss is only over budget, never unsolvable. */
export const SNARE_SNAKE_SOLVER: Solver<SnareSnakeState, SnareSnakeMove> = createWitnessSolver({
  rules: RULES,
  policy: greedyPolicy(RULES, evaluateSnareSnake),
  botSeed: WITNESS_BOT_SEED,
});
