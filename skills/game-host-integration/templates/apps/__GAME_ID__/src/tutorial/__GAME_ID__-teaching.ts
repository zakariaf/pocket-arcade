// apps/__GAME_ID__/src/tutorial/__GAME_ID__-teaching.ts
import { applyMove } from '@e07/__GAME_ID__/rules/apply-move.ts';

import type { TeachingSpec, TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { Cell, __GAME_PASCAL__Move, __GAME_PASCAL__State } from '@e07/__GAME_ID__/rules/__GAME_ID__-types.ts';

/** A 3x3 board with exactly these cells lit. */
function board(lit: readonly number[], maxMoves: number): __GAME_PASCAL__State {
  const cells = Array.from({ length: 9 }, (_, index): Cell => (lit.includes(index) ? 1 : 0));
  return { cols: 3, rows: 3, cells, moves: 0, maxMoves };
}

const CENTRE = { regionId: 'board', col: 1, row: 1 } as const;
const CORNER = { regionId: 'board', col: 0, row: 0 } as const;
const TAP_CENTRE: __GAME_PASCAL__Move = { kind: 'flip', col: 1, row: 1 };
const TAP_CORNER: __GAME_PASCAL__Move = { kind: 'flip', col: 0, row: 0 };
const UNDO_POINTER: TutorialPointer = { kind: 'hud', element: 'undo' };
/** The how-to-play pages show the goal above each step (S13). */
const GOAL_ID = '__GAME_ID__.goal';
const PLUS = board([1, 3, 4, 5, 7], 3);

/** Tap the corner (it turns the board into a plus), then the centre (it clears the plus). */
const TUTORIAL_START = board([0, 4, 5, 7], 3);

/** Spec S13: one short sentence per step, one pointer, one expected action; Skip from step 2. */
export const __GAME_CONST___TEACHING: TeachingSpec<__GAME_PASCAL__State, __GAME_PASCAL__Move> = {
  tutorial: {
    start: TUTORIAL_START,
    steps: [
      {
        messageId: '__GAME_ID__.tutorial.step-1',
        pointer: { kind: 'target', target: CORNER },
        expect: { kind: 'move', move: TAP_CORNER },
      },
      {
        messageId: '__GAME_ID__.tutorial.step-2',
        pointer: { kind: 'target', target: CENTRE },
        expect: { kind: 'move', move: TAP_CENTRE },
      },
    ],
  },
  howToPlay: [
    {
      titleId: GOAL_ID,
      bodyId: '__GAME_ID__.how-to-play.step-1',
      example: TUTORIAL_START,
      pointer: { kind: 'target', target: CORNER },
    },
    {
      titleId: GOAL_ID,
      bodyId: '__GAME_ID__.how-to-play.step-2',
      example: PLUS,
      pointer: { kind: 'target', target: CENTRE },
    },
    {
      titleId: GOAL_ID,
      bodyId: '__GAME_ID__.how-to-play.step-3',
      example: applyMove(PLUS, TAP_CORNER).state,
      pointer: UNDO_POINTER,
    },
  ],
};
