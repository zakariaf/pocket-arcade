// apps/jump-chain/src/jump-chain-types.ts
import type { BoardToken } from '@e07/jump-chain/board/board-palettes.ts';
import type { JumpChainView } from '@e07/jump-chain/board/to-view.ts';
import type {
  JumpChainEvent,
  JumpChainMove,
  JumpChainState,
} from '@e07/jump-chain/rules/jump-chain-types.ts';

/** The one place the game names its types for the Shell (ShellGameTypes). */
export type JumpChainTypes = {
  readonly state: JumpChainState;
  readonly move: JumpChainMove;
  readonly event: JumpChainEvent;
  readonly view: JumpChainView;
  readonly token: BoardToken;
  /** Turn-based games: never. A real-time game names its typed-array sim here. */
  readonly sim: never;
};
