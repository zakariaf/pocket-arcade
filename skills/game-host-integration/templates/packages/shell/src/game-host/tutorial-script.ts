// packages/shell/src/game-host/tutorial-script.ts
// The game's teaching as the Shell uses it (spec S13): which move each tutorial step accepts, the
// steps and the how-to-play pages as plain data for the Tutorial route and S13 (the typed moves
// and example states stay inside the game host's seam), and the cells a pointer names.
import type { MessageId } from '@e07/game-kit/contract/messages.ts';
import type {
  HowToPlayStep,
  TutorialPointer,
  TutorialStep,
} from '@e07/game-kit/contract/teaching.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { BoardHighlight } from '@e07/shell/game-host/board-types.ts';

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

const NO_TARGETS: readonly BoardTarget[] = [];

/** The board cells a pointer names: its target, both ends of a drag, none for the top bar. */
export function pointerTargets(pointer: TutorialPointer): readonly BoardTarget[] {
  switch (pointer.kind) {
    case 'target':
      return [pointer.target];
    case 'drag':
      return [pointer.from, pointer.to];
    case 'hud':
    case 'none':
      return NO_TARGETS;
  }
}

/** An S13 picture outlines the page's pointer cells like a hinted move; nothing is selected. */
export function exampleHighlightOf(pointer: TutorialPointer): BoardHighlight {
  return { selected: null, hinted: pointerTargets(pointer) };
}
