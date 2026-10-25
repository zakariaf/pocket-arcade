// apps/flock-tilt/src/tutorial/flock-tilt-teaching.ts
import { applyMove } from '@e07/flock-tilt/rules/apply-move.ts';
import { startState } from '@e07/flock-tilt/rules/create.ts';
import { parseField } from '@e07/flock-tilt/rules/field-text.ts';
import { TILT_KEY_IDS } from '@e07/flock-tilt/rules/intent-to-move.ts';

import type {
  Direction,
  FlockTiltMove,
  FlockTiltState,
} from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { TeachingSpec, TutorialPointer } from '@e07/game-kit/contract/teaching.ts';

/** A playing field from a text map, with the whole tilt budget. */
function fieldOf(lines: readonly string[], par: number): FlockTiltState {
  return startState(parseField(lines), par);
}

const tilt = (direction: Direction): FlockTiltMove => ({ kind: 'tilt', direction });

/** The hand points at the tilt key of the expected tilt (a swipe that way does the same). */
const keyOf = (direction: Direction): TutorialPointer => ({
  kind: 'target',
  target: { regionId: TILT_KEY_IDS[direction], col: 0, row: 0 },
});

/**
 * The tutorial field: two sheep, no wolf, the pen in the top-right corner. Down slides both
 * sheep at once; right stops the second against the first; up drops one into the pen; right
 * sends the other after it. Par is 2 (up, then right pens both): the four steps teach the moves.
 */
const TUTORIAL_START = fieldOf(
  ['.s....o', '..s....', '.......', '...#...', '....#..', '.......', '.......'],
  2,
);
const AFTER_DOWN = applyMove(TUTORIAL_START, tilt('down')).state;
const AFTER_RIGHT = applyMove(AFTER_DOWN, tilt('right')).state;

/**
 * How-to-play page 4: the sheep shares the wolf's column, so up and down both slide the two the
 * same way until the sheep ends touching the wolf and is lost; left and right are safe.
 */
const WOLF_FIELD = fieldOf(
  ['......o', '.......', '..s....', '.......', '..w.#..', '.......', '.......'],
  2,
);

/** The how-to-play pages show the goal above each step (S13). */
const GOAL_ID = 'flock-tilt.goal';

/** Spec S13: one short sentence per step, one pointer, one expected tilt; Skip from step 2. */
export const FLOCK_TILT_TEACHING: TeachingSpec<FlockTiltState, FlockTiltMove> = {
  tutorial: {
    start: TUTORIAL_START,
    steps: [
      {
        messageId: 'flock-tilt.tutorial.step-1',
        pointer: keyOf('down'),
        expect: { kind: 'move', move: tilt('down') },
      },
      {
        messageId: 'flock-tilt.tutorial.step-2',
        pointer: keyOf('right'),
        expect: { kind: 'move', move: tilt('right') },
      },
      {
        messageId: 'flock-tilt.tutorial.step-3',
        pointer: keyOf('up'),
        expect: { kind: 'move', move: tilt('up') },
      },
      {
        messageId: 'flock-tilt.tutorial.step-4',
        pointer: keyOf('right'),
        expect: { kind: 'move', move: tilt('right') },
      },
    ],
  },
  howToPlay: [
    {
      titleId: GOAL_ID,
      bodyId: 'flock-tilt.how-to-play.step-1',
      example: TUTORIAL_START,
      pointer: keyOf('down'),
    },
    {
      titleId: GOAL_ID,
      bodyId: 'flock-tilt.how-to-play.step-2',
      example: AFTER_DOWN,
      pointer: keyOf('right'),
    },
    {
      titleId: GOAL_ID,
      bodyId: 'flock-tilt.how-to-play.step-3',
      example: AFTER_RIGHT,
      pointer: keyOf('up'),
    },
    {
      titleId: GOAL_ID,
      bodyId: 'flock-tilt.how-to-play.step-4',
      example: WOLF_FIELD,
      pointer: { kind: 'none' },
    },
  ],
};
