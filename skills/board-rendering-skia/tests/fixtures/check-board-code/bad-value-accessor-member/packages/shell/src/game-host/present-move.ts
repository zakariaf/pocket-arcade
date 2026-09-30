// packages/shell/src/game-host/present-move.ts

import { makeScene } from './board-scene.ts';

import type { CueScheduler } from './cue-scheduler.ts';
import type { BoardClock } from './use-board-clock.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';

export type PresenterDeps<TState, TEvent, TView> = {
  /** board.toView with the Shell's ViewFormat already applied. */
  readonly toView: (state: TState) => TView;
  /** The game's buildTimeline (GameModule). */
  readonly buildTimeline: (events: readonly TEvent[], motion: Motion) => readonly Track[];
  /** 'reduced' when the Reduce motion setting is on (defaults to the OS setting). */
  readonly motion: Motion;
  readonly clock: Pick<BoardClock<TView>, 'push'>;
  readonly cues: CueScheduler;
};

/** What the GameSession store publishes after it applied AND saved a move. */
export type MoveResult<TState, TEvent> = {
  /** Move counter from the session: becomes the scene's seq. */
  readonly seq: number;
  readonly state: TState;
  readonly events: readonly TEvent[];
};

/**
 * Shows one committed move. The view is always the final state, so a new move simply
 * replaces a running animation (fast-forward); its unfired cues are cancelled first.
 */
export function presentMove<TState, TEvent, TView>(
  deps: PresenterDeps<TState, TEvent, TView>,
  result: MoveResult<TState, TEvent>,
): void {
  deps.cues.cancel();
  const tracks = deps.buildTimeline(result.events, deps.motion);
  deps.clock.push(makeScene(result.seq, deps.toView(result.state), tracks));
  deps.cues.schedule(tracks);
}
