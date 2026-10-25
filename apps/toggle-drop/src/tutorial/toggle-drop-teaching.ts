// apps/toggle-drop/src/tutorial/toggle-drop-teaching.ts
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { TUTORIAL_START } from '@e07/toggle-drop/rules/tutorial-board.ts';

import type { TeachingSpec, TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { ToggleDropMove, ToggleDropState } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

const ROWS = TUTORIAL_START.rows;

const dropIn = (col: number): ToggleDropMove => ({ kind: 'drop', col });
/** The hand points at a column's chute: a tap anywhere in the column drops there. */
const chuteOf = (col: number): TutorialPointer => ({
  kind: 'target',
  target: { regionId: 'board', col, row: 0 },
});
/** The how-to-play pages show the goal above each step (S13). */
const GOAL_ID = 'toggle-drop.goal';

const AFTER_FIRST = applyMove(TUTORIAL_START, dropIn(1)).state;
const AFTER_SECOND = applyMove(AFTER_FIRST, dropIn(1)).state;

/**
 * Spec S13: one short sentence per step, one pointer, one expected drop; Skip from step 2. The
 * first drop goes left into the first cup and flips its switch; the same drop then goes the other
 * way, through the second switch, into the last cup on the right; the flipped second switch then
 * sends a drop in column 3 into the middle cup, and every cup is full.
 */
export const TOGGLE_DROP_TEACHING: TeachingSpec<ToggleDropState, ToggleDropMove> = {
  tutorial: {
    start: TUTORIAL_START,
    steps: [
      {
        messageId: 'toggle-drop.tutorial.step-1',
        pointer: chuteOf(1),
        expect: { kind: 'move', move: dropIn(1) },
      },
      {
        messageId: 'toggle-drop.tutorial.step-2',
        pointer: chuteOf(1),
        expect: { kind: 'move', move: dropIn(1) },
      },
      {
        messageId: 'toggle-drop.tutorial.step-3',
        pointer: chuteOf(2),
        expect: { kind: 'move', move: dropIn(2) },
      },
    ],
  },
  howToPlay: [
    {
      titleId: GOAL_ID,
      bodyId: 'toggle-drop.how-to-play.step-1',
      example: TUTORIAL_START,
      pointer: chuteOf(1),
    },
    {
      titleId: GOAL_ID,
      bodyId: 'toggle-drop.how-to-play.step-2',
      example: TUTORIAL_START,
      // The top switch of column 2 (grid row 1: the first peg row under the chutes).
      pointer: { kind: 'target', target: { regionId: 'board', col: 1, row: 1 } },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'toggle-drop.how-to-play.step-3',
      example: AFTER_FIRST,
      pointer: chuteOf(1),
    },
    {
      titleId: GOAL_ID,
      bodyId: 'toggle-drop.how-to-play.step-4',
      example: AFTER_SECOND,
      // The last empty cup (grid row 3: under the two peg rows).
      pointer: { kind: 'target', target: { regionId: 'board', col: 1, row: ROWS + 1 } },
    },
  ],
};
