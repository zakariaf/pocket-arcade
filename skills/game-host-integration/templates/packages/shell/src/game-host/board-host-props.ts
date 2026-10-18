// packages/shell/src/game-host/board-host-props.ts
import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** What a screen hands one run's board host (the Game screen and the Tutorial route). */
export type BoardHostProps = {
  readonly testID: string;
  /** The Tutorial screen's pointer cells, outlined on the board with the hinted ones. */
  readonly coachTargets?: readonly BoardTarget[];
  /**
   * The Tutorial step's pointer (null: none now). The board host resolves it through the game at
   * the current state (coachPointerOf): the slot and every cell the move fills are marked, and the
   * pointing hand is drawn; when it is left out, coachTargets are outlined as given.
   */
  readonly coachPointer?: TutorialPointer | null;
  /** Grows with each try the Tutorial step refused: the pointing hand then plays again. */
  readonly coachReplay?: number;
};
