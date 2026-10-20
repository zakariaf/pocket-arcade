// apps/jump-chain/src/tutorial/jump-chain-teaching.ts
// Spec S13: the first level teaches itself with a pointer hand and one short sentence at a time.
// The tutorial board is small and fixed: step up next to the front rank, jump it in a chain of
// two, and when the waiting rank comes down onto the empty board, jump it too and win.
import { applyMove } from '@e07/jump-chain/rules/apply-move.ts';
import { create } from '@e07/jump-chain/rules/create.ts';

import type { TeachingSpec, TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type {
  JumpChainMove,
  JumpChainState,
  Square,
} from '@e07/jump-chain/rules/jump-chain-types.ts';

/** A level-0 position with your piece and these enemies, given as [col, row, rank]. */
function position(
  piece: Square,
  enemySquares: readonly (readonly [number, number, number])[],
): JumpChainState {
  const enemies = enemySquares.map(([col, row, rank], id) => ({ id, rank, col, row }));
  const ranks = new Set(enemies.map((enemy) => enemy.rank)).size;
  return {
    ...create(1, 0),
    piece,
    enemies,
    total: enemies.length,
    nextId: enemies.length,
    nextRank: ranks,
    marchIn: 3,
  };
}

function board(square: Square): {
  readonly regionId: 'board';
  readonly col: number;
  readonly row: number;
} {
  return { regionId: 'board', col: square.col, row: square.row };
}

function drag(from: Square, to: Square): TutorialPointer {
  return { kind: 'drag', from: board(from), to: board(to) };
}

/** Two enemies of the front rank stacked on the left, one more waiting above the board. */
const TUTORIAL_START = position({ col: 3, row: 7 }, [
  [1, 5, 0],
  [1, 3, 0],
  [3, -1, 1],
]);
const STEP_UP: JumpChainMove = { kind: 'step', to: { col: 2, row: 6 } };
const CHAIN_OF_TWO: JumpChainMove = {
  kind: 'jump',
  path: [
    { col: 0, row: 4 },
    { col: 2, row: 2 },
  ],
};
/** The empty board pulled the waiting enemy down to (3, 1), next to the piece. */
const JUMP_AGAIN: JumpChainMove = { kind: 'jump', path: [{ col: 4, row: 0 }] };
const AFTER_STEP = applyMove(TUTORIAL_START, STEP_UP).state;
/** How to play, page 3: one chain of three captures the whole rank. */
const WHOLE_RANK = position({ col: 2, row: 6 }, [
  [1, 5, 0],
  [1, 3, 0],
  [3, 1, 0],
]);
/** How to play, page 4: the ranks advance next move, and the front enemy is close to your side. */
const NEAR_SIDE = {
  ...position({ col: 4, row: 6 }, [
    [1, 7, 0],
    [3, 3, 0],
    [5, 3, 0],
  ]),
  marchIn: 1,
};
const GOAL_ID = 'jump-chain.goal';

/** Spec S13: one short sentence per step, one pointer, one expected action; Skip from step 2. */
export const JUMP_CHAIN_TEACHING: TeachingSpec<JumpChainState, JumpChainMove> = {
  tutorial: {
    start: TUTORIAL_START,
    steps: [
      {
        messageId: 'jump-chain.tutorial.step-1',
        pointer: drag({ col: 3, row: 7 }, { col: 2, row: 6 }),
        expect: { kind: 'move', move: STEP_UP },
      },
      {
        messageId: 'jump-chain.tutorial.step-2',
        pointer: drag({ col: 2, row: 6 }, { col: 2, row: 2 }),
        expect: { kind: 'move', move: CHAIN_OF_TWO },
      },
      {
        messageId: 'jump-chain.tutorial.step-3',
        pointer: drag({ col: 2, row: 2 }, { col: 4, row: 0 }),
        expect: { kind: 'move', move: JUMP_AGAIN },
      },
    ],
  },
  howToPlay: [
    {
      titleId: GOAL_ID,
      bodyId: 'jump-chain.how-to-play.step-1',
      example: TUTORIAL_START,
      pointer: drag({ col: 3, row: 7 }, { col: 2, row: 6 }),
    },
    {
      titleId: GOAL_ID,
      bodyId: 'jump-chain.how-to-play.step-2',
      example: AFTER_STEP,
      pointer: drag({ col: 2, row: 6 }, { col: 0, row: 4 }),
    },
    {
      titleId: GOAL_ID,
      bodyId: 'jump-chain.how-to-play.step-3',
      example: WHOLE_RANK,
      pointer: drag({ col: 2, row: 6 }, { col: 4, row: 0 }),
    },
    {
      titleId: GOAL_ID,
      bodyId: 'jump-chain.how-to-play.step-4',
      example: NEAR_SIDE,
      pointer: { kind: 'target', target: { regionId: 'board', col: 1, row: 9 } },
    },
  ],
};
