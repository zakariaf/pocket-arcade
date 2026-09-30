// apps/flock-tilt/src/rules/intent-to-move.ts
// Flock Tilt: a swipe tilts the whole field; every sheep slides that way until something blocks it.
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { SwipeDirection } from '@e07/game-kit/geom/classify-swipe.ts';

export type FlockTiltState = {
  readonly cols: number;
  readonly rows: number;
  /** Row-major, 1 = wall. */
  readonly walls: readonly number[];
  /** Cell index of each sheep. */
  readonly sheep: readonly number[];
};

export type FlockTiltMove = { readonly kind: 'tilt'; readonly direction: SwipeDirection };

/** Physical directions (swipes never mirror): one cell step per direction. */
const STEP: Readonly<Record<SwipeDirection, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

function isOpen(state: FlockTiltState, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= state.cols || row >= state.rows) return false;
  const cell = row * state.cols + col;
  return state.walls[cell] === 0 && !state.sheep.includes(cell);
}

/** True when at least one sheep can take a step; otherwise the swipe would waste a move. */
function canTilt(state: FlockTiltState, direction: SwipeDirection): boolean {
  const [dx, dy] = STEP[direction];
  return state.sheep.some((cell) => {
    const col = cell % state.cols;
    const row = Math.floor(cell / state.cols);
    return isOpen(state, col + dx, row + dy);
  });
}

/** Pure: only swipes move the flock; taps and other gestures do nothing in this game. */
export function intentToMove(state: FlockTiltState, intent: InputIntent): FlockTiltMove | null {
  switch (intent.kind) {
    case 'swipe':
      return canTilt(state, intent.direction)
        ? { kind: 'tilt', direction: intent.direction }
        : null;
    case 'tap':
    case 'long-press':
    case 'drag-end':
    case 'aim':
      return null;
  }
}
