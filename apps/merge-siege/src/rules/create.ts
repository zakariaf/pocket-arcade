// apps/merge-siege/src/rules/create.ts
// Spec 10 RULES "Start state for a level (from its seed and difficulty)"; spec 8.1: the same seed
// always makes the same level, and "no level is impossible". Difficulty 0..99 is a level row, 100
// the endless run. Every level board create() hands out (packs, the daily, any other seed) is
// proven winnable by the witness, or is the proven fallback board.
import { clampDifficulty, isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { TUNING } from './merge-siege-tuning.ts';
import { MERGE_SIEGE_WITNESS, WITNESS_MAX_NODES } from './merge-siege-witness.ts';
import { drawNextEnemy } from './next-enemy.ts';
import { drawOpening, openingCells } from './opening.ts';

import type { MergeSiegeState } from './merge-siege-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** How many boards create() tries, and the witness budget that proves one winnable. */
export type CreateBudget = { readonly attempts: number; readonly maxNodes: number };

/**
 * The seed of the last-resort board: its search proves a board for every level difficulty 0..99
 * with the create budget (a test checks every one), so a fallback is always winnable.
 */
export const FALLBACK_SEED = 1;

const CREATE_BUDGET: CreateBudget = {
  attempts: TUNING.createAttempts,
  maxNodes: WITNESS_MAX_NODES,
};

/** One board drawn from the stream: the opening, then the first waiting enemy. */
function drawBoard(rng: RngState, level: number): MergeSiegeState {
  const start = drawOpening(rng);
  const opening = openingCells(start.opening);
  const first = drawNextEnemy({ rng: start.rng, difficulty: level, swipes: 0 });
  return {
    difficulty: level,
    cells: opening.cells,
    next: first.next,
    swipes: 0,
    entered: opening.enemies,
    smashed: 0,
    score: 0,
    nextId: opening.nextId,
    hasContinued: false,
    rng: first.rng,
  };
}

/** A search's result: the board found, and whether the witness proved it winnable. */
type Search = { readonly state: MergeSiegeState; readonly isProven: boolean };

/**
 * Boards of the seed's stream until the witness wins one within the budget or the attempts run
 * out. Each try draws from where the last board's stream stopped, so the result is the same
 * everywhere. The first try is the board the seed always made, so a proven level keeps its board.
 */
function searchBoards(rng: RngState, level: number, budget: CreateBudget): Search {
  const state = drawBoard(rng, level);
  const isProven = MERGE_SIEGE_WITNESS.solve(state, budget.maxNodes).kind === 'solved';
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
): MergeSiegeState {
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
export function drawStart(seed: number, difficulty: number): MergeSiegeState {
  return drawBoard(seedRng(seed), clampDifficulty(difficulty));
}

export function create(seed: number, difficulty: number): MergeSiegeState {
  return createWithin(seed, difficulty, CREATE_BUDGET);
}
