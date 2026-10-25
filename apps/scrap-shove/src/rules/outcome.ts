// apps/scrap-shove/src/rules/outcome.ts
import { TUNING } from './scrap-shove-tuning.ts';

import type { ScrapShoveState } from './scrap-shove-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

/** The one way of losing (spec S7: a short, friendly reason). */
export const LOSE_CAUGHT = 'scrap-shove.lose.caught';

/** Robots scrapped so far on this floor. */
export function robotsScrapped(state: ScrapShoveState): number {
  return state.robotsTotal - state.robots.length;
}

/** Won when every robot of the floor is scrap; lost when a robot reached the player. */
export function outcome(state: ScrapShoveState): Outcome {
  if (state.caughtBy !== null) return { kind: 'lost', reasonKey: LOSE_CAUGHT };
  if (state.robots.length === 0) {
    return { kind: 'won', score: robotsScrapped(state) * TUNING.pointsPerRobot };
  }
  return { kind: 'playing' };
}
