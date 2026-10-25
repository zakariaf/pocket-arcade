// apps/merge-siege/src/merge-siege-types.ts
import type { BoardToken } from '@e07/merge-siege/board/board-palettes.ts';
import type { MergeSiegeView } from '@e07/merge-siege/board/to-view.ts';
import type {
  MergeSiegeEvent,
  MergeSiegeMove,
  MergeSiegeState,
} from '@e07/merge-siege/rules/merge-siege-types.ts';

/** The one place the game names its types for the Shell (ShellGameTypes). */
export type MergeSiegeTypes = {
  readonly state: MergeSiegeState;
  readonly move: MergeSiegeMove;
  readonly event: MergeSiegeEvent;
  readonly view: MergeSiegeView;
  readonly token: BoardToken;
  /** Turn-based games: never. A real-time game names its typed-array sim here. */
  readonly sim: never;
};
