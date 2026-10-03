// apps/line-siege/src/line-siege-types.ts
import type { BoardToken } from '@e07/line-siege/board/board-palettes.ts';
import type { LineSiegeView } from '@e07/line-siege/board/to-view.ts';
import type {
  LineSiegeEvent,
  LineSiegeMove,
  LineSiegeState,
} from '@e07/line-siege/rules/line-siege-types.ts';

/** The one place the game names its types for the Shell (ShellGameTypes). */
export type LineSiegeTypes = {
  readonly state: LineSiegeState;
  readonly move: LineSiegeMove;
  readonly event: LineSiegeEvent;
  readonly view: LineSiegeView;
  readonly token: BoardToken;
  /** Turn-based games: never. A real-time game names its typed-array sim here. */
  readonly sim: never;
};
