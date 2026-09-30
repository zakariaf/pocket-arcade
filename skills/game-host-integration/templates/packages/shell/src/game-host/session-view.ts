// packages/shell/src/game-host/session-view.ts
import type { ContinuePolicy } from '@e07/game-kit/contract/game-rules.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { GameSession, SessionStatus } from '@e07/shell/game-host/game-session-types.ts';
import type { HudView } from '@e07/shell/game-host/hud-model.ts';
import type { RunSummary } from '@e07/shell/game-host/run-summary.ts';
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';

/** Spec 8.10 on the lose screen: never offered, offered now, or already used this run. */
export type ContinueState = 'none' | 'offered' | 'used';

/** Everything Shell screens may know about the active run: plain data, no game types. */
export type SessionView = {
  readonly status: SessionStatus;
  readonly ref: RunRef;
  readonly hud: HudView;
  readonly moveCount: number;
  /** The game has undo at all (the top bar leaves the tool out otherwise). */
  readonly isUndoSupported: boolean;
  /** An undo is possible right now (the tool is disabled otherwise). */
  readonly canUndo: boolean;
  /** The game offers solver hints (the price comes from the ads layer's perkOffer). */
  readonly isHintSupported: boolean;
  /** A hint is being shown for the current position (the board highlights the move). */
  readonly isHintShown: boolean;
  readonly continueState: ContinueState;
  /** The game's catalog key for the loss while the run is lost, else null. */
  readonly loseReasonKey: string | null;
  /** Set once the run is recorded (won, or lost with no continue left); S7 shows it. */
  readonly summary: RunSummary | null;
  /** Changes with every applied, undone or continued move (the board presents a new scene). */
  readonly eventSeq: number;
};

/** What screens and the board send. Paid perks (hint, continue) are sent only after payment. */
export type SessionCommand =
  | { readonly type: 'intent'; readonly intent: InputIntent }
  | { readonly type: 'undo' }
  | { readonly type: 'hint' }
  | { readonly type: 'continue' }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  /**
   * The player declined the continue (Try again, Levels, Home): record the pending loss. It also
   * ends a tutorial run (Skip, or the last step's continue): the run is cleared, nothing counted.
   */
  | { readonly type: 'finish' }
  /** Pause -> Home: the run stays saved, but a relaunch lands on Home. */
  | { readonly type: 'leave' };

/** The type-erased session a Game screen holds (subscribe + getView fit useSyncExternalStore). */
export type SessionHandle = {
  readonly getView: () => SessionView;
  readonly subscribe: (listener: () => void) => () => void;
  readonly send: (command: SessionCommand) => void;
};

/** Whether the one continue is on the table (spec 8.10: once per run, only after a loss). */
export function continueStateOf<TState, TMove, TEvent>(
  policy: ContinuePolicy<TState, TEvent>,
  isContinueAllowed: boolean,
  session: Pick<GameSession<TState, TMove, TEvent>, 'status' | 'continuesUsed'>,
): ContinueState {
  if (!isContinueAllowed || policy.kind === 'none') return 'none';
  if (session.continuesUsed > 0) return 'used';
  return session.status === 'lost' ? 'offered' : 'none';
}
