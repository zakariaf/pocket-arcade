// apps/toggle-drop/src/testing/toggle-drop-testing.ts
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { create } from '@e07/toggle-drop/rules/create.ts';

import { toggleDropBot } from './toggle-drop-bot.ts';

import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';
import type { ToggleDropMove, ToggleDropState } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

/** The easiest board of seed 1: two cups under columns 0 and 1, six balls. */
const START = (): ToggleDropState => create(1, 0);

/** Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. */
export const TOGGLE_DROP_TESTING: TestingSpec<ToggleDropState, ToggleDropMove> = {
  bot: toggleDropBot,
  examples: {
    start: START,
    middle: () => applyMove(START(), { kind: 'drop', col: 1 }).state,
    win: () => {
      const start = START();
      return { ...start, filled: start.needs, ballsLeft: 4, drops: 2 };
    },
    lose: () => ({ ...START(), ballsLeft: 0, drops: 6 }),
  },
};
