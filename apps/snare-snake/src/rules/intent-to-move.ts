// apps/snare-snake/src/rules/intent-to-move.ts
// Spec 10 BOARD AND CONTROLS: a touch becomes a move or nothing. A swipe steers the snake that way
// (the engine's panMode is 'swipe'); a tap on a cell steers it toward that cell along the side that
// is further from the head, the one-finger way and the way the E2E flows play. Swipes and taps are
// physical: the board never mirrors. Legal means "listMoves lists it", nothing else.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { listMoves } from './list-moves.ts';

import type { Direction, SnareSnakeMove, SnareSnakeState } from './snare-snake-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** The move steering `direction`, when listMoves lists it. */
function steerIfListed(state: SnareSnakeState, direction: Direction): SnareSnakeMove | null {
  const listed = listMoves(state).find((move) => move.direction === direction);
  return listed ?? null;
}

/** The way from the head toward a tapped cell: the axis it is further along; none on a tie. */
function wayToward(state: SnareSnakeState, target: BoardTarget): Direction | null {
  const isOnBoard =
    target.regionId === 'board' &&
    target.col >= 0 &&
    target.row >= 0 &&
    target.col < state.cols &&
    target.row < state.rows;
  if (!isOnBoard) return null;
  const head = pickAt(state.snake, 0);
  const dx = target.col - (head % state.cols);
  const dy = target.row - Math.floor(head / state.cols);
  if (Math.abs(dx) === Math.abs(dy)) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** Pure: a swipe or a tap becomes a steer the rules allow, or null. */
export function intentToMove(state: SnareSnakeState, intent: InputIntent): SnareSnakeMove | null {
  switch (intent.kind) {
    case 'swipe':
      return steerIfListed(state, intent.direction);
    case 'tap': {
      const way = wayToward(state, intent.target);
      return way === null ? null : steerIfListed(state, way);
    }
    case 'long-press':
    case 'drag-end':
    case 'aim':
      return null;
  }
}
