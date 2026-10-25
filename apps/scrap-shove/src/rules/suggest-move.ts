// apps/scrap-shove/src/rules/suggest-move.ts
import { solveFloor } from './solve-floor.ts';

import type { ScrapShoveMove, ScrapShoveState } from './scrap-shove-types.ts';

/** Solver nodes a hint may cost on the phone: every shipped floor solves far below it. */
export const HINT_MAX_NODES = 60_000;

/**
 * rules.hints.suggest (spec 8.5: "The game's solver suggests the next good move"): the first move
 * of a shortest win from this state, or null when the floor is won, lost or cannot be won any more.
 */
export function suggestMove(state: ScrapShoveState): ScrapShoveMove | null {
  const result = solveFloor(state, HINT_MAX_NODES);
  return result.kind === 'solved' ? (result.line[0] ?? null) : null;
}
