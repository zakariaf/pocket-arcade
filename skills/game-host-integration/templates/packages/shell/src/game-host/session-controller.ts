// packages/shell/src/game-host/session-controller.ts
import { createStore } from 'zustand/vanilla';

import { createGameSessionStore } from '@e07/shell/game-host/game-session-store.ts';
import { createPlayClock } from '@e07/shell/game-host/play-clock.ts';
import { runEndOf, summarizeRun } from '@e07/shell/game-host/run-summary.ts';
import { createRunWriter, writeRun, writeRunForHome } from '@e07/shell/game-host/run-writer.ts';
import { sessionViewOf } from '@e07/shell/game-host/session-view-of.ts';
import { continueStateOf } from '@e07/shell/game-host/session-view.ts';
import { playUiFeedback } from '@e07/shell/services/audio/ui-feedback.ts';
import { applyRunEnd } from '@e07/shell/stores/run-end.ts';

import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules } from '@e07/game-kit/contract/game-rules.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { GameSessionStore } from '@e07/shell/game-host/game-session-store.ts';
import type { GameSession, SessionAction } from '@e07/shell/game-host/game-session-types.ts';
import type { PlayClock } from '@e07/shell/game-host/play-clock.ts';
import type { RunEndContext, RunSummary } from '@e07/shell/game-host/run-summary.ts';
import type { ViewExtras, ViewFixture } from '@e07/shell/game-host/session-view-of.ts';
import type {
  SessionCommand,
  SessionHandle,
  SessionView,
} from '@e07/shell/game-host/session-view.ts';
import type { TutorialRules } from '@e07/shell/game-host/tutorial-script.ts';
import type { FeedbackPorts } from '@e07/shell/services/audio/ui-feedback.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { SectionWrite } from '@e07/shell/stores/update-and-publish.ts';
import type { StoreApi } from 'zustand/vanilla';

/** The typed parts of the game one session needs; only createGameHost builds them. */
export type ControllerDeps<TState, TMove, TEvent> = RunEndContext<TState, TMove, TEvent> & {
  readonly engine: Pick<GameEngine<TState, TMove, TEvent>, 'intentToMove'>;
  readonly gameRules: GameRules<TState, TMove, TEvent>;
  readonly persistence: PersistenceSpec<TState, TMove>;
  readonly save: SaveService;
  readonly today: () => DateKey;
  /** ClockPort.nowMs: play time is measured between commands (see play-clock.ts). */
  readonly nowMs: () => number;
  /** game.config isContinueAllowed: an app may switch the game's continue off. */
  readonly isContinueAllowed: boolean;
  /** More sections for the one run-end update (the ads skill records its history here). */
  readonly extendRunEnd?: (doc: SaveDoc, summary: RunSummary) => SaveDoc;
  /** The one run-end write: updateAndPublish(save, stores, write), so every section store re-reads it. */
  readonly writeRunEnd: (write: SectionWrite) => void;
  /** Audio and haptics: the move that decides the run plays the win or lose feedback once. */
  readonly feedback: FeedbackPorts;
  /**
   * The tutorial run's script (tutorialRulesOf): each step accepts only its expected move, and a
   * try refused by a step that waits for one exact move is counted. Other runs leave it out.
   */
  readonly tutorial?: TutorialRules<TMove>;
};

/** The typed controller: the erased handle for screens plus the typed parts for the board. */
export type SessionController<TState, TMove, TEvent> = {
  readonly handle: SessionHandle;
  readonly store: GameSessionStore<TState, TMove, TEvent>;
  /** The move to highlight for the current position, or null (the board host reads it). */
  readonly hintedMove: () => TMove | null;
  /** A hint can be given now (asked before paying for one): see hintToGive. */
  readonly canHint: () => boolean;
  /**
   * Test builds (the host's debug controls): the run jumps to `state`, an example win or loss, and
   * ends through the same persist step as a deciding move. False (nothing changes) when the run
   * is already recorded or the state does not end it.
   */
  readonly endWith: (state: TState) => boolean;
  /** Test builds (the parity frames): the view shows these numbers over the run's own. */
  readonly showFixture: (fixture: ViewFixture) => void;
};

type Parts<TState, TMove, TEvent> = {
  readonly deps: ControllerDeps<TState, TMove, TEvent>;
  readonly store: GameSessionStore<TState, TMove, TEvent>;
  readonly extras: StoreApi<ViewExtras<TMove>>;
  readonly playClock: PlayClock;
};

type Session<TState, TMove, TEvent> = GameSession<TState, TMove, TEvent>;

function isOver(session: Session<unknown, unknown, unknown>): boolean {
  return session.status === 'won' || session.status === 'lost';
}

