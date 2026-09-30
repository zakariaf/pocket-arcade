// packages/shell/src/game-host/open-session.ts
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { startGameSession } from '@e07/shell/game-host/game-session-reducer.ts';
import { restoreRun } from '@e07/shell/game-host/saved-run.ts';

import type { LevelEntry } from '@e07/game-kit/contract/levels.ts';
import type { GameSession, SessionRules } from '@e07/shell/game-host/game-session-types.ts';
import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { RunRef, SaveRun } from '@e07/shell/services/save/schema/save-doc.ts';

/** How the Game screen opens a run: the same shape as the Game route params. */
export type SessionOpen =
  { readonly start: 'resume' } | { readonly start: 'new'; readonly ref: RunRef };

type Rules<T extends ShellGameTypes> = SessionRules<T['state'], T['move'], T['event']>;
type Session<T extends ShellGameTypes> = GameSession<T['state'], T['move'], T['event']>;

/** The reducer's view of the game; a tutorial run starts from the scripted tutorial state. */
export function sessionRulesFor<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  ref: RunRef,
): Rules<T> {
  const { create, applyMove, outcome } = game.engine;
  const { undo, continueRun } = game.rules;
  const tutorialStart = game.teaching.tutorial.start;
  return {
    create: ref.kind === 'tutorial' ? () => tutorialStart : create,
    applyMove,
    outcome,
    undo,
    continueRun,
  };
}

/** The table entry of a level run (seed, difficulty, stars); null for every other kind. */
export function entryFor<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  ref: RunRef,
): LevelEntry | null {
  if (ref.kind !== 'level') return null;
  return game.levels.table.find((entry) => entry.level === ref.level) ?? null;
}

/** Seed and difficulty of a new run, or null when the game has no such run. */
export function startFor<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  ref: RunRef,
  newSeed: () => number,
): { readonly seed: number; readonly difficulty: number } | null {
  switch (ref.kind) {
    case 'level':
      return entryFor(game, ref);
    case 'daily':
      return dailyStart(game.levels, ref.date);
    case 'endless':
      return game.levels.endless.kind === 'endless'
        ? { seed: newSeed(), difficulty: game.levels.endless.difficulty }
        : null;
    case 'tutorial':
      return { seed: 0, difficulty: 0 };
  }
}

/** A new run for `ref` (spec S5, S8, S9); null for a level or mode the game does not have. */
export function newSession<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  ref: RunRef,
  newSeed: () => number,
): Session<T> | null {
  const start = startFor(game, ref, newSeed);
  if (start === null) return null;
  return startGameSession(sessionRulesFor(game, ref), { ref, ...start });
}

/**
 * The saved run, validated by the game's own parsers and replayed for its undo history. A run
 * the game cannot read is dropped alone (spec 8.6, S14); a replay that does not reproduce the
 * snapshot keeps the position, drops the undo history and is written to the error log.
 */
export function resumeSession<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  saved: SaveRun,
  errorLog: ErrorLogPort,
): Session<T> | null {
  const restored = restoreRun(sessionRulesFor(game, saved.ref), game.persistence, saved);
  if (restored.kind === 'dropped') {
    errorLog.record('save', new Error(`saved run dropped: ${restored.reason}`));
    return null;
  }
  if (!restored.hasHistory && saved.log.length > 0) {
    errorLog.record(
      'save',
      new Error('saved run replay differs from its snapshot; undo history dropped'),
    );
  }
  return restored.session;
}
