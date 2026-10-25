// apps/poker-drop/src/tutorial/poker-drop-teaching.ts
import { applyMove } from '@e07/poker-drop/rules/apply-move.ts';
import { drawStart } from '@e07/poker-drop/rules/create.ts';

import type { TeachingSpec } from '@e07/game-kit/contract/teaching.ts';
import type { PokerDropMove, PokerDropState } from '@e07/poker-drop/rules/poker-drop-types.ts';

/**
 * Seed 1, difficulty 0: two prepared rows of two pair beside the empty gap, column 5. The first
 * drop into the gap bursts the bottom row, and the row above falls and bursts too (a cascade).
 * It is the seed's own first board, which create(1, 0) hands out too (the witness wins it; the
 * create tests pin that), drawn without the witness so loading this module stays cheap.
 */
const TUTORIAL_START = drawStart(1, 0);
const DROP_IN_GAP: PokerDropMove = { kind: 'drop-card', col: 4 };
const AFTER_DROP = applyMove(TUTORIAL_START, DROP_IN_GAP).state;
const BOTTOM_GAP_CELL = 4;
const BOTTOM_ROW = [0, 1, 2, 3];

/** The deal after the first drop: the next card in hand, the deck one card further on. */
const DEALT = {
  hand: AFTER_DROP.hand,
  next: AFTER_DROP.next,
  pile: AFTER_DROP.pile,
  rng: AFTER_DROP.rng,
  drops: AFTER_DROP.drops,
};

/** The dropped card has landed: the bottom row is full and makes two pair (before it bursts). */
const FULL_ROW: PokerDropState = {
  ...TUTORIAL_START,
  ...DEALT,
  cells: TUTORIAL_START.cells.map((cell, index) =>
    index === BOTTOM_GAP_CELL ? TUTORIAL_START.hand : cell,
  ),
};

/** The two pair has burst: the kicker stays, and the row above still hangs over the holes. */
const ROW_FALLING: PokerDropState = {
  ...FULL_ROW,
  cells: FULL_ROW.cells.map((cell, index) => (BOTTOM_ROW.includes(index) ? null : cell)),
  handsMade: 1,
  score: 20,
};

/** Pointer cells count rows from the top, as the hit test does: row 5 is the well's floor. */
const GAP_FLOOR = { regionId: 'well', col: 4, row: 5 } as const;
const PAIRED_CARD = { regionId: 'well', col: 0, row: 5 } as const;
const HANGING_CARD = { regionId: 'well', col: 0, row: 4 } as const;
const GOAL_ID = 'poker-drop.goal';

/** Spec S13: one short sentence per step, one pointer, one expected action; Skip from step 2. */
export const POKER_DROP_TEACHING: TeachingSpec<PokerDropState, PokerDropMove> = {
  tutorial: {
    start: TUTORIAL_START,
    steps: [
      {
        messageId: 'poker-drop.tutorial.step-1',
        pointer: { kind: 'target', target: GAP_FLOOR },
        expect: { kind: 'move', move: DROP_IN_GAP },
      },
      {
        messageId: 'poker-drop.tutorial.step-2',
        pointer: { kind: 'none' },
        expect: { kind: 'any-move' },
      },
      {
        messageId: 'poker-drop.tutorial.step-3',
        pointer: { kind: 'none' },
        expect: { kind: 'any-move' },
      },
      {
        messageId: 'poker-drop.tutorial.step-4',
        pointer: { kind: 'none' },
        expect: { kind: 'any-move' },
      },
    ],
  },
  howToPlay: [
    {
      titleId: GOAL_ID,
      bodyId: 'poker-drop.how-to-play.step-1',
      example: TUTORIAL_START,
      pointer: { kind: 'target', target: GAP_FLOOR },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'poker-drop.how-to-play.step-2',
      example: FULL_ROW,
      pointer: { kind: 'none' },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'poker-drop.how-to-play.step-3',
      example: FULL_ROW,
      pointer: { kind: 'target', target: PAIRED_CARD },
    },
    {
      titleId: GOAL_ID,
      bodyId: 'poker-drop.how-to-play.step-4',
      example: ROW_FALLING,
      pointer: { kind: 'target', target: HANGING_CARD },
    },
  ],
};
