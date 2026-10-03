// packages/shell/src/game-host/saved-run.ts
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type {
  GameSession,
  RunLogEntry,
  SessionRules,
} from '@e07/shell/game-host/game-session-types.ts';
import type { SaveRun } from '@e07/shell/services/save/schema/save-doc.ts';

/** Session -> the `run` section. `past` is not stored: it is rebuilt by replaying `log`. */
export function toSavedRun<TState, TMove, TEvent>(
  session: GameSession<TState, TMove, TEvent>,
  stateVersion: number,
  shouldResumeOnLaunch: boolean,
): SaveRun {
  const {
    ref,
    seed,
    difficulty,
    state,
    log,
    moveCount,
    undoCount,
    hintsUsed,
    continuesUsed,
    playMs,
  } = session;
  return {
    ref,
    seed,
    difficulty,
    stateVersion,
    state,
    log,
    moveCount,
    undoCount,
    hintsUsed,
    continuesUsed,
    playMs,
    resumeOnLaunch: shouldResumeOnLaunch,
  };
}

export type RestoredRun<TState, TMove, TEvent> =
  | {
      readonly kind: 'restored';
      readonly session: GameSession<TState, TMove, TEvent>;
      readonly hasHistory: boolean;
    }
  | { readonly kind: 'dropped'; readonly reason: 'state-invalid' | 'state-not-migratable' };

function parseLog<TState, TMove>(
  persistence: PersistenceSpec<TState, TMove>,
  saved: SaveRun,
): readonly RunLogEntry<TMove>[] | null {
  const log: RunLogEntry<TMove>[] = [];
  for (const entry of saved.log) {
    if (entry.kind === 'continue') {
      log.push(entry);
      continue;
    }
    const move = persistence.parseMove(entry.move);
    if (move === null) return null;
    log.push({ kind: 'move', move });
  }
  return log;
}

/** Re-applies the log from create(seed, difficulty). Returns the undo stack and final state. */
function replay<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  saved: SaveRun,
  log: readonly RunLogEntry<TMove>[],
): { readonly past: readonly TState[]; readonly final: TState } {
  let state = rules.create(saved.seed, saved.difficulty);
  let past: TState[] = [];
  for (const entry of log) {
    if (entry.kind === 'move') {
      past = [...past, state];
      state = rules.applyMove(state, entry.move).state;
    } else if (rules.continueRun.kind === 'once') {
      past = [];
      state = rules.continueRun.apply(state).state;
    }
  }
  return { past, final: state };
}

function currentState<TState, TMove>(
  persistence: PersistenceSpec<TState, TMove>,
  saved: SaveRun,
): TState | null {
  return saved.stateVersion === persistence.stateVersion
    ? persistence.parseState(saved.state)
    : persistence.migrateState(saved.state, saved.stateVersion);
}

/**
 * Saved run -> paused session. The snapshot is the truth; replay only rebuilds undo
 * history and must reproduce the snapshot exactly (the determinism policy makes it so).
 */
export function restoreRun<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  persistence: PersistenceSpec<TState, TMove>,
  saved: SaveRun,
): RestoredRun<TState, TMove, TEvent> {
  const state = currentState(persistence, saved);
  if (state === null) {
    const isSameVersion = saved.stateVersion === persistence.stateVersion;
    return { kind: 'dropped', reason: isSameVersion ? 'state-invalid' : 'state-not-migratable' };
  }
  const isSameVersion = saved.stateVersion === persistence.stateVersion;
  const log = isSameVersion ? parseLog(persistence, saved) : null;
  const replayed = log === null ? null : replay(rules, saved, log);
  const hasHistory = replayed !== null && JSON.stringify(replayed.final) === JSON.stringify(state);
  const outcome = rules.outcome(state);
  const session: GameSession<TState, TMove, TEvent> = {
    ref: saved.ref,
    seed: saved.seed,
    difficulty: saved.difficulty,
    state,
    past: hasHistory ? replayed.past : [],
    log: hasHistory && log !== null ? log : [],
    status: outcome.kind === 'playing' ? 'paused' : outcome.kind,
    outcome,
    moveCount: saved.moveCount,
    undoCount: saved.undoCount,
    hintsUsed: saved.hintsUsed,
    continuesUsed: saved.continuesUsed,
    playMs: saved.playMs,
    lastEvents: [],
    eventSeq: 0,
  };
  return { kind: 'restored', session, hasHistory };
}
