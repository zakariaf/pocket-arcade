// apps/poker-drop/src/testing/poker-drop-testing.ts
import { applyMove } from '@e07/poker-drop/rules/apply-move.ts';
import { create } from '@e07/poker-drop/rules/create.ts';

import { pokerDropBot } from './poker-drop-bot.ts';

import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';
import type { PokerDropMove, PokerDropState } from '@e07/poker-drop/rules/poker-drop-types.ts';

/** Seed 1 at difficulty 0: two prepared rows of two pair beside the empty column 5. */
const START = (): PokerDropState => create(1, 0);

/** Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. */
export const POKER_DROP_TESTING: TestingSpec<PokerDropState, PokerDropMove> = {
  bot: pokerDropBot,
  examples: {
    start: START,
    // the first drop into the gap: two pair bursts and the cascade makes a second hand
    middle: () => applyMove(START(), { kind: 'drop-card', col: 4 }).state,
    win: () => ({ ...START(), handsMade: START().goal, score: 340 }),
    lose: () => ({ ...START(), cells: START().cells.map((_, index) => index % 52) }),
  },
};
