// packages/shell/src/game-host/session-hints.ts
// Spec 8.5 hints for one run: which move a hint would show now, and showing it. The game's search
// runs once per position, because the Game screen asks canHint before anyone pays and the paid
// hint then asks again for the same position.
import type { HintPolicy } from '@e07/game-kit/contract/game-rules.ts';
import type { GameSessionStore } from '@e07/shell/game-host/game-session-store.ts';
import type { ViewExtras } from '@e07/shell/game-host/session-view-of.ts';
import type { StoreApi } from 'zustand/vanilla';

/** The game's hint search for one run, by position: the session's eventSeq and its state. */
export type HintSearch<TState, TMove> = (eventSeq: number, state: TState) => TMove | null;

/** What the hint functions read from one run's controller. */
export type HintParts<TState, TMove, TEvent> = {
  readonly store: GameSessionStore<TState, TMove, TEvent>;
  readonly extras: StoreApi<ViewExtras<TMove>>;
  readonly search: HintSearch<TState, TMove>;
};

/**
 * The game's suggest, remembered for the last eventSeq: every change of position (a move, an
 * undo, a continue) raises eventSeq, so a new position searches again. No solver hints: null.
 */
export function hintSearchOf<TState, TMove>(
  hints: HintPolicy<TState, TMove>,
): HintSearch<TState, TMove> {
  if (hints.kind !== 'solver') return () => null;
  let last: { readonly eventSeq: number; readonly move: TMove | null } | null = null;
  return (eventSeq, state) => {
    if (last?.eventSeq !== eventSeq) last = { eventSeq, move: hints.suggest(state) };
    return last.move;
  };
}

/**
 * The move a hint would show now, or null: no solver hints, the run is not playing, a hint for
 * this position shows already, or the solver has no move. The Game screen asks it (canHint)
 * before anyone pays, so a paid hint is never one the run cannot give (spec 8.5).
 */
export function hintToGive<TState, TMove, TEvent>(
  parts: HintParts<TState, TMove, TEvent>,
): TMove | null {
  const { session } = parts.store.getState();
  if (session.status !== 'playing') return null;
  const shown = parts.extras.getState().hint;
  if (shown !== null && shown.atSeq === session.eventSeq) return null;
  return parts.search(session.eventSeq, session.state);
}

/** Shows the hint for this position and counts it, or does nothing when none can be given. */
export function showHint<TState, TMove, TEvent>(parts: HintParts<TState, TMove, TEvent>): void {
  const move = hintToGive(parts);
  if (move === null) return;
  const { session, dispatch } = parts.store.getState();
  parts.extras.setState({ hint: { move, atSeq: session.eventSeq } });
  dispatch({ type: 'use-hint' });
}
