// apps/flock-tilt/src/rules/apply-move.ts
import { endedStatus, fieldStatus } from './field-status.ts';
import { DIRECTIONS, tiltField } from './tilt-field.ts';

import type { FieldStatus } from './field-status.ts';
import type {
  Direction,
  FlockTiltEvent,
  FlockTiltMove,
  FlockTiltResult,
  FlockTiltState,
} from './flock-tilt-types.ts';
import type { Tilted } from './tilt-field.ts';

/** One applied tilt: the state after it, its direction, what moved and how the run stands. */
type AppliedTilt = {
  readonly next: FlockTiltState;
  readonly direction: Direction;
  readonly tilted: Tilted;
  readonly status: FieldStatus;
};

/** The tilt's result when the move is legal: the run goes on and the tilt moves something. */
function legalTilt(state: FlockTiltState, move: FlockTiltMove): Tilted | null {
  if (!DIRECTIONS.includes(move.direction) || endedStatus(state) !== null) return null;
  const tilted = tiltField(state, move.direction);
  return tilted.slides.length === 0 ? null : tilted;
}

/** The events of one tilt in the order they happened: the slide, the pen, the wolf, the end. */
function eventsOf(applied: AppliedTilt): FlockTiltEvent[] {
  const { next, direction, tilted, status } = applied;
  const events: FlockTiltEvent[] = [{ kind: 'animals-slid', direction, slides: tilted.slides }];
  for (const id of tilted.penned) events.push({ kind: 'sheep-penned', id, cell: next.pen });
  for (const loss of tilted.losses) {
    const { sheepId, cell, wolfId, wolfCell } = loss;
    events.push({ kind: 'sheep-lost', id: sheepId, cell, wolfId, wolfCell });
  }
  if (status === 'won') events.push({ kind: 'field-cleared', tilts: next.tilts, par: next.par });
  if (status === 'out-of-tilts') events.push({ kind: 'tilts-ran-out', tilts: next.tilts });
  return events;
}

/**
 * Pure: the next state plus the events that explain it. An illegal move (a run that is over, a
 * tilt that moves nothing, an unknown direction) throws instead of returning a corrupted state.
 * A tilt that ends the run in a loss keeps the flock from before it, for the one continue.
 */
export function applyMove(state: FlockTiltState, move: FlockTiltMove): FlockTiltResult {
  const tilted = legalTilt(state, move);
  if (tilted === null) throw new RangeError(`illegal move ${JSON.stringify(move)}`);
  const { sheep, wolves } = tilted;
  const moved: FlockTiltState = {
    ...state,
    sheep,
    wolves,
    tilts: state.tilts + 1,
    beforeLoss: null,
  };
  const status = fieldStatus(moved);
  const isLoss = status === 'wolf-got-sheep' || status === 'out-of-tilts';
  const before = { sheep: state.sheep, wolves: state.wolves, tilts: state.tilts };
  const next = isLoss ? { ...moved, beforeLoss: before } : moved;
  return { state: next, events: eventsOf({ next, direction: move.direction, tilted, status }) };
}
