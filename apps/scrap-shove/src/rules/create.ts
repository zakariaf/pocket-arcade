// apps/scrap-shove/src/rules/create.ts
import { clampDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { placeCrashPair, placeHeaps, placeRobots } from './opening.ts';
import { TUNING, knobsFor } from './scrap-shove-tuning.ts';

import type { Layout } from './opening.ts';
import type { ScrapShoveState } from './scrap-shove-types.ts';

/** The player starts on one of the four centre squares, picked by the seed. */
function startLayout(seed: number): Layout {
  const centre = TUNING.side / 2 - 1;
  const col = nextInt(seedRng(seed), 2);
  const row = nextInt(col.state, 2);
  const player = { col: centre + col.value, row: centre + row.value };
  return { floor: { player, robots: [], heaps: [], nextId: 1 }, rng: row.state };
}

/**
 * Start state from (seed, difficulty): the same pair gives the same floor on every phone. The
 * difficulty's tuning row says how many robots of each kind and how many heaps; the opening crash
 * pair counts as two of the normal robots. Nothing is drawn after this: the robots are
 * deterministic, so the state carries no random stream.
 */
export function create(seed: number, difficulty: number): ScrapShoveState {
  const knobs = knobsFor(clampDifficulty(difficulty));
  const paired = placeCrashPair(startLayout(seed));
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
  const { floor } = placeHeaps(heavies, knobs.heaps);
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
