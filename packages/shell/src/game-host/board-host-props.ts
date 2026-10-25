// packages/shell/src/game-host/board-host-props.ts
import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';

/** What a screen hands one run's board host (the Game screen and the Tutorial route). */
export type BoardHostProps = {
  readonly testID: string;
  /**
   * The Tutorial step's pointer (null: none now; the Game screen leaves it out). The board host
   * resolves it through the game at the current state (boardCoachOf): the slot and every cell the
   * move fills are marked with the hinted ones, and the pointing hand is drawn.
   */
  readonly coachPointer?: TutorialPointer | null;
  /** Grows with each try the Tutorial step refused: the pointing hand then plays again. */
  readonly coachReplay?: number;
};
