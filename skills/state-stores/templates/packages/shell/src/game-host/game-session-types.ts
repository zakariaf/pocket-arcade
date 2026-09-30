// packages/shell/src/game-host/game-session-types.ts
import type { GameEngine, Outcome } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules } from '@e07/game-kit/contract/game-rules.ts';
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';

export type SessionStatus = 'playing' | 'paused' | 'won' | 'lost';

export type RunLogEntry<TMove> =
  { readonly kind: 'move'; readonly move: TMove } | { readonly kind: 'continue' };

/** One level, daily, endless or tutorial run. Pure data held by a per-session store. */
export type GameSession<TState, TMove, TEvent> = {
  readonly ref: RunRef;
  readonly seed: number;
  readonly difficulty: number;
  readonly state: TState;
  /** States before each undoable move (memory only; rebuilt from `log` after a relaunch). */
  readonly past: readonly TState[];
  readonly log: readonly RunLogEntry<TMove>[];
  readonly status: SessionStatus;
  readonly outcome: Outcome;
  readonly moveCount: number;
  readonly undoCount: number;
  readonly hintsUsed: number;
  readonly continuesUsed: number;
  readonly playMs: number;
  /** Events of the last change; the board host builds a timeline when eventSeq changes. */
  readonly lastEvents: readonly TEvent[];
  readonly eventSeq: number;
};

/** Imperative, kebab-case action names (verb first: apply-move, use-hint). */
export type SessionAction<TMove> =
  | { readonly type: 'apply-move'; readonly move: TMove }
  | { readonly type: 'undo' }
  | { readonly type: 'use-continue' }
  | { readonly type: 'use-hint' }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'add-play-time'; readonly ms: number };

/** The parts of the game module the reducer needs. */
export type SessionRules<TState, TMove, TEvent> = Pick<
  GameEngine<TState, TMove, TEvent>,
  'create' | 'applyMove' | 'outcome'
> &
  Pick<GameRules<TState, TMove, TEvent>, 'undo' | 'continueRun'>;

export type SessionStart = {
  readonly ref: RunRef;
  readonly seed: number;
  readonly difficulty: number;
};
