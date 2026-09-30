// apps/__GAME_ID__/src/__GAME_ID__-types.ts
import type { BoardToken } from '@e07/__GAME_ID__/board/board-palettes.ts';
import type { __GAME_PASCAL__View } from '@e07/__GAME_ID__/board/to-view.ts';
import type {
  __GAME_PASCAL__Event,
  __GAME_PASCAL__Move,
  __GAME_PASCAL__State,
} from '@e07/__GAME_ID__/rules/__GAME_ID__-types.ts';

/** The one place the game names its types for the Shell (ShellGameTypes). */
export type __GAME_PASCAL__Types = {
  readonly state: __GAME_PASCAL__State;
  readonly move: __GAME_PASCAL__Move;
  readonly event: __GAME_PASCAL__Event;
  readonly view: __GAME_PASCAL__View;
  readonly token: BoardToken;
  /** Turn-based games: never. A real-time game names its typed-array sim here. */
  readonly sim: never;
};
