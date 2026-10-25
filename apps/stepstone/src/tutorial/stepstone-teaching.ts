// apps/stepstone/src/tutorial/stepstone-teaching.ts
import { applyMove } from '@e07/stepstone/rules/apply-move.ts';
import { pondFromText } from '@e07/stepstone/rules/pond-text.ts';

import type { TeachingSpec } from '@e07/game-kit/contract/teaching.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { StepstoneMove, StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';

/**
 * The tutorial pond: one route only, four hops, every hop kind change shown. The frog's rook
 * reaches the bishop along its row, the bishop the king, the king the rook, the rook the flag.
 */
const TUTORIAL_POND = ['..K..', '.R...', 'r...B', '.....', '.F...'].join('\n');
const SIDE = 5;

const START: StepstoneState = {
  ...pondFromText(TUTORIAL_POND),
  moves: 0,
  par: 4,
  kindsUsed: ['rook'],
};

/** A hop onto a cell, and the board target its pointer rests on. */
function hop(
  row: number,
  col: number,
): { readonly move: StepstoneMove; readonly target: BoardTarget } {
  return { move: { kind: 'hop', to: row * SIDE + col }, target: { regionId: 'board', col, row } };
}

const TO_BISHOP = hop(2, 4);
const TO_KING = hop(0, 2);
const TO_ROOK = hop(1, 1);
const TO_FLAG = hop(4, 1);
const AFTER_FIRST = applyMove(START, TO_BISHOP.move).state;
const BEFORE_LAST = applyMove(applyMove(AFTER_FIRST, TO_KING.move).state, TO_ROOK.move).state;
/** The frog's own stone at the start, and the stone it has left after the first hop. */
const FROG_START: BoardTarget = { regionId: 'board', col: 0, row: 2 };
/** The how-to-play pages show the goal above each step (S13). */
const GOAL_ID = 'stepstone.goal';

/** Spec S13: one short sentence per step, one pointer, one expected hop; Skip from step 2. */
export const STEPSTONE_TEACHING: TeachingSpec<StepstoneState, StepstoneMove> = {
  tutorial: {
    start: START,
    steps: [
      {
        messageId: 'stepstone.tutorial.step-1',
        pointer: { kind: 'target', target: TO_BISHOP.target },
        expect: { kind: 'move', move: TO_BISHOP.move },
      },
      {
        messageId: 'stepstone.tutorial.step-2',
        pointer: { kind: 'target', target: TO_KING.target },
        expect: { kind: 'move', move: TO_KING.move },
      },
      {
        messageId: 'stepstone.tutorial.step-3',
        pointer: { kind: 'target', target: TO_ROOK.target },
        expect: { kind: 'move', move: TO_ROOK.move },
      },
      {
        messageId: 'stepstone.tutorial.step-4',
        pointer: { kind: 'target', target: TO_FLAG.target },
        expect: { kind: 'move', move: TO_FLAG.move },
      },
    ],
  },
  howToPlay: [
    {
      titleId: GOAL_ID,
      bodyId: 'stepstone.how-to-play.step-1',
      example: START,
      pointer: { kind: 'target', target: FROG_START },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'stepstone.how-to-play.step-2',
      example: START,
      pointer: { kind: 'target', target: TO_BISHOP.target },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'stepstone.how-to-play.step-3',
      example: AFTER_FIRST,
      pointer: { kind: 'target', target: FROG_START },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'stepstone.how-to-play.step-4',
      example: BEFORE_LAST,
      pointer: { kind: 'target', target: TO_FLAG.target },
    },
  ],
};
