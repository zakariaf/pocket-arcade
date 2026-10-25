// apps/merge-siege/src/tutorial/merge-siege-teaching.ts
// The scripted first level (spec 2.1, S13), four swipes from a fixed board on the easiest row:
//   1 up:   the 2 in column 4 smashes the 2-enemy, the other 2 meets the 2 entering at the gate
//   2 left: the two 2s in the top row merge into a 4; the next 2-enemy steps in at column 3
//   3 up:   the 4-enemy entering above the merged 4 is smashed at the gate
//   4 up:   the new 2 smashes the last enemy, and the siege is broken
// The board's own random stream is fixed (seed 54165), so the enemies at the gate and the new
// tiles come the same way every time; the teaching test plays the script and proves the win.
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { applyMove } from '@e07/merge-siege/rules/apply-move.ts';
import { parseBoard } from '@e07/merge-siege/rules/board-text.ts';

import type { TeachingSpec } from '@e07/game-kit/contract/teaching.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { SwipeDirection } from '@e07/game-kit/geom/classify-swipe.ts';
import type { MergeSiegeMove, MergeSiegeState } from '@e07/merge-siege/rules/merge-siege-types.ts';

/** The stream that brings a 2 then a 4 to the gate and the new tiles where the script needs them. */
const TUTORIAL_SEED = 54_165;

/**
 * The easiest row's wave of 8 with 5 already in: the 2 waiting at the gate above column 1 and two
 * more to come. One swipe already played, so the enemies march on the first and third swipes.
 */
const TUTORIAL_START: MergeSiegeState = {
  difficulty: 0,
  cells: parseBoard([
    '. . . . .',
    '. . . . e2',
    '. . . . .',
    '. . . . 2',
    '. . . . .',
    '. 2 . . .',
  ]),
  next: { col: 1, value: 2 },
  swipes: 1,
  entered: 5,
  smashed: 0,
  score: 0,
  nextId: 4,
  hasContinued: false,
  rng: seedRng(TUTORIAL_SEED),
};

const swipe = (direction: SwipeDirection): MergeSiegeMove => ({ kind: 'swipe', direction });
const cell = (col: number, row: number): BoardTarget => ({ regionId: 'board', col, row });
const UP = swipe('up');
const LEFT = swipe('left');
const AFTER_SMASH = applyMove(TUTORIAL_START, UP).state;
const AFTER_MERGE = applyMove(AFTER_SMASH, LEFT).state;
const AFTER_BIG_SMASH = applyMove(AFTER_MERGE, UP).state;
/** The how-to-play pages show the goal above each step (S13). */
const GOAL_ID = 'merge-siege.goal';

/** Spec S13: one short sentence per step, one pointer, one expected action; Skip from step 2. */
export const MERGE_SIEGE_TEACHING: TeachingSpec<MergeSiegeState, MergeSiegeMove> = {
  tutorial: {
    start: TUTORIAL_START,
    steps: [
      {
        messageId: 'merge-siege.tutorial.step-1',
        pointer: { kind: 'drag', from: cell(4, 3), to: cell(4, 0) },
        expect: { kind: 'move', move: UP },
      },
      {
        messageId: 'merge-siege.tutorial.step-2',
        pointer: { kind: 'drag', from: cell(4, 0), to: cell(0, 0) },
        expect: { kind: 'move', move: LEFT },
      },
      {
        messageId: 'merge-siege.tutorial.step-3',
        pointer: { kind: 'drag', from: cell(0, 5), to: cell(0, 0) },
        expect: { kind: 'move', move: UP },
      },
      {
        messageId: 'merge-siege.tutorial.step-4',
        pointer: { kind: 'drag', from: cell(3, 5), to: cell(3, 1) },
        expect: { kind: 'move', move: UP },
      },
    ],
  },
  howToPlay: [
    {
      titleId: GOAL_ID,
      bodyId: 'merge-siege.how-to-play.step-1',
      example: TUTORIAL_START,
      pointer: { kind: 'drag', from: cell(4, 3), to: cell(4, 0) },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'merge-siege.how-to-play.step-2',
      example: AFTER_SMASH,
      pointer: { kind: 'drag', from: cell(4, 0), to: cell(0, 0) },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'merge-siege.how-to-play.step-3',
      example: AFTER_MERGE,
      pointer: { kind: 'target', target: { regionId: 'gate', col: 0, row: 0 } },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'merge-siege.how-to-play.step-4',
      example: AFTER_BIG_SMASH,
      pointer: { kind: 'target', target: cell(3, 1) },
    },
  ],
};
