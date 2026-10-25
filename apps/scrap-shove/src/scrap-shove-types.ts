// apps/scrap-shove/src/scrap-shove-types.ts
import type { BoardToken } from '@e07/scrap-shove/board/board-palettes.ts';
import type { ScrapShoveView } from '@e07/scrap-shove/board/to-view.ts';
import type {
  ScrapShoveEvent,
  ScrapShoveMove,
  ScrapShoveState,
} from '@e07/scrap-shove/rules/scrap-shove-types.ts';

/** The one place the game names its types for the Shell (ShellGameTypes). */
export type ScrapShoveTypes = {
  readonly state: ScrapShoveState;
  readonly move: ScrapShoveMove;
  readonly event: ScrapShoveEvent;
  readonly view: ScrapShoveView;
  readonly token: BoardToken;
  /** Turn-based games: never. A real-time game names its typed-array sim here. */
  readonly sim: never;
};
