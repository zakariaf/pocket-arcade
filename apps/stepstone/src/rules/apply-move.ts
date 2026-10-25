// apps/stepstone/src/rules/apply-move.ts
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { hopKindOf, isMoveKind, targetsOf } from './hops.ts';
import { listMoves } from './list-moves.ts';

import type {
  MoveKind,
  StepstoneEvent,
  StepstoneMove,
  StepstoneResult,
  StepstoneState,
} from './stepstone-types.ts';

/** The frog's hop kind when the move is one listMoves offers, else null. */
function legalHop(state: StepstoneState, move: StepstoneMove): MoveKind | null {
  const kind = hopKindOf(state);
  const isListed = listMoves(state).some((legal) => legal.to === move.to);
  return kind !== null && isListed ? kind : null;
}

/**
 * Pure: the frog lands on the target and takes its stone's hop; the stone it left sinks. An
 * illegal move throws instead of returning a corrupted state (the Shell only passes listed moves).
 */
export function applyMove(state: StepstoneState, move: StepstoneMove): StepstoneResult {
  const moveKind = legalHop(state, move);
  if (moveKind === null) throw new RangeError(`illegal move ${JSON.stringify(move)}`);
  const from = state.frog;
  const landed = pickAt(state.cells, move.to);
  const isNewKind = isMoveKind(landed) && !state.kindsUsed.includes(landed);
  const kindsUsed = isNewKind ? [...state.kindsUsed, landed] : state.kindsUsed;
  const next: StepstoneState = {
    ...state,
    cells: state.cells.map((cell, index) => (index === from ? 'sunk' : cell)),
    frog: move.to,
    moves: state.moves + 1,
    kindsUsed,
  };
  const events: StepstoneEvent[] = [
    { kind: 'player-stepped', from, to: move.to, moveKind, kindsUsed: kindsUsed.length },
    { kind: 'stone-sank', cell: from, stone: moveKind },
  ];
  if (isMoveKind(landed) && landed !== moveKind) {
    events.push({
      kind: 'move-kind-changed',
      cell: move.to,
      from: moveKind,
      to: landed,
      isNewKind,
    });
  }
  if (landed === 'flag') {
    events.push({ kind: 'goal-reached', cell: move.to, moves: next.moves, par: state.par });
  } else if (targetsOf(next).length === 0) {
    events.push({ kind: 'frog-stranded', cell: move.to });
  }
  return { state: next, events };
}