function isContinueOffered<TState, TMove, TEvent>(
  deps: ControllerDeps<TState, TMove, TEvent>,
  session: Session<TState, TMove, TEvent>,
): boolean {
  return continueStateOf(deps.gameRules.continueRun, deps.isContinueAllowed, session) === 'offered';
}

/**
 * Spec S7: stars and statistics are saved before the result screen appears, in ONE update that
 * also clears the run and refreshes the backup.
 */
function recordEnd<TState, TMove, TEvent>(
  deps: ControllerDeps<TState, TMove, TEvent>,
  session: Session<TState, TMove, TEvent>,
): RunSummary {
  const summary = summarizeRun(session, deps, deps.save.doc());
  const end = runEndOf(session, summary, deps);
  const extend = deps.extendRunEnd ?? ((doc: SaveDoc): SaveDoc => doc);
  deps.writeRunEnd({
    recipe: (doc) => extend(applyRunEnd(doc, end, deps.today()), summary),
    refreshBackup: true,
  });
  return summary;
}

type Persist<TState, TMove, TEvent> = (
  session: Session<TState, TMove, TEvent>,
  action: SessionAction<TMove> | null,
) => void;

/**
 * Called by the session store with every changed session, before it is published; the debug
 * controls' endWith calls it too, with no action, for the run they end.
 */
function makePersist<TState, TMove, TEvent>(
  deps: ControllerDeps<TState, TMove, TEvent>,
  extras: StoreApi<ViewExtras<TMove>>,
): Persist<TState, TMove, TEvent> {
  const writeTurn = createRunWriter<TState, TMove, TEvent>(deps.save, deps.persistence);
  return (session, action) => {
    if (!isOver(session)) {
      if (action !== null) writeTurn(session, action);
      return;
    }
    if (isContinueOffered(deps, session)) {
      // A loss the player may still rescue: keep the run (resumable, shown lost) until they decide.
      writeRun(deps, session, true);
    } else {
      extras.setState({ summary: recordEnd(deps, session), hint: null });
    }
    // The result step: once, for the move that decided it, after it is on disk and before S7 shows.
    if (action === null || action.type === 'apply-move') {
      playUiFeedback(deps.feedback, session.status === 'won' ? 'win' : 'lose');
    }
  };
}

/** The run jumped to an ending state (an example): its session as the reducer would build it. */
function endedAt<TState, TMove, TEvent>(
  deps: ControllerDeps<TState, TMove, TEvent>,
  session: Session<TState, TMove, TEvent>,
  state: TState,
): Session<TState, TMove, TEvent> | null {
  const outcome = deps.rules.outcome(state);
  if (outcome.kind === 'playing') return null;
  const eventSeq = session.eventSeq + 1;
  return { ...session, state, outcome, status: outcome.kind, past: [], lastEvents: [], eventSeq };
}

/**
 * The move a hint would show now, or null: no solver hints, the run is not playing, a hint for
 * this position shows already, or the solver has no move. The Game screen asks it (canHint)
 * before anyone pays, so a paid hint is never one the run cannot give (spec 8.5).
 */
function hintToGive<TState, TMove, TEvent>(parts: Parts<TState, TMove, TEvent>): TMove | null {
  const { session } = parts.store.getState();
  const hints = parts.deps.gameRules.hints;
  if (hints.kind !== 'solver' || session.status !== 'playing') return null;
  const shown = parts.extras.getState().hint;
  if (shown !== null && shown.atSeq === session.eventSeq) return null;
  return hints.suggest(session.state);
}

function showHint<TState, TMove, TEvent>(parts: Parts<TState, TMove, TEvent>): void {
  const move = hintToGive(parts);
  if (move === null) return;
  const { session, dispatch } = parts.store.getState();
  parts.extras.setState({ hint: { move, atSeq: session.eventSeq } });
  dispatch({ type: 'use-hint' });
}

/**
 * finish records a pending loss, or ends a tutorial run the player skipped or played through (its
 * run is cleared, nothing is counted); leave keeps a live run for a later Continue on Home.
 */
function endOrLeave<TState, TMove, TEvent>(
  parts: Parts<TState, TMove, TEvent>,
  isLeaving: boolean,
): void {
  const { session } = parts.store.getState();
  if (parts.extras.getState().summary !== null) return;
  const isEnding = isOver(session) || (!isLeaving && session.ref.kind === 'tutorial');
  if (isEnding) parts.extras.setState({ summary: recordEnd(parts.deps, session) });
  else if (isLeaving) writeRunForHome(parts.deps.save, parts.deps.persistence, session);
}

/** Adds the time since the previous command if the run was playing all that time. */
function addPlayTime<TState, TMove, TEvent>(parts: Parts<TState, TMove, TEvent>): void {
  const { session, dispatch } = parts.store.getState();
  const ms = parts.playClock.lap(session.status === 'playing');
  if (ms > 0) dispatch({ type: 'add-play-time', ms });
}

