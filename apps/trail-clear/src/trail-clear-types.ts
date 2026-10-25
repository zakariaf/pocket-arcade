// apps/trail-clear/src/trail-clear-types.ts
import type { BoardToken } from '@e07/trail-clear/board/board-palettes.ts';
import type { TrailClearView } from '@e07/trail-clear/board/to-view.ts';
import type {
  TrailClearEvent,
  TrailClearMove,
  TrailClearState,
} from '@e07/trail-clear/rules/trail-clear-types.ts';

/** The one place the game names its types for the Shell (ShellGameTypes). */
export type TrailClearTypes = {
  readonly state: TrailClearState;
  readonly move: TrailClearMove;
  readonly event: TrailClearEvent;
  readonly view: TrailClearView;
  readonly token: BoardToken;
  /** Turn-based games: never. A real-time game names its typed-array sim here. */
  readonly sim: never;
};
