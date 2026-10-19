// apps/merge-siege/src/testing/merge-siege-testing.ts
// Spec 10 TESTING: the bot (the greedy reasonable player) and the example states the screenshots,
// the debug menu and the E2E setup start from: start, middle, win and lose.
import { applyMove } from '@e07/merge-siege/rules/apply-move.ts';
import { parseBoard } from '@e07/merge-siege/rules/board-text.ts';
import { create } from '@e07/merge-siege/rules/create.ts';

import { mergeSiegeBot } from './merge-siege-bot.ts';

import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';
import type { MergeSiegeMove, MergeSiegeState } from '@e07/merge-siege/rules/merge-siege-types.ts';

const START = (): MergeSiegeState => create(1, 0);

/** Seed 1 after its first swipe up: three enemies smashed, the board open. */
const MIDDLE = (): MergeSiegeState => applyMove(START(), { kind: 'swipe', direction: 'up' }).state;

/** The wave cleared: tiles only, nothing left to enter. */
const WIN = (): MergeSiegeState => ({
  ...START(),
  cells: parseBoard([
    '2 16 4 . .',
    '. . . . .',
    '. . . . .',
    '. . . . .',
    '. 2 . . .',
    '2 . . . .',
  ]),
  next: null,
  swipes: 8,
  entered: 8,
  smashed: 8,
  score: 344,
});

/** Overrun: an enemy has reached the bottom row. */
const LOSE = (): MergeSiegeState => ({
  ...START(),
  cells: parseBoard([
    '. e4 . . .',
    '. . . . .',
    '. 8 . . .',
    '. . . . .',
    '2 . 4 . .',
    '. . e16 . .',
  ]),
  swipes: 11,
  entered: 6,
  smashed: 4,
  score: 196,
});

export const MERGE_SIEGE_TESTING: TestingSpec<MergeSiegeState, MergeSiegeMove> = {
  bot: mergeSiegeBot,
  examples: { start: START, middle: MIDDLE, win: WIN, lose: LOSE },
};
