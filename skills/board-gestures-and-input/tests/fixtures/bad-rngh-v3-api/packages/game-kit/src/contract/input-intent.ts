// packages/game-kit/src/contract/input-intent.ts
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { SwipeDirection } from '@e07/game-kit/geom/classify-swipe.ts';

/**
 * What the player did, in board terms. Produced on the UI thread by useBoardGestures,
 * delivered to JS with scheduleOnRN, turned into a Move by the game's intentToMove().
 *
 * A tap carries the board's current selection: the target of an earlier tap inside one of the
 * engine's selectRegions (Line Siege: a tray slot), or null. The selection is UI state kept by the
 * board host, never game state and never a move, so bots, solvers, par, undo and the move
 * counters never see it. The gesture layer always sends `selected: null`; the host fills it in.
 */
export type InputIntent =
  | { readonly kind: 'tap'; readonly target: BoardTarget; readonly selected: BoardTarget | null }
  | { readonly kind: 'long-press'; readonly target: BoardTarget }
  | {
      readonly kind: 'swipe';
      readonly direction: SwipeDirection;
      readonly from: BoardTarget | null;
    }
  | { readonly kind: 'drag-end'; readonly from: BoardTarget; readonly to: BoardTarget | null }
  /** Release vector of an aim drag, in canvas points (Bank Shot). */
  | { readonly kind: 'aim'; readonly dx: number; readonly dy: number };
