// apps/line-siege/src/levels/line-siege-solver.ts
// Line Siege draws blocks and monsters during play, so no exact search fits (an 8x8 board, three
// offered blocks and a seeded future: far too many states). Winnability is proven by a witness
// instead: the game's reasonable player (the greedy bot on evaluateLineSiege) plays the level from a
// fixed bot seed, and its winning line is the proof; levelsContractProblems replays it through the
// real engine. par is that line's length, used only to reject levels the witness wins too quickly:
// Line Siege levels are rated by score, and par is never shown.
import { createWitnessSolver } from '@e07/game-kit/levels/witness-solver.ts';
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { evaluateLineSiege } from '@e07/line-siege/rules/line-siege-evaluate.ts';
import { listMoves } from '@e07/line-siege/rules/list-moves.ts';
import { outcome } from '@e07/line-siege/rules/outcome.ts';

import type { Solver } from '@e07/game-kit/contract/levels.ts';
import type { LineSiegeMove, LineSiegeState } from '@e07/line-siege/rules/line-siege-types.ts';

const RULES = { listMoves, applyMove, outcome };

/** The witness bot's own RNG seed (ties only); fixed forever, or every level table changes. */
export const WITNESS_BOT_SEED = 0x5bd1e995;
/** Legal moves the witness may be shown per level: far above a whole won level (about 5,000). */
export const WITNESS_MAX_NODES = 60_000;

/** levels.solver: the greedy bot's win is "solved"; a loss is only over budget, never unsolvable. */
export const LINE_SIEGE_SOLVER: Solver<LineSiegeState, LineSiegeMove> = createWitnessSolver({
  rules: RULES,
  policy: greedyPolicy(RULES, evaluateLineSiege),
  botSeed: WITNESS_BOT_SEED,
});
