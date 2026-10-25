// apps/scrap-shove/src/rules/create.ts
import { clampDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { placeCrashPair, placeHeaps, placeRobots } from './opening.ts';
import { TUNING, knobsFor } from './scrap-shove-tuning.ts';
import { solveFloor } from './solve-floor.ts';

import type { Layout } from './opening.ts';
import type { DifficultyKnobs } from './scrap-shove-tuning.ts';
import type { Floor, ScrapShoveState } from './scrap-shove-types.ts';

/** How many layouts create() tries, and the solver budget that proves one winnable. */
export type LayoutBudget = { readonly attempts: number; readonly maxNodes: number };

/** The player on one of the four centre squares, picked by the seed; no robot or heap yet. */
export function startLayout(seed: number): Layout {
  const centre = TUNING.side / 2 - 1;
  const col = nextInt(seedRng(seed), 2);
  const row = nextInt(col.state, 2);
  const player = { col: centre + col.value, row: centre + row.value };
  return { floor: { player, robots: [], heaps: [], nextId: 1 }, rng: row.state };
}

/** The robots and heaps of a difficulty row on a floor with only the player. */
function layFloor(layout: Layout, knobs: DifficultyKnobs): Layout {
  const paired = placeCrashPair(layout);
  const normals = placeRobots(paired, {
    kind: 'normal',
    count: knobs.normal - 2,
    minDistance: TUNING.robotStartDistance,
  });
  const fasts = placeRobots(normals, {
    kind: 'fast',
    count: knobs.fast,
    minDistance: TUNING.fastStartDistance,
  });
  const heavies = placeRobots(fasts, {
    kind: 'heavy',
    count: knobs.heavy,
    minDistance: TUNING.robotStartDistance,
  });
  return placeHeaps(heavies, knobs.heaps);
}

function stateOf(floor: Floor): ScrapShoveState {
  return {
    cols: TUNING.side,
    rows: TUNING.side,
    ...floor,
    robotsTotal: floor.robots.length,
    caughtBy: null,
    rescue: null,
    hasContinued: false,
  };
}

/** A layout search's result: the floor found, and whether the solver proved it winnable. */
type Search = { readonly state: ScrapShoveState; readonly isProven: boolean };

/**
 * Tries layouts of the seed's random stream until the solver proves one winnable within the
 * budget, or the attempts run out. Each try keeps the player's square and lays robots and heaps
 * again from where the stream stopped, so the result is the same everywhere.
 */
function searchLayouts(start: Layout, knobs: DifficultyKnobs, budget: LayoutBudget): Search {
  const laid = layFloor(start, knobs);
  const state = stateOf(laid.floor);
  const isProven = solveFloor(state, budget.maxNodes).kind === 'solved';
  if (isProven || budget.attempts <= 1) return { state, isProven };
  const next = { floor: start.floor, rng: laid.rng };
  return searchLayouts(next, knobs, { ...budget, attempts: budget.attempts - 1 });
}

/**
 * The first layout of the seed's stream proven winnable within the budget, or the last one tried
 * (then unproven: create() never hands that one out, it takes the fallback floor instead).
 */
export function firstWinnable(
  start: Layout,
  knobs: DifficultyKnobs,
  budget: LayoutBudget,
): ScrapShoveState {
  return searchLayouts(start, knobs, budget).state;
}

/**
 * The seed of the last-resort floor: its first layout is proven winnable for every difficulty row
 * with the create budget (a test checks every row), so it needs no search when it is used.
 */
export const FALLBACK_SEED = 1;

/**
 * create() with an explicit budget: the first proven layout of the seed, or, when none is proven
 * within the budget, the fallback floor of the difficulty row (spec 8.1: no level is impossible).
 * Deterministic and bounded: at most `attempts` solver runs.
 */
export function createWithin(
  seed: number,
  difficulty: number,
  budget: LayoutBudget,
): ScrapShoveState {
  const knobs = knobsFor(clampDifficulty(difficulty));
  const found = searchLayouts(startLayout(seed), knobs, budget);
  return found.isProven ? found.state : stateOf(layFloor(startLayout(FALLBACK_SEED), knobs).floor);
}

/**
 * Start state from (seed, difficulty): the same pair gives the same floor on every phone. The
 * difficulty's tuning row says how many robots of each kind and how many heaps; the opening crash
 * pair counts as two of the normal robots; every floor is proven winnable (or is the proven
 * fallback), so every level and every daily can be won. Nothing is drawn after this: the robots
 * are deterministic, so the state carries no random stream.
 */
export function create(seed: number, difficulty: number): ScrapShoveState {
  const budget = { attempts: TUNING.createAttempts, maxNodes: TUNING.createMaxNodes };
  return createWithin(seed, difficulty, budget);
}
