// apps/toggle-drop/src/toggle-drop-types.ts
import type { BoardToken } from '@e07/toggle-drop/board/board-palettes.ts';
import type { ToggleDropView } from '@e07/toggle-drop/board/to-view.ts';
import type {
  ToggleDropEvent,
  ToggleDropMove,
  ToggleDropState,
} from '@e07/toggle-drop/rules/toggle-drop-types.ts';

/** The one place the game names its types for the Shell (ShellGameTypes). */
export type ToggleDropTypes = {
  readonly state: ToggleDropState;
  readonly move: ToggleDropMove;
  readonly event: ToggleDropEvent;
  readonly view: ToggleDropView;
  readonly token: BoardToken;
  /** Turn-based games: never. A real-time game names its typed-array sim here. */
  readonly sim: never;
};
