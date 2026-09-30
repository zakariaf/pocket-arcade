// packages/shell/src/game-host/run-writer.ts
import { toSavedRun } from '@e07/shell/game-host/saved-run.ts';

import type { PersistenceSpec, SavePolicy } from '@e07/game-kit/contract/persistence.ts';
import type { PersistSession } from '@e07/shell/game-host/game-session-store.ts';
import type {
  GameSession,
  SessionAction,
  SessionStatus,
} from '@e07/shell/game-host/game-session-types.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';

const TURN_ACTIONS: ReadonlySet<SessionAction<unknown>['type']> = new Set([
  'apply-move',
  'undo',
  'use-continue',
  'use-hint',
]);

/**
 * When a changed session is written to the save's `run` section (current slot only, never
 * the backup). Won and lost runs are written by the run-end write instead (one update with
 * level result, daily result and statistics, backup refreshed). Play time alone never writes.
 */
export function shouldWriteRun(
  action: SessionAction<unknown>,
  policy: SavePolicy,
  status: SessionStatus,
): boolean {
  if (status === 'won' || status === 'lost') return false;
  if (action.type === 'pause') return true;
  if (policy.kind === 'save-points') return false; // real-time: the host writes at its save points
  return TURN_ACTIONS.has(action.type);
}

/** The persist callback for createGameSessionStore: the run is on disk before it animates. */
export function createRunWriter<TState, TMove, TEvent>(
  save: SaveService,
  persistence: PersistenceSpec<TState, TMove>,
): PersistSession<TState, TMove, TEvent> {
  return (session, action) => {
    if (!shouldWriteRun(action, persistence.savePolicy, session.status)) return;
    const run = toSavedRun(session, persistence.stateVersion, true);
    save.update((doc) => ({ ...doc, run }));
  };
}

/** Pause -> Home keeps the run but a relaunch lands on Home (resumeOnLaunch false). */
export function writeRunForHome<TState, TMove, TEvent>(
  save: SaveService,
  persistence: PersistenceSpec<TState, TMove>,
  session: GameSession<TState, TMove, TEvent>,
): void {
  const run = toSavedRun(session, persistence.stateVersion, false);
  save.update((doc) => ({ ...doc, run }));
}
