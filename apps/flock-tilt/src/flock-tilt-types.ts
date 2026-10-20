// apps/flock-tilt/src/flock-tilt-types.ts
import type { BoardToken } from '@e07/flock-tilt/board/board-palettes.ts';
import type { FlockTiltView } from '@e07/flock-tilt/board/to-view.ts';
import type {
  FlockTiltEvent,
  FlockTiltMove,
  FlockTiltState,
} from '@e07/flock-tilt/rules/flock-tilt-types.ts';

/** The one place the game names its types for the Shell (ShellGameTypes). */
export type FlockTiltTypes = {
  readonly state: FlockTiltState;
  readonly move: FlockTiltMove;
  readonly event: FlockTiltEvent;
  readonly view: FlockTiltView;
  readonly token: BoardToken;
  /** Turn-based games: never. A real-time game names its typed-array sim here. */
  readonly sim: never;
};
