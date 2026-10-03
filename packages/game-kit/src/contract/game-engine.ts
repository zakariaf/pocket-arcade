// packages/game-kit/src/contract/game-engine.ts
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';

/** Result of outcome(): still playing, won with a score, or lost with a catalog reason key. */
export type Outcome =
  | { readonly kind: 'playing' }
  | { readonly kind: 'won'; readonly score: number }
  | { readonly kind: 'lost'; readonly reasonKey: string };

/**
 * Which pan gesture the board turns into an intent; taps and long presses always work.
 * 'none': tap-only boards (Tap Flip, Scrap Shove); 'swipe': one flick is one move (Flock Tilt);
 * 'drag': press on a region, release on another (Line Siege); 'aim': the release vector (Bank Shot).
 * Real-time games steer with the stick gesture instead and declare 'none'.
 */
export type PanMode = 'none' | 'swipe' | 'drag' | 'aim';

/** applyMove() returns the next state plus the events that explain it (for timeline and sound). */
export type ApplyResult<TState, TEvent> = {
  readonly state: TState;
  readonly events: readonly TEvent[];
};

/**
 * The engine members of GameModule (packages/game-kit/src/contract). The functions are pure, run on
 * the JS thread and obey the determinism policy; panMode is plain data. Names are canonical: never
 * rename them.
 */
export type GameEngine<TState, TMove, TEvent> = {
  readonly create: (seed: number, difficulty: number) => TState;
  readonly listMoves: (state: TState) => readonly TMove[];
  readonly applyMove: (state: TState, move: TMove) => ApplyResult<TState, TEvent>;
  readonly outcome: (state: TState) => Outcome;
  /** The board's pan gesture (spec 10, board: taps to moves); the Shell's board host reads it. */
  readonly panMode: PanMode;
  /**
   * Regions whose taps select instead of act (Line Siege: ['tray']; most games: []). The board
   * host keeps the selection as UI state and passes it on the next tap as `intent.selected`;
   * intentToMove returns null for a tap inside these regions.
   */
  readonly selectRegions: readonly string[];
  readonly intentToMove: (state: TState, intent: InputIntent) => TMove | null;
  readonly buildTimeline: (events: readonly TEvent[], motion: Motion) => readonly Track[];
};
