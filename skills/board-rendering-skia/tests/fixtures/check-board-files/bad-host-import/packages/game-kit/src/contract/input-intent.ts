// packages/game-kit/src/contract/input-intent.ts
// Fixture stand-in for the game-kit contract file (game-rules-engine ships the real one).
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

export type InputIntent =
  | { readonly kind: 'tap'; readonly target: BoardTarget; readonly selected: BoardTarget | null }
  | { readonly kind: 'drag-end'; readonly from: BoardTarget; readonly to: BoardTarget | null };
