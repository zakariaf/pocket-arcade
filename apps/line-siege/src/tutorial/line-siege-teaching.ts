// apps/line-siege/src/tutorial/line-siege-teaching.ts
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { create } from '@e07/line-siege/rules/create.ts';

import type { TeachingSpec } from '@e07/game-kit/contract/teaching.ts';
import type { LineSiegeMove, LineSiegeState } from '@e07/line-siege/rules/line-siege-types.ts';

/** Seed 1, difficulty 0: column 7 lacks rows 3 and 4, and slot 1 holds the vertical two. */
const TUTORIAL_START = create(1, 0);
const FILL_COLUMN: LineSiegeMove = { kind: 'place-block', trayIndex: 1, col: 7, row: 3 };
const AFTER_BEAM = applyMove(TUTORIAL_START, FILL_COLUMN).state;
const SLOT_ONE = { regionId: 'tray', col: 1, row: 0 } as const;
const COLUMN_GAP = { regionId: 'board', col: 7, row: 3 } as const;
const GOAL_ID = 'line-siege.goal';

/** Spec S13: one short sentence per step, one pointer, one expected action; Skip from step 2. */
export const LINE_SIEGE_TEACHING: TeachingSpec<LineSiegeState, LineSiegeMove> = {
  tutorial: {
    start: TUTORIAL_START,
    steps: [
      {
        messageId: 'line-siege.tutorial.step-1',
        pointer: { kind: 'drag', from: SLOT_ONE, to: COLUMN_GAP },
        expect: { kind: 'move', move: FILL_COLUMN },
      },
      {
        messageId: 'line-siege.tutorial.step-2',
        pointer: { kind: 'none' },
        expect: { kind: 'any-move' },
      },
      {
        messageId: 'line-siege.tutorial.step-3',
        pointer: { kind: 'none' },
        expect: { kind: 'any-move' },
      },
      {
        messageId: 'line-siege.tutorial.step-4',
        pointer: { kind: 'none' },
        expect: { kind: 'any-move' },
      },
    ],
  },
  howToPlay: [
    {
      titleId: GOAL_ID,
      bodyId: 'line-siege.how-to-play.step-1',
      example: TUTORIAL_START,
      pointer: { kind: 'drag', from: SLOT_ONE, to: COLUMN_GAP },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'line-siege.how-to-play.step-2',
      example: TUTORIAL_START,
      pointer: { kind: 'target', target: COLUMN_GAP },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'line-siege.how-to-play.step-3',
      example: AFTER_BEAM,
      pointer: { kind: 'none' },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'line-siege.how-to-play.step-4',
      example: AFTER_BEAM,
      pointer: { kind: 'none' },
    },
  ],
};
