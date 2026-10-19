// apps/toggle-drop/src/rules/apply-move.ts
import { listMoves } from './list-moves.ts';
import { simulateDrop } from './simulate-drop.ts';

import type { FallPoint } from './simulate-drop.ts';
import type {
  Side,
  ToggleDropEvent,
  ToggleDropMove,
  ToggleDropResult,
  ToggleDropState,
} from './toggle-drop-types.ts';

/** Where the ball ended: in a cup that still needed it or the gutter, and how it got there. */
type Landing = {
  readonly col: number;
  readonly isInCup: boolean;
  readonly isCupFilled: boolean;
  readonly wasRedirected: boolean;
};

const flippedSide = (side: Side): Side => (side === 0 ? 1 : 0);

/** The board index of each switch the ball met (it meets each peg row once). */
function switchIndexes(state: ToggleDropState, points: readonly FallPoint[]): Set<number> {
  const met = points.filter((point) => point.kind === 'row' && point.side !== null);
  return new Set(met.map((point) => point.row * state.cols + point.col));
}

function landingOf(state: ToggleDropState, land: FallPoint, flipped: Set<number>): Landing {
  const filled = state.filled[land.col] ?? 0;
  const need = state.needs[land.col] ?? 0;
  const isInCup = !land.isCapped && filled < need;
  return {
    col: land.col,
    isInCup,
    isCupFilled: isInCup && filled + 1 === need,
    wasRedirected: [...flipped].some((index) => (state.flips[index] ?? 0) > 0),
  };
}

/** One event per point of the fall, in order; a filled cup follows its landing. */
function eventsOf(points: readonly FallPoint[], landing: Landing): ToggleDropEvent[] {
  return points.flatMap((point): ToggleDropEvent[] => {
    const { col, row, x, y, atMs } = point;
    if (point.kind === 'start') return [{ kind: 'ball-dropped', col, x, y, atMs }];
    if (point.kind === 'row') {
      return point.side === null
        ? [{ kind: 'ball-passed', col, row, x, y, atMs }]
        : [{ kind: 'switch-flipped', col, row, side: flippedSide(point.side), x, y, atMs }];
    }
    const { isInCup, wasRedirected } = landing;
    const landed: ToggleDropEvent = {
      kind: 'ball-landed',
      col,
      x,
      y,
      isInCup,
      wasRedirected,
      atMs,
    };
    return landing.isCupFilled ? [landed, { kind: 'cup-filled', col, atMs }] : [landed];
  });
}

/**
 * Drops one ball: its fall is simulated in fixed steps (simulateDrop), every switch it passes sends
 * it on and flips, and it lands in a cup or the gutter. Returns the next state and the timed events;
 * never changes its input; throws a RangeError for a move listMoves does not list.
 */
export function applyMove(state: ToggleDropState, move: ToggleDropMove): ToggleDropResult {
  if (!listMoves(state).some((legal) => legal.col === move.col)) {
    throw new RangeError(`toggle-drop: illegal move ${JSON.stringify(move)}`);
  }
  const { points, land } = simulateDrop(state, move.col);
  const flipped = switchIndexes(state, points);
  const landing = landingOf(state, land, flipped);
  const next: ToggleDropState = {
    ...state,
    pegs: state.pegs.map((peg, index) =>
      peg !== -1 && flipped.has(index) ? flippedSide(peg) : peg,
    ),
    flips: state.flips.map((count, index) => (flipped.has(index) ? count + 1 : count)),
    filled: state.filled.map((count, col) =>
      landing.isInCup && landing.col === col ? count + 1 : count,
    ),
    ballsLeft: state.ballsLeft - 1,
    drops: state.drops + 1,
  };
  return { state: next, events: eventsOf(points, landing) };
}
