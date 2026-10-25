// apps/scrap-shove/src/rules/apply-move.ts
import { listMoves } from './list-moves.ts';
import { playerMove } from './player-move.ts';
import { robotsTurn } from './robots-turn.ts';

import type {
  Floor,
  ScrapShoveEvent,
  ScrapShoveMove,
  ScrapShoveResult,
  ScrapShoveState,
} from './scrap-shove-types.ts';

/** True when two moves are the same kind onto the same square, whatever order their keys are in. */
export function isSameMove(a: ScrapShoveMove, b: ScrapShoveMove): boolean {
  if (a.kind === 'wait' || b.kind === 'wait') return a.kind === b.kind;
  return a.kind === b.kind && a.col === b.col && a.row === b.row;
}

function floorOf(state: ScrapShoveState): Floor {
  const { player, robots, heaps, nextId } = state;
  return { player, robots, heaps, nextId };
}

/** The state with a new floor, the catch, and the floor to put back if the player continues. */
function settled(state: ScrapShoveState, floor: Floor, caughtBy: number | null): ScrapShoveState {
  return { ...state, ...floor, caughtBy, rescue: caughtBy === null ? null : floorOf(state) };
}

/**
 * Pure: the player steps, shoves or waits, then every robot steps toward the player (spec 13).
 * Returns the next state and the past-tense events that explain it; a move listMoves does not
 * offer throws a RangeError instead of returning a corrupted state.
 */
export function applyMove(state: ScrapShoveState, move: ScrapShoveMove): ScrapShoveResult {
  if (!listMoves(state).some((legal) => isSameMove(legal, move))) {
    throw new RangeError(`illegal move ${JSON.stringify(move)}`);
  }
  const player = playerMove(floorOf(state), move);
  const cleared: ScrapShoveEvent = { kind: 'floor-cleared' };
  if (player.floor.robots.length === 0) {
    return { state: settled(state, player.floor, null), events: [...player.events, cleared] };
  }
  const turn = robotsTurn(player.floor, state.cols);
  const next = settled(state, turn.floor, turn.caughtBy);
  const isCleared = turn.caughtBy === null && turn.floor.robots.length === 0;
  const events = [...player.events, ...turn.events, ...(isCleared ? [cleared] : [])];
  return { state: next, events };
}
