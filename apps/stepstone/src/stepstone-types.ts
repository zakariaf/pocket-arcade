// apps/stepstone/src/stepstone-types.ts
import type { BoardToken } from '@e07/stepstone/board/board-palettes.ts';
import type { StepstoneView } from '@e07/stepstone/board/to-view.ts';
import type {
  StepstoneEvent,
  StepstoneMove,
  StepstoneState,
} from '@e07/stepstone/rules/stepstone-types.ts';

/** The one place the game names its types for the Shell (ShellGameTypes). */
export type StepstoneTypes = {
  readonly state: StepstoneState;
  readonly move: StepstoneMove;
  readonly event: StepstoneEvent;
  readonly view: StepstoneView;
  readonly token: BoardToken;
  /** Turn-based games: never. A real-time game names its typed-array sim here. */
  readonly sim: never;
};
