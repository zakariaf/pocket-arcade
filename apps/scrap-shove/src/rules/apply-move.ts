// apps/scrap-shove/src/rules/apply-move.ts
import { listMoves } from './list-moves.ts';
import { playerMove } from './player-move.ts';
import { robotsTurn } from './robots-turn.ts';

import type { PlayerResult } from './player-move.ts';
import type { Turn } from './robots-turn.ts';
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

/** A move played out: the player's half, the robots' turn (none once the floor is clear), the result. */
type Played = {
  readonly player: PlayerResult;
  readonly turn: Turn | null;
  readonly state: ScrapShoveState;
};

function play(state: ScrapShoveState, move: ScrapShoveMove): Played {
  const player = playerMove(floorOf(state), move);
  if (player.floor.robots.length === 0) {
    return { player, turn: null, state: settled(state, player.floor, null) };
  }
  const turn = robotsTurn(player.floor, state.cols);
  return { player, turn, state: settled(state, turn.floor, turn.caughtBy) };
}

/**
 * The state a listed move leads to, exactly applyMove's, without the legality check or the events
 * list: the solver's apply, whose moves come from listMoves and whose positions never animate.
 */
export function advanceFloor(state: ScrapShoveState, move: ScrapShoveMove): ScrapShoveState {
  return play(state, move).state;
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
  const { player, turn, state: next } = play(state, move);
  const cleared: ScrapShoveEvent = { kind: 'floor-cleared' };
  if (turn === null) return { state: next, events: [...player.events, cleared] };
  const isCleared = turn.caughtBy === null && turn.floor.robots.length === 0;
  const events = [...player.events, ...turn.events, ...(isCleared ? [cleared] : [])];
  return { state: next, events };
}
