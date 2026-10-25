// apps/poker-drop/src/poker-drop-types.ts
import type { BoardToken } from '@e07/poker-drop/board/board-palettes.ts';
import type { PokerDropView } from '@e07/poker-drop/board/to-view.ts';
import type {
  PokerDropEvent,
  PokerDropMove,
  PokerDropState,
} from '@e07/poker-drop/rules/poker-drop-types.ts';

/** The one place the game names its types for the Shell (ShellGameTypes). */
export type PokerDropTypes = {
  readonly state: PokerDropState;
  readonly move: PokerDropMove;
  readonly event: PokerDropEvent;
  readonly view: PokerDropView;
  readonly token: BoardToken;
  /** Turn-based games: never. A real-time game names its typed-array sim here. */
  readonly sim: never;
};
