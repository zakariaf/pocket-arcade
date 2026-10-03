// apps/line-siege/src/testing/line-siege-testing.ts
// Spec 10 TESTING: "A simple bot that can play the game" and "Example states for automatic
// screenshots (start, middle, win, lose)".
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { create } from '@e07/line-siege/rules/create.ts';
import { knobsFor } from '@e07/line-siege/rules/line-siege-tuning.ts';

import { lineSiegeBot } from './line-siege-bot.ts';

import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';
import type { LineSiegeMove, LineSiegeState } from '@e07/line-siege/rules/line-siege-types.ts';

/** Seed 1, difficulty 0: the opening of create's golden (column 7 lacks rows 3-4). */
const START = (): LineSiegeState => create(1, 0);
const GOAL = knobsFor(0).goal;

/** Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. */
export const LINE_SIEGE_TESTING: TestingSpec<LineSiegeState, LineSiegeMove> = {
  bot: lineSiegeBot,
  examples: {
    start: START,
    middle: () => applyMove(START(), { kind: 'place-block', trayIndex: 1, col: 7, row: 3 }).state,
    win: () => ({ ...START(), monsters: [], spawned: GOAL, defeated: GOAL, score: 180 }),
    lose: () => ({ ...START(), hearts: 0, placements: 14, defeated: 2, score: 85 }),
  },
};
