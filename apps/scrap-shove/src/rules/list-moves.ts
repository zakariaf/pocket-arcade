// apps/scrap-shove/src/rules/list-moves.ts
import { beyond, heapAt, isOnFloor, neighboursOf, robotAt } from './floor-squares.ts';
import { outcome } from './outcome.ts';

import type { Cell, ScrapShoveMove, ScrapShoveState } from './scrap-shove-types.ts';

/** True when a heap on `square` can be shoved away from the player: on the floor, no heap behind. */
export function canShove(state: ScrapShoveState, square: Cell): boolean {
  const target = beyond(state.player, square);
  return isOnFloor(target, state.cols) && heapAt(state, target) === null;
}

/** The move a neighbouring square offers: a step, a shove, or nothing (a robot, a stuck heap). */
export function moveOnto(state: ScrapShoveState, square: Cell): ScrapShoveMove | null {
  if (robotAt(state, square) !== null) return null;
  if (heapAt(state, square) === null) return { kind: 'step', ...square };
  return canShove(state, square) ? { kind: 'shove', ...square } : null;
}

/**
 * Every legal move in a fixed order (bots, solvers and replays depend on it): the neighbours in
 * reading order, then wait. Empty once the floor is won or lost.
 */
export function listMoves(state: ScrapShoveState): ScrapShoveMove[] {
  if (outcome(state).kind !== 'playing') return [];
  const moves = neighboursOf(state.player, state.cols).flatMap((square) => {
    const move = moveOnto(state, square);
    return move === null ? [] : [move];
  });
  return [...moves, { kind: 'wait' }];
}
