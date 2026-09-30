// packages/shell/src/game-host/game-session-reducer.ts
import type { ApplyResult, Outcome } from '@e07/game-kit/contract/game-engine.ts';
import type {
  GameSession,
  RunLogEntry,
  SessionAction,
  SessionRules,
  SessionStart,
  SessionStatus,
} from '@e07/shell/game-host/game-session-types.ts';

function statusOf(outcome: Outcome): SessionStatus {
  return outcome.kind === 'playing' ? 'playing' : outcome.kind;
}

export function startGameSession<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  start: SessionStart,
): GameSession<TState, TMove, TEvent> {
  const state = rules.create(start.seed, start.difficulty);
  const outcome = rules.outcome(state);
  return {
    ...start,
    state,
    past: [],
    log: [],
    status: statusOf(outcome),
    outcome,
    moveCount: 0,
    undoCount: 0,
    hintsUsed: 0,
    continuesUsed: 0,
    playMs: 0,
    lastEvents: [],
    eventSeq: 0,
  };
}

function applied<TState, TMove, TEvent>(
  session: GameSession<TState, TMove, TEvent>,
  outcomeOf: SessionRules<TState, TMove, TEvent>['outcome'],
  change: { readonly result: ApplyResult<TState, TEvent>; readonly entry: RunLogEntry<TMove> },
): GameSession<TState, TMove, TEvent> {
  const outcome = outcomeOf(change.result.state);
  return {
    ...session,
    state: change.result.state,
    outcome,
    status: statusOf(outcome),
    log: [...session.log, change.entry],
    lastEvents: change.result.events,
    eventSeq: session.eventSeq + 1,
  };
}

function moved<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  session: GameSession<TState, TMove, TEvent>,
  move: TMove,
): GameSession<TState, TMove, TEvent> {
  if (session.status !== 'playing') return session;
  const result = rules.applyMove(session.state, move);
  const next = applied(session, rules.outcome, { result, entry: { kind: 'move', move } });
  return { ...next, past: [...session.past, session.state], moveCount: session.moveCount + 1 };
}

export function canUndo<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  session: GameSession<TState, TMove, TEvent>,
): boolean {
  if (session.status !== 'playing' || session.log.at(-1)?.kind !== 'move') return false;
  switch (rules.undo.kind) {
    case 'none':
      return false;
    case 'unlimited':
      return true;
    case 'limited':
      return session.undoCount < rules.undo.perLevel;
  }
}

function undone<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  session: GameSession<TState, TMove, TEvent>,
): GameSession<TState, TMove, TEvent> {
  const previous = session.past.at(-1);
  if (previous === undefined || !canUndo(rules, session)) return session;
  return {
    ...session,
    state: previous,
    past: session.past.slice(0, -1),
    log: session.log.slice(0, -1),
    outcome: rules.outcome(previous),
    moveCount: session.moveCount - 1,
    undoCount: session.undoCount + 1,
    lastEvents: [],
    eventSeq: session.eventSeq + 1,
  };
}

/** Spec 8.10: one continue per run, only after a loss; undo cannot cross it. */
function continued<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  session: GameSession<TState, TMove, TEvent>,
): GameSession<TState, TMove, TEvent> {
  const policy = rules.continueRun;
  if (session.status !== 'lost' || policy.kind !== 'once')
    return session;
  const next = applied(session, rules.outcome, {
    result: policy.apply(session.state),
    entry: { kind: 'continue' },
  });
  return { ...next, past: [], continuesUsed: 1 };
}

/** Pure; unit- and property-tested. The Shell saves the result before animating it. */
export function gameSessionReducer<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  session: GameSession<TState, TMove, TEvent>,
  action: SessionAction<TMove>,
): GameSession<TState, TMove, TEvent> {
  switch (action.type) {
    case 'apply-move':
      return moved(rules, session, action.move);
    case 'undo':
      return undone(rules, session);
    case 'use-continue':
      return continued(rules, session);
    case 'pause':
      return session.status === 'playing' ? { ...session, status: 'paused' } : session;
    case 'resume':
      return session.status === 'paused' ? { ...session, status: 'playing' } : session;
    case 'use-hint':
      return { ...session, hintsUsed: session.hintsUsed + 1 };
    case 'add-play-time':
      return session.status === 'playing'
        ? { ...session, playMs: session.playMs + action.ms }
        : session;
  }
}
