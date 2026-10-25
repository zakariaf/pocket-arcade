// apps/trail-clear/src/rules/create.ts
// Spec 10 RULES "Start state for a level (from its seed and difficulty)"; spec 8.1: the same seed
// always makes the same level, and "no level is impossible". Difficulty 0..99 is a level row, 100
// the endless run. Every level board create() hands out (packs, the daily, any other seed) is
// proven winnable by the witness, or is the proven fallback board.
import { clampDifficulty, isEndlessDifficulty, rowFor } from '@e07/game-kit/contract/difficulty.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { drawOpening, openingCells } from './opening.ts';
import { isShippedLevel } from './shipped-levels.ts';
import { TUNING } from './trail-clear-tuning.ts';
import { TRAIL_CLEAR_WITNESS, WITNESS_MAX_NODES } from './trail-clear-witness.ts';

import type { TrailClearState } from './trail-clear-types.ts';
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

/** One board drawn from the stream: the opening, with the ford offered. */
function drawBoard(rng: RngState, level: number): TrailClearState {
  const start = drawOpening(rng);
  return {
    difficulty: level,
    cells: openingCells(start.opening),
    offered: start.opening.firstTile,
    placements: 0,
    score: 0,
    loopsClosed: 0,
    hasContinued: false,
    rng: start.rng,
  };
}

/** A search's result: the board found, and whether the witness proved it winnable. */
type Search = { readonly state: TrailClearState; readonly isProven: boolean };

/**
 * Boards of the seed's stream until the witness wins one within the budget or the attempts run
 * out. Each try draws from where the last board's stream stopped, so the result is the same
 * everywhere. The first try is the board the seed always made, so a proven level keeps its board.
 */
function searchBoards(rng: RngState, level: number, budget: CreateBudget): Search {
  const state = drawBoard(rng, level);
  const isProven = TRAIL_CLEAR_WITNESS.solve(state, budget.maxNodes).kind === 'solved';
  if (isProven || budget.attempts <= 1) return { state, isProven };
  return searchBoards(state.rng, level, { ...budget, attempts: budget.attempts - 1 });
}

/**
 * create() with an explicit budget: the first proven board of the seed, or, when none is proven
 * within the budget, the fallback seed's proven board of the difficulty. The endless run is never
 * won, so it is never proven: it keeps the seed's first board, as does a shipped pack level, whose
 * first board the generator proved. Bounded: at most `attempts` witness runs (the fallback is
 * drawn without one).
 */
export function createWithin(
  seed: number,
  difficulty: number,
  budget: CreateBudget,
): TrailClearState {
  const level = clampDifficulty(difficulty);
  // The endless run is never proven; a shipped level was proven when its pack was made.
  if (isEndlessDifficulty(level) || isShippedLevel(seed, level)) return drawStart(seed, level);
  const found = searchBoards(seedRng(seed), level, budget);
  return found.isProven ? found.state : fallbackBoard(level);
}

/**
 * The fallback seed's first proven board of each level row, as its try number (1 = its first
 * board): the witness proves a board for a whole row, and a test proves each entry, so the
 * fallback costs no witness run. Changing an entry changes the fallback boards (a Gate-Change).
 */
const FALLBACK_TRY_BY_ROW = [1, 1, 2, 3] as const;

/** The fallback seed's proven board of the level's row, drawn without a witness run. */
function fallbackBoard(level: number): TrailClearState {
  const tries = pickAt(FALLBACK_TRY_BY_ROW, rowFor(level, TUNING.levelRows.length));
  const first = drawBoard(seedRng(FALLBACK_SEED), level);
  return Array.from({ length: tries - 1 }).reduce<TrailClearState>(
    (board) => drawBoard(board.rng, level),
    first,
  );
}

/**
 * The seed's first board, before any proof: what the tuning alone draws. The balance sims measure
 * the tuning on it (the proven boards create() hands out are, by construction, boards the greedy
 * bot wins, so they cannot show the tuning's curve or the skill gap).
 */
export function drawStart(seed: number, difficulty: number): TrailClearState {
  return drawBoard(seedRng(seed), clampDifficulty(difficulty));
}

/** How many recent (seed, difficulty) boards create() keeps (a run asks for its own a few times). */
const RECENT_BOARDS = 8;

type RecentBoard = { readonly key: string; readonly state: TrailClearState };

/**
 * The boards create() handed out last, newest first. Only a memo: a board depends on its seed and
 * difficulty alone and states are never changed in place, so a hit is the board create() would
 * make again, and the result stays the same everywhere.
 */
let recentBoards: readonly RecentBoard[] = [];

/**
 * Start state from (seed, difficulty). A run asks for its board when it starts, when a saved run is
 * replayed and when its counters are measured at the run end; the witness proves it only the first
 * time (at most createAttempts witness games).
 */
export function create(seed: number, difficulty: number): TrailClearState {
  const key = `${String(seed)}:${String(clampDifficulty(difficulty))}`;
  const recent = recentBoards.find((board) => board.key === key);
  if (recent !== undefined) return recent.state;
  const state = createWithin(seed, difficulty, CREATE_BUDGET);
  recentBoards = [{ key, state }, ...recentBoards].slice(0, RECENT_BOARDS);
  return state;
}
