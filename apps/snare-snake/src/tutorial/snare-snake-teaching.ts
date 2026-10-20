// apps/snare-snake/src/tutorial/snare-snake-teaching.ts
// Spec 2.1 and S13. The tutorial is the coil opening of seed 1 at difficulty 0: two critters sit in
// the coil's nest, frozen beside the snake, and the coil's gap is below them. The player steers
// down, left into the gap, then left again into the body: the loop closes around the nest and
// snares three critters. The fourth step leaves one critter to catch, with any move.
import { applyMove } from '@e07/snare-snake/rules/apply-move.ts';
import { create } from '@e07/snare-snake/rules/create.ts';

import type { TeachingSpec } from '@e07/game-kit/contract/teaching.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { SnareSnakeMove, SnareSnakeState } from '@e07/snare-snake/rules/snare-snake-types.ts';

/** Seed 1, difficulty 0: a 7 x 8 board, the head at column 4, row 4, the nest at column 3. */
const TUTORIAL_START = create(1, 0);
const DOWN: SnareSnakeMove = { kind: 'steer', direction: 'down' };
const LEFT: SnareSnakeMove = { kind: 'steer', direction: 'left' };
const AFTER_STEP = applyMove(TUTORIAL_START, DOWN).state;
const IN_THE_GAP = applyMove(AFTER_STEP, LEFT).state;
const SNARED = applyMove(IN_THE_GAP, LEFT).state;

const cell = (col: number, row: number): BoardTarget => ({ regionId: 'board', col, row });
/** Below the head; the coil's gap below the nest; the body segment the head bumps. */
const BELOW_HEAD = cell(4, 5);
const GAP = cell(3, 5);
const BODY = cell(2, 5);
/** A nest critter, frozen beside the snake. */
const NEST_CRITTER = cell(3, 4);
const GOAL_ID = 'snare-snake.goal';

/** Spec S13: one short sentence per step, one pointer, one expected action; Skip from step 2. */
export const SNARE_SNAKE_TEACHING: TeachingSpec<SnareSnakeState, SnareSnakeMove> = {
  tutorial: {
    start: TUTORIAL_START,
    steps: [
      {
        messageId: 'snare-snake.tutorial.step-1',
        pointer: { kind: 'target', target: BELOW_HEAD },
        expect: { kind: 'move', move: DOWN },
      },
      {
        messageId: 'snare-snake.tutorial.step-2',
        pointer: { kind: 'target', target: GAP },
        expect: { kind: 'move', move: LEFT },
      },
      {
        messageId: 'snare-snake.tutorial.step-3',
        pointer: { kind: 'target', target: BODY },
        expect: { kind: 'move', move: LEFT },
      },
      {
        messageId: 'snare-snake.tutorial.step-4',
        pointer: { kind: 'none' },
        expect: { kind: 'any-move' },
      },
    ],
  },
  howToPlay: [
    {
      titleId: GOAL_ID,
      bodyId: 'snare-snake.how-to-play.step-1',
      example: TUTORIAL_START,
      pointer: { kind: 'target', target: BELOW_HEAD },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'snare-snake.how-to-play.step-2',
      example: IN_THE_GAP,
      pointer: { kind: 'target', target: NEST_CRITTER },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'snare-snake.how-to-play.step-3',
      example: IN_THE_GAP,
      pointer: { kind: 'target', target: BODY },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'snare-snake.how-to-play.step-4',
      example: SNARED,
      pointer: { kind: 'none' },
    },
  ],
};
