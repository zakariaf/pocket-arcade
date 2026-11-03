// apps/scrap-shove/src/rules/suggest-move.ts
import { solveFloor } from './solve-floor.ts';

import type { ScrapShoveMove, ScrapShoveState } from './scrap-shove-types.ts';

/**
 * Positions a hint's search may expand on the phone. Measured in Node over every shipped level and
 * 30 dailies (6 random walks each, 1,886 positions still in play): every winnable one (1,202) is
 * solved within 1,507 positions, so no hint is lost at this cap, and a floor far beyond any level
 * stops here instead of searching up to 60,000 positions.
 */
export const HINT_MAX_NODES = 5_000;

/**
 * rules.hints.suggest (spec 8.5: "The game's solver suggests the next good move"): the first move
 * of a shortest win from this state, or null when the floor is won, lost or cannot be won any more.
 */
export function suggestMove(state: ScrapShoveState): ScrapShoveMove | null {
  const result = solveFloor(state, HINT_MAX_NODES);
  return result.kind === 'solved' ? (result.line[0] ?? null) : null;
}
