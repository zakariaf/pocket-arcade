// apps/scrap-shove/src/rules/suggest-move.ts
import { advanceFloor } from './apply-move.ts';
import { outcome } from './outcome.ts';
import { floorKey, solveFloor } from './solve-floor.ts';

import type { ScrapShoveMove, ScrapShoveState } from './scrap-shove-types.ts';

/**
 * Positions a hint's search may expand on the phone. Measured in Node over every shipped level and
 * 30 dailies (6 random walks each, 1,886 positions still in play): every winnable one (1,202) is
 * solved within 1,507 positions, so no hint is lost at this cap, and a floor far beyond any level
 * stops here instead of searching up to 60,000 positions.
 */
export const HINT_MAX_NODES = 5_000;

/** The line the last hint search found: each position on it (by key) and the move made there. */
type HintLine = { readonly keys: readonly string[]; readonly moves: readonly ScrapShoveMove[] };

/** The floor's side with its key: two floors of one key but another side play out differently. */
const lineKey = (state: ScrapShoveState): string => `${String(state.cols)}|${floorKey(state)}`;

/**
 * The last line a hint search found. Only a memo: breadth-first search returns the first shortest
 * line in move order, and the rest of that line is the first shortest line from each position on
 * it, so a position on the line gets the move a new search would find there, without the search.
 */
let lastLine: HintLine = { keys: [], moves: [] };

/** The positions a line passes from `start`, each with the move made there. */
function lineFrom(start: ScrapShoveState, moves: readonly ScrapShoveMove[]): HintLine {
  const keys: string[] = [];
  let state = start;
  for (const move of moves) {
    keys.push(lineKey(state));
    state = advanceFloor(state, move);
  }
  return { keys, moves };
}

/**
 * rules.hints.suggest (spec 8.5: "The game's solver suggests the next good move"): the first move
 * of a shortest win from this state, or null when the floor is won, lost or cannot be won any more
 * within the hint budget. A player who follows the hints is answered from the line already found.
 */
export function suggestMove(state: ScrapShoveState): ScrapShoveMove | null {
  if (outcome(state).kind !== 'playing') return null;
  const onLine = lastLine.keys.indexOf(lineKey(state));
  if (onLine >= 0) return lastLine.moves[onLine] ?? null;
  const result = solveFloor(state, HINT_MAX_NODES);
  if (result.kind !== 'solved') return null;
  lastLine = lineFrom(state, result.line);
  return result.line[0] ?? null;
}
