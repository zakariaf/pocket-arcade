// apps/swap-guard/src/tutorial/swap-guard-teaching.ts
// Spec 2.1 and S13. The tutorial board is a 5 x 5 opening with three spears: the guard stands in
// the strike of the spear beside it, and the spear diagonal to it strikes that attacker. Swapping
// with the diagonal spear makes the two hit each other (the double hit). The guard then steps
// behind the last spear, swaps in front of it (its strike now points at the guard) and swaps back,
// so the spear walks into its own strike: the win.
import { applyMove } from '@e07/swap-guard/rules/apply-move.ts';
import { create } from '@e07/swap-guard/rules/create.ts';

import type { TeachingSpec } from '@e07/game-kit/contract/teaching.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { SwapGuardMove, SwapGuardState } from '@e07/swap-guard/rules/swap-guard-types.ts';

/**
 * The guard in the top corner (square 0), the attacker beside it facing left (1), its partner
 * diagonal to the guard facing up (6), and the last spear facing right in the middle (13).
 */
const TUTORIAL_START: SwapGuardState = {
  ...create(1, 0),
  size: 5,
  guard: 0,
  enemies: [
    { id: 0, kind: 'spear', facing: 'left', cell: 1 },
    { id: 1, kind: 'spear', facing: 'up', cell: 6 },
    { id: 2, kind: 'spear', facing: 'right', cell: 13 },
  ],
  enemyCount: 3,
  swaps: 0,
  maxSwaps: 8,
  score: 0,
  isHit: false,
  lastSwap: null,
  hasContinued: false,
};

const swap = (cell: number): SwapGuardMove => ({ kind: 'swap', cell });
const DOUBLE_HIT = swap(6);
const STEP_BEHIND = swap(12);
const SWAP_IN = swap(13);
const SWAP_BACK = swap(12);
const AFTER_DOUBLE_HIT = applyMove(TUTORIAL_START, DOUBLE_HIT).state;
const BEHIND = applyMove(AFTER_DOUBLE_HIT, STEP_BEHIND).state;
const IN_FRONT = applyMove(BEHIND, SWAP_IN).state;

const at = (cell: number): BoardTarget => ({
  regionId: 'board',
  col: cell % 5,
  row: Math.floor(cell / 5),
});
const GOAL_ID = 'swap-guard.goal';

/** Spec S13: one short sentence per step, one pointer, one expected action; Skip from step 2. */
export const SWAP_GUARD_TEACHING: TeachingSpec<SwapGuardState, SwapGuardMove> = {
  tutorial: {
    start: TUTORIAL_START,
    steps: [
      {
        messageId: 'swap-guard.tutorial.step-1',
        pointer: { kind: 'target', target: at(DOUBLE_HIT.cell) },
        expect: { kind: 'move', move: DOUBLE_HIT },
      },
      {
        messageId: 'swap-guard.tutorial.step-2',
        pointer: { kind: 'target', target: at(STEP_BEHIND.cell) },
        expect: { kind: 'move', move: STEP_BEHIND },
      },
      {
        messageId: 'swap-guard.tutorial.step-3',
        pointer: { kind: 'target', target: at(SWAP_IN.cell) },
        expect: { kind: 'move', move: SWAP_IN },
      },
      {
        messageId: 'swap-guard.tutorial.step-4',
        pointer: { kind: 'target', target: at(SWAP_BACK.cell) },
        expect: { kind: 'move', move: SWAP_BACK },
      },
    ],
  },
  howToPlay: [
    {
      titleId: GOAL_ID,
      bodyId: 'swap-guard.how-to-play.step-1',
      example: TUTORIAL_START,
      // The guard's own square: the attacker's strike shades it.
      pointer: { kind: 'target', target: at(TUTORIAL_START.guard) },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'swap-guard.how-to-play.step-2',
      example: TUTORIAL_START,
      pointer: { kind: 'target', target: at(DOUBLE_HIT.cell) },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'swap-guard.how-to-play.step-3',
      example: TUTORIAL_START,
      // The attacker stands in its partner's strike: when the strikes land, it is hit.
      pointer: { kind: 'target', target: at(1) },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'swap-guard.how-to-play.step-4',
      example: IN_FRONT,
      pointer: { kind: 'target', target: at(SWAP_BACK.cell) },
    },
  ],
};
