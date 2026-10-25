// apps/merge-siege/src/rules/outcome.ts
// Spec 10 RULES "Is it over?", checked in this order: an enemy on the bottom row is lost (the
// enemies overran the board); the level's whole wave entered and smashed is won (never in the
// endless run); no swipe that changes anything is lost too (a jammed board, the same reason);
// otherwise playing.
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';

import { CELL_COUNT, COLS, DIRECTIONS } from './board-cells.ts';
import { hasSlideEffect, slideTiles } from './slide-tiles.ts';

import type { Cell, MergeSiegeState } from './merge-siege-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

/** The one way of losing: an enemy reached the bottom row (or the board jammed). */
export const OVERRUN_KEY = 'merge-siege.lose.overrun';

const isEnemy = (cell: Cell): boolean => cell?.kind === 'enemy';

/** True when an enemy stands on the bottom row. */
export function hasOverrun(state: MergeSiegeState): boolean {
  return state.cells.slice(CELL_COUNT - COLS).some(isEnemy);
}

/** The level's wave is over: every enemy of it has entered and none is left on the board. */
export function isWaveOver(state: MergeSiegeState): boolean {
  if (isEndlessDifficulty(state.difficulty)) return false;
  return state.next === null && !state.cells.some(isEnemy);
}

/** True when some swipe slides, merges, smashes or loses a tile. */
export function canSwipe(state: MergeSiegeState): boolean {
  return DIRECTIONS.some((direction) => hasSlideEffect(slideTiles(state.cells, direction)));
}

export function outcome(state: MergeSiegeState): Outcome {
  if (hasOverrun(state)) return { kind: 'lost', reasonKey: OVERRUN_KEY };
  if (isWaveOver(state)) return { kind: 'won', score: state.score };
  return canSwipe(state) ? { kind: 'playing' } : { kind: 'lost', reasonKey: OVERRUN_KEY };
}
