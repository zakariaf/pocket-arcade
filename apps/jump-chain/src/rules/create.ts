// apps/jump-chain/src/rules/create.ts
// The start of a level, the daily or the endless run from (seed, difficulty): the same pair gives
// the same board on every phone. Your piece starts in the middle column, two rows below the front rank; the
// enemy ranks stand two rows apart from the front rank's row upward, and the ranks that do not fit
// wait above the board. The endless run makes ranks up to the first row above the board, so one
// rank always waits there. A level or daily board is handed out only once the witness (the greedy
// bot that proves every shipped level) wins it: spec 8.1, no level is impossible. A shipped level's
// own board was proven when its pack was generated, so it is not searched again at every start.
import { clampDifficulty, isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { isShippedLevel } from '@e07/jump-chain/levels/jump-chain-shipped.ts';
import { JUMP_CHAIN_SOLVER, WITNESS_MAX_NODES } from '@e07/jump-chain/levels/jump-chain-solver.ts';

import { TUNING, knobsFor } from './jump-chain-tuning.ts';
import { makeRank } from './ranks.ts';

import type { Enemy, JumpChainMove, JumpChainState } from './jump-chain-types.ts';
import type { Solver } from '@e07/game-kit/contract/levels.ts';

/** The rows of the opening ranks, front first. */
export function openingRankRows(difficulty: number): number[] {
  const knobs = knobsFor(difficulty);
  const count = isEndlessDifficulty(difficulty)
    ? (knobs.frontRow + 1) / TUNING.rankGap + 1
    : knobs.ranks;
  return Array.from({ length: count }, (_, rank) => knobs.frontRow - rank * TUNING.rankGap);
}

/** One layout of (seed, difficulty), not yet proven: the ranks drawn from the seed's stream. */
function layBoard(seed: number, clamped: number): JumpChainState {
  const knobs = knobsFor(clamped);
  const rows = openingRankRows(clamped);
  let rng = seedRng(seed);
  const enemies: Enemy[] = [];
  rows.forEach((row, rank) => {
    const made = makeRank({ rng, rank, row, fill: knobs.fill, firstId: enemies.length });
    rng = made.rng;
    enemies.push(...made.enemies);
  });
  return {
    difficulty: clamped,
    piece: { col: TUNING.pieceStart.col, row: TUNING.pieceStart.row },
    enemies,
    total: enemies.length,
    captured: 0,
    nextRank: rows.length,
    ranksCleared: 0,
    moves: 0,
    marchIn: knobs.marchEvery,
    score: 0,
    hasContinued: false,
    nextId: enemies.length,
    rng,
  };
}

/**
 * The seed's own layout, unproven: the level generator's candidate board. It keeps only seeds whose
 * own layout the witness wins, so create() hands out exactly that board for every shipped level.
 */
export function createLayout(seed: number, difficulty: number): JumpChainState {
  return layBoard(seed, clampDifficulty(difficulty));
}

/** How hard create() searches: layouts tried, and the witness's move budget for each. */
export type CreateBudget = {
  readonly attempts: number;
  readonly maxNodes: number;
  /** The witness to ask (JUMP_CHAIN_SOLVER unless a test counts its calls). */
  readonly solver?: Solver<JumpChainState, JumpChainMove>;
};

/** Layouts create() tries before the fallback (ten years of dailies need at most five). */
export const CREATE_BUDGET: CreateBudget = { attempts: 20, maxNodes: WITNESS_MAX_NODES };

/**
 * The seed of the last-resort board: its own layout is proven winnable in every level row (a test
 * checks each row), so it needs no search when it is used.
 */
export const FALLBACK_SEED = 1;

/** The seed of try `attempt`: the seed itself first, so a proven seed keeps its own board. */
function attemptSeed(seed: number, attempt: number): number {
  return (seed + attempt * 0x9e3779b9) >>> 0;
}

/**
 * create() with an explicit budget: the first layout the witness wins within budget.maxNodes, or,
 * when none of the budget.attempts tries is proven, the fallback board of the difficulty. The
 * endless run has no win, and a shipped level's own layout is already proven, so neither is
 * searched. Deterministic and bounded.
 */
export function createWithin(
  seed: number,
  difficulty: number,
  budget: CreateBudget,
): JumpChainState {
  const clamped = clampDifficulty(difficulty);
  // The endless run has no win to prove; a shipped level was proven when its pack was generated.
  if (isEndlessDifficulty(clamped) || isShippedLevel(seed, clamped)) return layBoard(seed, clamped);
  for (let attempt = 0; attempt < budget.attempts; attempt += 1) {
    const state = layBoard(attemptSeed(seed, attempt), clamped);
    const solver = budget.solver ?? JUMP_CHAIN_SOLVER;
    if (solver.solve(state, budget.maxNodes).kind === 'solved') return state;
  }
  return layBoard(FALLBACK_SEED, clamped);
}

/** The start of a level, the daily or the endless run (the engine's create). */
export function create(seed: number, difficulty: number): JumpChainState {
  return createWithin(seed, difficulty, CREATE_BUDGET);
}
