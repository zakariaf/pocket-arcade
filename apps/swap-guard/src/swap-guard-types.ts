// apps/swap-guard/src/swap-guard-types.ts
import type { BoardToken } from '@e07/swap-guard/board/board-palettes.ts';
import type { SwapGuardView } from '@e07/swap-guard/board/to-view.ts';
import type {
  SwapGuardEvent,
  SwapGuardMove,
  SwapGuardState,
} from '@e07/swap-guard/rules/swap-guard-types.ts';

/** The one place the game names its types for the Shell (ShellGameTypes). */
export type SwapGuardTypes = {
  readonly state: SwapGuardState;
  readonly move: SwapGuardMove;
  readonly event: SwapGuardEvent;
  readonly view: SwapGuardView;
  readonly token: BoardToken;
  /** Turn-based games: never. A real-time game names its typed-array sim here. */
  readonly sim: never;
};
