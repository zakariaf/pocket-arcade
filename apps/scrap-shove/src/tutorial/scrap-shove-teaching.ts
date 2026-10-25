// apps/scrap-shove/src/tutorial/scrap-shove-teaching.ts
import { applyMove } from '@e07/scrap-shove/rules/apply-move.ts';
import { stateFromText } from '@e07/scrap-shove/rules/board-text.ts';

import type { TeachingSpec, TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { ScrapShoveMove, ScrapShoveState } from '@e07/scrap-shove/rules/scrap-shove-types.ts';

/**
 * The tutorial floor: three robots up on the left, the player on the right beside two heaps.
 * Stepping down-right, then up, brings two robots side by side; the step up-left lets them crash
 * into a new heap, which the player then shoves onto the last robot.
 */
const TUTORIAL_START = stateFromText([
  '........',
  '........',
  '.nn.....',
  '..n.....',
  '........',
  '.....#@.',
  '.....#..',
  '........',
]);
const STEP_AWAY = { kind: 'step', col: 7, row: 6 } as const satisfies ScrapShoveMove;
const STEP_UP = { kind: 'step', col: 7, row: 5 } as const satisfies ScrapShoveMove;
const STEP_ASIDE = { kind: 'step', col: 6, row: 4 } as const satisfies ScrapShoveMove;
const SHOVE_AT_ROBOT = { kind: 'shove', col: 5, row: 4 } as const satisfies ScrapShoveMove;
const GOAL_ID = 'scrap-shove.goal';

const AFTER_AWAY = applyMove(TUTORIAL_START, STEP_AWAY).state;
const AFTER_UP = applyMove(AFTER_AWAY, STEP_UP).state;
const AFTER_CRASH = applyMove(AFTER_UP, STEP_ASIDE).state;

/** The hand on the square a step or shove goes to (the square the player taps). */
function tapOn(move: Extract<ScrapShoveMove, { col: number }>): TutorialPointer {
  return { kind: 'target', target: { regionId: 'board', col: move.col, row: move.row } };
}

/** Spec S13: one short sentence per step, one pointer, one expected action; Skip from step 2. */
export const SCRAP_SHOVE_TEACHING: TeachingSpec<ScrapShoveState, ScrapShoveMove> = {
  tutorial: {
    start: TUTORIAL_START,
    steps: [
      {
        messageId: 'scrap-shove.tutorial.step-1',
        pointer: tapOn(STEP_AWAY),
        expect: { kind: 'move', move: STEP_AWAY },
      },
      {
        messageId: 'scrap-shove.tutorial.step-2',
        pointer: tapOn(STEP_UP),
        expect: { kind: 'move', move: STEP_UP },
      },
      {
        messageId: 'scrap-shove.tutorial.step-3',
        pointer: tapOn(STEP_ASIDE),
        expect: { kind: 'move', move: STEP_ASIDE },
      },
      {
        messageId: 'scrap-shove.tutorial.step-4',
        pointer: tapOn(SHOVE_AT_ROBOT),
        expect: { kind: 'move', move: SHOVE_AT_ROBOT },
      },
    ],
  },
  howToPlay: [
    {
      titleId: GOAL_ID,
      bodyId: 'scrap-shove.how-to-play.step-1',
      example: TUTORIAL_START,
      pointer: tapOn(STEP_AWAY),
    },
    {
      titleId: GOAL_ID,
      bodyId: 'scrap-shove.how-to-play.step-2',
      example: AFTER_CRASH,
      pointer: tapOn(SHOVE_AT_ROBOT),
    },
    {
      titleId: GOAL_ID,
      bodyId: 'scrap-shove.how-to-play.step-3',
      example: AFTER_AWAY,
      pointer: { kind: 'none' },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'scrap-shove.how-to-play.step-4',
      example: AFTER_UP,
      pointer: tapOn(STEP_ASIDE),
    },
  ],
};
