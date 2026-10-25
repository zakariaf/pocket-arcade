// apps/poker-drop/src/rules/create.ts
// Spec 10 RULES "Start state for a level (from its seed and difficulty)"; spec 8.1: the same seed
// always makes the same level, and "no level is impossible". Difficulty 0..99 is a level row, 100
// the endless run. Every level board create() hands out (packs, the daily, any other seed) is
// proven winnable by the witness, or is the proven fallback board.
import { clampDifficulty, isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { deckOf, shuffled } from './cards.ts';
import { dealOpening } from './opening.ts';
import { TUNING, knobsFor } from './poker-drop-tuning.ts';
import { POKER_DROP_WITNESS, WITNESS_MAX_NODES } from './poker-drop-witness.ts';

import type { Card, PokerDropState } from './poker-drop-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** How many boards create() tries, and the witness budget that proves one winnable. */
export type CreateBudget = { readonly attempts: number; readonly maxNodes: number };

/**
 * The seed of the last-resort board: its first board is proven for every level difficulty 0..99
 * with the create budget (a test checks every one), so a fallback is always winnable.
 */
export const FALLBACK_SEED = 1;

const CREATE_BUDGET: CreateBudget = {
  attempts: TUNING.createAttempts,
  maxNodes: WITNESS_MAX_NODES,
};

/**
 * One board drawn from the stream: the deck is shuffled, its first two cards are the hand and the
 * next card, and the opening rows are dealt from the rest (opening.ts).
 */
function drawBoard(rng: RngState, level: number): PokerDropState {
  const knobs = knobsFor(level);
  const deck = shuffled(deckOf(knobs.minRank), rng);
  const [hand, next, ...pile] = deck.cards as [Card, Card, ...Card[]];
  const opening = dealOpening(pile, deck.rng, { knobs, hand });
  return {
    difficulty: level,
    cells: opening.cells,
    hand,
    next,
    pile: opening.pile,
    goal: knobs.goal,
    handsMade: 0,
    score: 0,
    drops: 0,
    hasOverflowed: false,
    hasContinued: false,
    rng: opening.rng,
  };
}

/** A search's result: the board found, and whether the witness proved it winnable. */
type Search = { readonly state: PokerDropState; readonly isProven: boolean };

/**
 * Boards of the seed's stream until the witness wins one within the budget or the attempts run
 * out. Each try draws from where the last board's stream stopped, so the result is the same
 * everywhere. The first try is the board the seed always made, so a proven level keeps its board.
 */
function searchBoards(rng: RngState, level: number, budget: CreateBudget): Search {
  const state = drawBoard(rng, level);
  const isProven = POKER_DROP_WITNESS.solve(state, budget.maxNodes).kind === 'solved';
  if (isProven || budget.attempts <= 1) return { state, isProven };
  return searchBoards(state.rng, level, { ...budget, attempts: budget.attempts - 1 });
}

/**
 * create() with an explicit budget: the first proven board of the seed, or, when none is proven
 * within the budget, the fallback seed's proven board of the difficulty. The endless run is never
 * won, so it is never proven: it keeps the seed's first board. Bounded: at most 2 x attempts
 * witness runs.
 */
export function createWithin(
  seed: number,
  difficulty: number,
  budget: CreateBudget,
): PokerDropState {
  const level = clampDifficulty(difficulty);
  if (isEndlessDifficulty(level)) return drawStart(seed, level);
  const found = searchBoards(seedRng(seed), level, budget);
  return found.isProven
    ? found.state
    : searchBoards(seedRng(FALLBACK_SEED), level, CREATE_BUDGET).state;
}

/**
 * The seed's first board, before any proof: what the tuning alone draws. The balance sims measure
 * the tuning on it (the proven boards create() hands out are, by construction, boards the greedy
 * bot wins, so they cannot show the tuning's curve or the skill gap).
 */
export function drawStart(seed: number, difficulty: number): PokerDropState {
  return drawBoard(seedRng(seed), clampDifficulty(difficulty));
}

/**
 * Start state from (seed, difficulty 0..100, clamped): the same pair gives the same well, hand and
 * deck on every phone.
 */
export function create(seed: number, difficulty: number): PokerDropState {
  return createWithin(seed, difficulty, CREATE_BUDGET);
}
