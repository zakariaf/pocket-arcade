// apps/poker-drop/src/levels/poker-drop-solver.ts
// Poker Drop deals its future from the seeded deck and rises rows during play, so no exact search
// fits (a 5 x 6 well, a seeded deck and a cascade per drop: far too many states). Winnability is
// proven by a witness instead: the game's reasonable player (the greedy bot on evaluatePokerDrop)
// plays the level from a fixed bot seed, and its winning line is the proof; levelsContractProblems
// replays it through the real engine. par is that line's length, used only to reject levels the
// witness wins too quickly: Poker Drop levels are rated by score, and par is never shown.
import { createWitnessSolver } from '@e07/game-kit/levels/witness-solver.ts';
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/poker-drop/rules/apply-move.ts';
import { listMoves } from '@e07/poker-drop/rules/list-moves.ts';
import { outcome } from '@e07/poker-drop/rules/outcome.ts';
import { evaluatePokerDrop } from '@e07/poker-drop/rules/poker-drop-evaluate.ts';

import type { Solver } from '@e07/game-kit/contract/levels.ts';
import type { PokerDropMove, PokerDropState } from '@e07/poker-drop/rules/poker-drop-types.ts';

const RULES = { listMoves, applyMove, outcome };

/** The witness bot's own RNG seed (ties only); fixed forever, or every level table changes. */
export const WITNESS_BOT_SEED = 0x2f0d17a3;
/** Legal moves the witness may be shown per level: far above a whole won level (about 120). */
export const WITNESS_MAX_NODES = 20_000;

/** levels.solver: the greedy bot's win is "solved"; a loss is only over budget, never unsolvable. */
export const POKER_DROP_SOLVER: Solver<PokerDropState, PokerDropMove> = createWitnessSolver({
  rules: RULES,
  policy: greedyPolicy(RULES, evaluatePokerDrop),
  botSeed: WITNESS_BOT_SEED,
});
