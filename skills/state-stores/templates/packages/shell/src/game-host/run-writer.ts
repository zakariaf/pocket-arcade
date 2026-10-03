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

/** Where a run is written: the save, and the game's persistence (its state version). */
export type RunTarget<TState, TMove> = {
  readonly save: SaveService;
  readonly persistence: PersistenceSpec<TState, TMove>;
};

/**
 * The one writer of the save's `run` section (current slot only): every new, changed, offered or
 * left run goes through it. shouldResumeOnLaunch false: a relaunch lands on Home, not on the run.
 */
export function writeRun<TState, TMove, TEvent>(
  target: RunTarget<TState, TMove>,
  session: GameSession<TState, TMove, TEvent>,
  shouldResumeOnLaunch: boolean,
): void {
  const run = toSavedRun(session, target.persistence.stateVersion, shouldResumeOnLaunch);
  target.save.update((doc) => ({ ...doc, run }));
}

/** The persist callback for createGameSessionStore: the run is on disk before it animates. */
export function createRunWriter<TState, TMove, TEvent>(
  save: SaveService,
  persistence: PersistenceSpec<TState, TMove>,
): PersistSession<TState, TMove, TEvent> {
  return (session, action) => {
    if (!shouldWriteRun(action, persistence.savePolicy, session.status)) return;
    writeRun({ save, persistence }, session, true);
  };
}

/** Pause -> Home keeps the run but a relaunch lands on Home (resumeOnLaunch false). */
export function writeRunForHome<TState, TMove, TEvent>(
  save: SaveService,
  persistence: PersistenceSpec<TState, TMove>,
  session: GameSession<TState, TMove, TEvent>,
): void {
  writeRun({ save, persistence }, session, false);
}