/**
 * A tutorial step that waits for its move refused a try (a wrong drop, a tap that is no move):
 * count it for the view, so the coach nudges instead of staying silent. Never while paused.
 */
function noteRefusal<TState, TMove, TEvent>(parts: Parts<TState, TMove, TEvent>): void {
  const { session } = parts.store.getState();
  const isScripted = parts.deps.tutorial?.expectsMove(session.moveCount) === true;
  if (session.status !== 'playing' || !isScripted) return;
  const { refused } = parts.extras.getState();
  const count = refused?.atSeq === session.eventSeq ? refused.count + 1 : 1;
  parts.extras.setState({ refused: { count, atSeq: session.eventSeq } });
}

function run<TState, TMove, TEvent>(
  parts: Parts<TState, TMove, TEvent>,
  command: SessionCommand,
): void {
  addPlayTime(parts);
  const { session, dispatch } = parts.store.getState();
  switch (command.type) {
    case 'intent': {
      const move = parts.deps.engine.intentToMove(session.state, command.intent);
      // A move is played unless the tutorial's script expects another one.
      if (move !== null && (parts.deps.tutorial?.isMoveAccepted(move, session.moveCount) ?? true)) {
        dispatch({ type: 'apply-move', move });
      } else noteRefusal(parts);
      return;
    }
    case 'hint':
      showHint(parts);
      return;
    case 'continue':
      dispatch({ type: 'use-continue' });
      return;
    case 'finish':
    case 'leave':
      endOrLeave(parts, command.type === 'leave');
      return;
    case 'undo':
    case 'pause':
    case 'resume':
      dispatch({ type: command.type });
  }
}

/**
 * The handle screens send commands through. N10: once finish has recorded or replaced the run, or
 * the run is recorded, a late command (a rewarded continue or hint that pays out after the player
 * left, a stale tap) is dropped, so the old run never writes itself back over the save or a newer
 * run, and is never counted twice.
 */
function makeHandle<TState, TMove, TEvent>(parts: Parts<TState, TMove, TEvent>): SessionHandle {
  let isClosed = false;
  let cachedFor: readonly [unknown, unknown] | null = null;
  let cached: SessionView | null = null;
  return {
    getView: () => {
      const session = parts.store.getState();
      const extras = parts.extras.getState();
      if (cached === null || cachedFor?.[0] !== session || cachedFor[1] !== extras) {
        cached = sessionViewOf(parts.deps, session.session, extras);
        cachedFor = [session, extras];
      }
      return cached;
    },
    subscribe: (listener) => {
      const stopSession = parts.store.subscribe(listener);
      const stopExtras = parts.extras.subscribe(listener);
      return () => {
        stopSession();
        stopExtras();
      };
    },
    send: (command) => {
      if (isClosed || parts.extras.getState().summary !== null) return;
      isClosed = command.type === 'finish';
      run(parts, command);
    },
  };
}

/** Test builds only: ends the run at `state` through the one persist step, then publishes. */
function endWithState<TState, TMove, TEvent>(
  parts: Parts<TState, TMove, TEvent>,
  persist: Persist<TState, TMove, TEvent>,
  state: TState,
): boolean {
  const { session } = parts.store.getState();
  const ended = endedAt(parts.deps, session, state);
  if (ended === null || parts.extras.getState().summary !== null) return false;
  persist(ended, null);
  parts.store.setState({ session: ended });
  return true;
}

/** A run's extras before anything happened: no summary, hint, fixture or refused try. */
const NO_EXTRAS: ViewExtras<never> = { summary: null, hint: null, fixture: null, refused: null };

/**
 * One run's controller: reduce -> save -> publish through the session store, the run-end
 * record, hints, continue and leaving, behind a handle that names no game type.
 */
export function createSessionController<TState, TMove, TEvent>(
  deps: ControllerDeps<TState, TMove, TEvent>,
  initial: Session<TState, TMove, TEvent>,
): SessionController<TState, TMove, TEvent> {
  const extras = createStore<ViewExtras<TMove>>()(() => NO_EXTRAS);
  const persist = makePersist(deps, extras);
  const store = createGameSessionStore<TState, TMove, TEvent>({
    rules: deps.rules,
    initial,
    persist,
  });
  const parts = { deps, store, extras, playClock: createPlayClock(deps.nowMs) };
  const hintedMove = (): TMove | null => {
    const hint = extras.getState().hint;
    return hint !== null && hint.atSeq === store.getState().session.eventSeq ? hint.move : null;
  };
  return {
    handle: makeHandle(parts),
    store,
    hintedMove,
    canHint: () => hintToGive(parts) !== null,
    endWith: (state) => endWithState(parts, persist, state),
    showFixture: (fixture) => {
      extras.setState({ fixture: { ...extras.getState().fixture, ...fixture } });
    },
  };
}
