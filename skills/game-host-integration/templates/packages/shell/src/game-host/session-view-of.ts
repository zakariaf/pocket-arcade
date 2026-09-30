// packages/shell/src/game-host/session-view-of.ts
// The plain-data SessionView of one run (what screens see), built by the session controller from
// the session, the game's hud and rules, and the controller's extras: the recorded summary, the
// shown hint and, in test builds only, the fixture numbers a parity frame shows over the run.
import { canUndo } from '@e07/shell/game-host/game-session-reducer.ts';
import { hudView } from '@e07/shell/game-host/hud-model.ts';
import { continueStateOf } from '@e07/shell/game-host/session-view.ts';

import type { GameRules } from '@e07/game-kit/contract/game-rules.ts';
import type { LevelEntry } from '@e07/game-kit/contract/levels.ts';
import type { GameSession, SessionRules } from '@e07/shell/game-host/game-session-types.ts';
import type { RunSummary } from '@e07/shell/game-host/run-summary.ts';
import type { SessionView } from '@e07/shell/game-host/session-view.ts';

/**
 * Fixed numbers a test build shows instead of the played ones (the parity frames S5, S6 and S7):
 * the view reads them over the run's own, nothing is saved and every command still acts on the run.
 */
export type ViewFixture = Partial<
  Pick<
    SessionView,
    'ref' | 'hud' | 'canUndo' | 'status' | 'summary' | 'continueState' | 'loseReasonKey'
  >
>;

/** The controller's extras the view reads besides the session. */
export type ViewExtras<TMove> = {
  readonly summary: RunSummary | null;
  readonly hint: { readonly move: TMove; readonly atSeq: number } | null;
  readonly fixture: ViewFixture | null;
};

/** The game's parts the view needs (the controller's dependencies fit). */
export type ViewDeps<TState, TMove, TEvent> = {
  readonly rules: SessionRules<TState, TMove, TEvent>;
  readonly gameRules: GameRules<TState, TMove, TEvent>;
  readonly entry: LevelEntry | null;
  readonly isContinueAllowed: boolean;
};

function playedViewOf<TState, TMove, TEvent>(
  deps: ViewDeps<TState, TMove, TEvent>,
  session: GameSession<TState, TMove, TEvent>,
  extras: ViewExtras<TMove>,
): SessionView {
  const { ref, moveCount, status, outcome } = session;
  return {
    status,
    ref,
    hud: hudView({ ref, moveCount, hud: deps.gameRules.hud(session.state), entry: deps.entry }),
    moveCount,
    isUndoSupported: deps.gameRules.undo.kind !== 'none',
    canUndo: canUndo(deps.rules, session),
    isHintSupported: deps.gameRules.hints.kind === 'solver',
    isHintShown: extras.hint !== null && extras.hint.atSeq === session.eventSeq,
    continueState: continueStateOf(deps.gameRules.continueRun, deps.isContinueAllowed, session),
    loseReasonKey: outcome.kind === 'lost' ? outcome.reasonKey : null,
    summary: extras.summary,
    eventSeq: session.eventSeq,
  };
}

/** The run's view; a test build's fixture numbers win over the played ones. */
export function sessionViewOf<TState, TMove, TEvent>(
  deps: ViewDeps<TState, TMove, TEvent>,
  session: GameSession<TState, TMove, TEvent>,
  extras: ViewExtras<TMove>,
): SessionView {
  const played = playedViewOf(deps, session, extras);
  return extras.fixture === null ? played : { ...played, ...extras.fixture };
}
