// packages/shell/src/game-host/tutorial-script.ts
// The game's teaching as the Shell uses it (spec S13): which move each tutorial step accepts, the
// steps and the how-to-play pages as plain data for the Tutorial route and S13 (the typed moves
// and example states stay inside the game host's seam).
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { MessageId } from '@e07/game-kit/contract/messages.ts';
import type {
  HowToPlayStep,
  TutorialPointer,
  TutorialStep,
} from '@e07/game-kit/contract/teaching.ts';

/** One coach step as the Tutorial screen sees it: one sentence and one pointer, no game types. */
export type TutorialCoachStep = {
  readonly messageId: MessageId;
  readonly pointer: TutorialPointer;
};

/** The game's tutorial steps without their typed expected moves. */
export function coachStepsOf<TMove>(
  steps: readonly TutorialStep<TMove>[],
): readonly TutorialCoachStep[] {
  return steps.map((step) => ({ messageId: step.messageId, pointer: step.pointer }));
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/** Structural equality of two plain-data moves (the rules build moves as JSON-like data). */
export function isSameMove(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, i) => isSameMove(item, right[i]));
  }
  if (isRecord(left) && isRecord(right) && !Array.isArray(left) && !Array.isArray(right)) {
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every((key) => isSameMove(left[key], right[key]))
    );
  }
  return Object.is(left, right);
}

/**
 * Step `moveCount` of the script accepts only its expected move ('any-move': every legal move);
 * after the last step the run plays freely. Undo goes back one step, so the pointer follows.
 */
export function isTutorialMoveAccepted<TMove>(
  steps: readonly TutorialStep<TMove>[],
  move: TMove,
  moveCount: number,
): boolean {
  const step = steps[moveCount];
  if (step === undefined || step.expect.kind === 'any-move') return true;
  return isSameMove(move, step.expect.move);
}

/**
 * Step `moveCount` waits for one exact move (an 'any-move' step and the free play after the script
 * do not): a try it refuses there, a wrong drop or a tap that is no move, earns the coach's nudge.
 */
export function expectsScriptedMove<TMove>(
  steps: readonly TutorialStep<TMove>[],
  moveCount: number,
): boolean {
  return steps[moveCount]?.expect.kind === 'move';
}

/**
 * Whether an intent the step did not play is a try it refused: any intent that became a move (the
 * wrong one), or a press on a board cell (tap, long-press) that is no move. A drag, swipe or aim
 * that is no move (let go off the board, dropped back on its own cell) is cancelled, never a try.
 */
export function isTutorialTry(intent: InputIntent, move: unknown): boolean {
  return move !== null || intent.kind === 'tap' || intent.kind === 'long-press';
}

/** What a tutorial run's controller gets from the script (session-controller.ts). */
export type TutorialRules<TMove> = {
  readonly isMoveAccepted: (move: TMove, moveCount: number) => boolean;
  readonly expectsMove: (moveCount: number) => boolean;
  /** isTutorialTry: whether an intent the step did not play counts as a refused try. */
  readonly isTry: (intent: InputIntent, move: TMove | null) => boolean;
};

export function tutorialRulesOf<TMove>(
  steps: readonly TutorialStep<TMove>[],
): TutorialRules<TMove> {
  return {
    isMoveAccepted: (move, moveCount) => isTutorialMoveAccepted(steps, move, moveCount),
    expectsMove: (moveCount) => expectsScriptedMove(steps, moveCount),
    isTry: isTutorialTry,
  };
}

/** One S13 page as screens see it: the goal line and the step sentence, as catalog keys. */
export type HowToPlayPage = {
  readonly titleId: MessageId;
  readonly bodyId: MessageId;
};

/** The game's how-to-play pages without their typed example states. */
export function howToPlayPagesOf<TState>(
  pages: readonly HowToPlayStep<TState>[],
): readonly HowToPlayPage[] {
  return pages.map((page) => ({ titleId: page.titleId, bodyId: page.bodyId }));
}
