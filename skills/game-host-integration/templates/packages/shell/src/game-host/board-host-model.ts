// packages/shell/src/game-host/board-host-model.ts
// The pure parts of the board host factory (create-game-board-host.tsx): what the board presents
// and how the host reacts, kept out of the component so plain Jest can prove them.
import { isSameTarget } from '@e07/game-kit/geom/board-layout.ts';

import type { BoardHighlight, GameBoard } from './board-types.ts';
import type { GameSession } from './game-session-types.ts';
import type { SessionHandle } from './session-view.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { Motion } from '@e07/game-kit/timeline/track.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';

/** What GameBoardHost presents: the saved state and the events of the last change. */
export type BoardMoveResult<TState, TEvent> = {
  readonly seq: number;
  readonly state: TState;
  readonly events: readonly TEvent[];
};

type Presented<TState, TEvent> = Pick<
  GameSession<TState, unknown, TEvent>,
  'eventSeq' | 'state' | 'lastEvents'
>;

/**
 * A store selector that returns the SAME object until eventSeq changes: a new object on every
 * render (play time, hints) would restart the board's animation. One selector per opened run.
 */
export function createMoveResultSelector<TState, TEvent>(): (
  session: Presented<TState, TEvent>,
) => BoardMoveResult<TState, TEvent> {
  let last: BoardMoveResult<TState, TEvent> | null = null;
  return (session) => {
    if (last?.seq !== session.eventSeq) {
      last = { seq: session.eventSeq, state: session.state, events: session.lastEvents };
    }
    return last;
  };
}

/** The Reduce motion setting as the board's timeline motion. */
export function motionOf(isReducedMotion: boolean): Motion {
  return isReducedMotion ? 'reduced' : 'full';
}

/** The board's callbacks into the run: intents go to the host, failures pause and are logged. */
export type BoardHandlers = {
  readonly onIntent: (intent: InputIntent) => void;
  readonly onFailure: (message: string) => void;
  readonly reportError: (error: unknown) => void;
};

export function boardHandlersFor(handle: SessionHandle, errorLog: ErrorLogPort): BoardHandlers {
  return {
    onIntent: (intent) => {
      handle.send({ type: 'intent', intent });
    },
    onFailure: (message) => {
      handle.send({ type: 'pause' });
      errorLog.record('frame-callback', new Error(message));
    },
    reportError: (error) => {
      errorLog.record('audio', error);
    },
  };
}

/**
 * The tap-then-tap selection: UI state of one board host, never game state and never a move, so
 * bots, sims, par, undo and the move counters never see it. It belongs to the eventSeq it was
 * made at: any applied, undone or continued move (and the run's end) clears it.
 */
export type BoardSelection = { readonly target: BoardTarget; readonly seq: number };

/** The selected target shown at this eventSeq, or null. */
export function selectedAt(selection: BoardSelection | null, seq: number): BoardTarget | null {
  return selection !== null && selection.seq === seq ? selection.target : null;
}

export type IntentRouteInput = {
  readonly intent: InputIntent;
  /** selectedAt(selection, seq): the selection the player sees right now. */
  readonly selected: BoardTarget | null;
  readonly seq: number;
  /** engine.selectRegions: the regions whose taps select instead of act. */
  readonly selectRegions: readonly string[];
};

export type IntentRoute = {
  /** The selection after this intent (null clears it). */
  readonly selection: BoardSelection | null;
  /** What the host sends to the run, or null: a tap in a select region only selects. */
  readonly intent: InputIntent | null;
  /** VoiceOver news: a select-region tap picked or dropped the selection; null otherwise. */
  readonly announce: 'selected' | 'unselected' | null;
};

function keep(selected: BoardTarget | null, seq: number): BoardSelection | null {
  return selected === null ? null : { target: selected, seq };
}

/**
 * How the host routes one intent (tap-then-tap): a tap in a select region toggles the selection
 * (the same target again clears it); any other tap goes to intentToMove with `selected` filled
 * in, and the selection stays until a move is applied (a new eventSeq); a drag ignores the
 * selection and clears it; other intents pass through unchanged.
 */
export function routeIntent({
  intent,
  selected,
  seq,
  selectRegions,
}: IntentRouteInput): IntentRoute {
  if (intent.kind === 'tap' && selectRegions.includes(intent.target.regionId)) {
    const isSame = isSameTarget(selected, intent.target);
    return {
      selection: isSame ? null : { target: intent.target, seq },
      intent: null,
      announce: isSame ? 'unselected' : 'selected',
    };
  }
  if (intent.kind === 'tap') {
    return { selection: keep(selected, seq), intent: { ...intent, selected }, announce: null };
  }
  if (intent.kind === 'drag-end') return { selection: null, intent, announce: null };
  return { selection: keep(selected, seq), intent, announce: null };
}

const NO_TARGETS: readonly BoardTarget[] = [];

/** The cells of the bought hint's move (board.targetsOfMove), or none. */
export function hintedTargetsOf<TState, TMove>(
  board: Pick<GameBoard<TState, unknown, string, TMove>, 'targetsOfMove'>,
  state: TState,
  move: TMove | null,
): readonly BoardTarget[] {
  if (move === null || board.targetsOfMove === undefined) return NO_TARGETS;
  return board.targetsOfMove(state, move);
}

/** The board highlight: the selection and the hinted targets (tutorial pointers add to them). */
export function highlightOf(
  selected: BoardTarget | null,
  hinted: readonly BoardTarget[],
  coached: readonly BoardTarget[],
): BoardHighlight {
  return { selected, hinted: coached.length === 0 ? hinted : [...hinted, ...coached] };
}
