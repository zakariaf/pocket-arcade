// apps/toggle-drop/src/testing/toggle-drop-testing.ts
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { create } from '@e07/toggle-drop/rules/create.ts';

import { toggleDropBot } from './toggle-drop-bot.ts';

import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';
import type { ToggleDropMove, ToggleDropState } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

/** The easiest board of seed 1: two cups under columns 1 and 3, six balls. */
const START = (): ToggleDropState => create(1, 0);

/** The start board after these drops, played through the rules (never written by hand). */
function played(cols: readonly number[]): ToggleDropState {
  return cols.reduce((state, col) => applyMove(state, { kind: 'drop', col }).state, START());
}

/**
 * Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. Each is
 * played, so a save restores it: the win is the solver's shortest line (four balls left over), the
 * loss six balls dropped down the last column, which fills one cup.
 */
export const TOGGLE_DROP_TESTING: TestingSpec<ToggleDropState, ToggleDropMove> = {
  bot: toggleDropBot,
  examples: {
    start: START,
    middle: () => played([1]),
    win: () => played([0, 2]),
    lose: () => played([4, 4, 4, 4, 4, 4]),
  },
};
