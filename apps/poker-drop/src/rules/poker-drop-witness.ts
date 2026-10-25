// apps/poker-drop/src/rules/poker-drop-witness.ts
// Spec 8.1: "each level is checked by a solver before it ships, so no level is impossible."
// Poker Drop deals its future from the seeded deck and rises rows during play, so no exact search
// fits (a 5 x 6 well, a seeded deck and a cascade per drop: far too many states). Winnability is
// proven by a witness instead: the game's reasonable player (the greedy bot on evaluatePokerDrop)
// plays the board from a fixed bot seed, and its winning line is the proof. It lives with the
// rules because create() proves every board it hands out (levels, the daily and any other seed);
// the level table uses the same witness.
import { createWitnessSolver } from '@e07/game-kit/levels/witness-solver.ts';
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';

import { applyMove } from './apply-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { evaluatePokerDrop } from './poker-drop-evaluate.ts';

import type { PokerDropMove, PokerDropState } from './poker-drop-types.ts';
import type { Solver } from '@e07/game-kit/contract/levels.ts';

const RULES = { listMoves, applyMove, outcome };

/** The witness bot's own RNG seed (ties only); fixed forever, or every level table changes. */
export const WITNESS_BOT_SEED = 0x2f0d17a3;
/** Legal moves the witness may be shown per board: far above a whole won level (about 120). */
export const WITNESS_MAX_NODES = 20_000;

/** The greedy bot's win is "solved"; a loss is only over budget, never unsolvable. */
export const POKER_DROP_WITNESS: Solver<PokerDropState, PokerDropMove> = createWitnessSolver({
  rules: RULES,
  policy: greedyPolicy(RULES, evaluatePokerDrop),
  botSeed: WITNESS_BOT_SEED,
});
