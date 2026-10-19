// packages/shell/src/screens/first-run/tutorial-coach.ts
// The Tutorial route's coach as plain data (spec S13): which scripted step the run is on, the
// sentence and pointer of that step, whether Skip shows, and when the tutorial is over. Pure, so
// plain Jest proves every stage; use-tutorial-model.ts turns it into texts and actions.
import type { MessageId } from '@e07/game-kit/contract/messages.ts';
import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { SessionView } from '@e07/shell/game-host/session-view.ts';
import type { TutorialCoachStep } from '@e07/shell/game-host/tutorial-script.ts';

/** 'step': the script waits for its move; 'paused': the run is paused; 'done': the script is over. */
export type TutorialStage = 'step' | 'paused' | 'done';

export type TutorialCoach = {
  readonly stage: TutorialStage;
  /** 0-based index of the step on screen (the last step once the script is over). */
  readonly stepIndex: number;
  /** The game's sentence for this step while the stage is 'step', else null. */
  readonly messageId: MessageId | null;
  /**
   * The step's own pointer while the stage is 'step', else null: the board host resolves it
   * through the game (coachPointerOf) into the cells it marks and the pointing hand.
   */
  readonly pointer: TutorialPointer | null;
  /** Spec S13: no Skip before the second step, and none once the tutorial is over. */
  readonly isSkipShown: boolean;
};

function stageOf(steps: readonly TutorialCoachStep[], view: SessionView | null): TutorialStage {
  if (view === null || view.status === 'won' || view.status === 'lost') return 'done';
  if (view.moveCount >= steps.length) return 'done';
  return view.status === 'paused' ? 'paused' : 'step';
}

/**
 * The coach for the tutorial run's current view. Each applied move is one step (the game host
 * accepts only the step's expected move); no run to show (view null) counts as over, so the
 * player can always leave the FirstRun group.
 */
export function tutorialCoachOf(
  steps: readonly TutorialCoachStep[],
  view: SessionView | null,
): TutorialCoach {
  const stage = stageOf(steps, view);
  const moveCount = view?.moveCount ?? 0;
  const stepIndex = Math.max(0, Math.min(moveCount, steps.length - 1));
  const step = stage === 'step' ? steps[stepIndex] : undefined;
  return {
    stage,
    stepIndex,
    messageId: step?.messageId ?? null,
    pointer: step?.pointer ?? null,
    isSkipShown: stage !== 'done' && moveCount >= 1,
  };
}
