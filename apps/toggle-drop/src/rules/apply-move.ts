// apps/toggle-drop/src/rules/apply-move.ts
import { dropPath, flipPath } from './drop-path.ts';
import { listMoves } from './list-moves.ts';
import { fallMark } from './timed-fall.ts';

import type { DropPath } from './drop-path.ts';
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
function switchIndexes(state: ToggleDropState, path: DropPath): Set<number> {
  const met = path.steps.filter((step) => step.side !== null);
  return new Set(met.map((step) => step.row * state.cols + step.col));
}

function landingOf(state: ToggleDropState, col: number, flipped: Set<number>): Landing {
  const filled = state.filled[col] ?? 0;
  const need = state.needs[col] ?? 0;
  const isInCup = filled < need;
  return {
    col,
    isInCup,
    isCupFilled: isInCup && filled + 1 === need,
    // A switch points away from the side it started on after an odd number of flips.
    wasRedirected: [...flipped].some((index) => (state.flips[index] ?? 0) % 2 === 1),
  };
}

/**
 * One event per line of the fall, in order (the drop, each peg row, the landing); a filled cup
 * follows its landing.
 */
function eventsOf(
  state: ToggleDropState,
  drop: { readonly col: number; readonly path: DropPath },
  landing: Landing,
): ToggleDropEvent[] {
  const events: ToggleDropEvent[] = [
    { kind: 'ball-dropped', col: drop.col, ...fallMark(drop.col, 0) },
  ];
  for (const { row, col, side } of drop.path.steps) {
    const mark = fallMark(col, row + 1);
    events.push(
      side === null
        ? { kind: 'ball-passed', col, row, ...mark }
        : { kind: 'switch-flipped', col, row, side: flippedSide(side), ...mark },
    );
  }
  const { col, isInCup, wasRedirected } = landing;
  const { x, y, atMs } = fallMark(col, state.rows + 1);
  events.push({ kind: 'ball-landed', col, x, y, isInCup, wasRedirected, atMs });
  if (landing.isCupFilled) events.push({ kind: 'cup-filled', col, atMs });
  return events;
}

/**
 * Drops one ball: it falls along its drop path (every switch it passes sends it on and flips),
 * timed in the fixed steps of the real-time loop, and lands in a cup or the gutter. Returns the
 * next state and the timed events; never changes its input; throws a RangeError for a move
 * listMoves does not list.
 */
export function applyMove(state: ToggleDropState, move: ToggleDropMove): ToggleDropResult {
  if (!listMoves(state).some((legal) => legal.col === move.col)) {
    throw new RangeError(`toggle-drop: illegal move ${JSON.stringify(move)}`);
  }
  const path = dropPath(state, move.col);
  const flipped = switchIndexes(state, path);
  const landing = landingOf(state, path.landing, flipped);
  const next: ToggleDropState = {
    ...state,
    pegs: flipPath(state, path),
    flips: state.flips.map((count, index) => (flipped.has(index) ? count + 1 : count)),
    filled: state.filled.map((count, col) =>
      landing.isInCup && landing.col === col ? count + 1 : count,
    ),
    ballsLeft: state.ballsLeft - 1,
    drops: state.drops + 1,
  };
  return { state: next, events: eventsOf(state, { col: move.col, path }, landing) };
}
