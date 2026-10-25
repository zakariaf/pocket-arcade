// apps/snare-snake/src/snare-snake-types.ts
import type { BoardToken } from '@e07/snare-snake/board/board-palettes.ts';
import type { SnareSnakeView } from '@e07/snare-snake/board/to-view.ts';
import type {
  SnareSnakeEvent,
  SnareSnakeMove,
  SnareSnakeState,
} from '@e07/snare-snake/rules/snare-snake-types.ts';

/** The one place the game names its types for the Shell (ShellGameTypes). */
export type SnareSnakeTypes = {
  readonly state: SnareSnakeState;
  readonly move: SnareSnakeMove;
  readonly event: SnareSnakeEvent;
  readonly view: SnareSnakeView;
  readonly token: BoardToken;
  /** Turn-based games: never. A real-time game names its typed-array sim here. */
  readonly sim: never;
};
