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

/**
 * The first layout of the seed's random stream that the solver proves winnable within the budget
 * (spec 8.1: no level is impossible), or the last one tried. Each try keeps the player's square and
 * lays robots and heaps again from where the stream stopped, so the result is the same everywhere.
 */
export function firstWinnable(
  start: Layout,
  knobs: DifficultyKnobs,
  budget: LayoutBudget,
): ScrapShoveState {
  const laid = layFloor(start, knobs);
  const state = stateOf(laid.floor);
  if (budget.attempts <= 1 || solveFloor(state, budget.maxNodes).kind === 'solved') return state;
  const next = { floor: start.floor, rng: laid.rng };
  return firstWinnable(next, knobs, { ...budget, attempts: budget.attempts - 1 });
}

/**
 * Start state from (seed, difficulty): the same pair gives the same floor on every phone. The
 * difficulty's tuning row says how many robots of each kind and how many heaps; the opening crash
 * pair counts as two of the normal robots; every floor is proven winnable, so every level and
 * every daily can be won. Nothing is drawn after this: the robots are deterministic, so the state
 * carries no random stream.
 */
export function create(seed: number, difficulty: number): ScrapShoveState {
  const knobs = knobsFor(clampDifficulty(difficulty));
  const budget = { attempts: TUNING.createAttempts, maxNodes: TUNING.createMaxNodes };
  return firstWinnable(startLayout(seed), knobs, budget);
}
