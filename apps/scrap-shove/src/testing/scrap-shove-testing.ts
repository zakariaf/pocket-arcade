// apps/scrap-shove/src/testing/scrap-shove-testing.ts
import { applyMove } from '@e07/scrap-shove/rules/apply-move.ts';
import { stateFromText } from '@e07/scrap-shove/rules/board-text.ts';
import { create } from '@e07/scrap-shove/rules/create.ts';

import { scrapShoveBot } from './scrap-shove-bot.ts';

import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';
import type { ScrapShoveMove, ScrapShoveState } from '@e07/scrap-shove/rules/scrap-shove-types.ts';

const START = (): ScrapShoveState => create(1, 0);

/** A floor mid-way: two robots crashed, a heavy robot lined up behind a heap next to the player. */
const MIDDLE = (): ScrapShoveState => applyMove(START(), { kind: 'wait' }).state;

/** One shove from the win: the heavy robot waits behind the heap it pushed up to the player. */
const ALMOST_WON = [
  '........',
  '........',
  '....#...',
  '........',
  '..h.....',
  '...#....',
  '....@...',
  '........',
];

/** One wait from the loss: a robot stands next to the player and nothing is in its way. */
const ALMOST_LOST = [
  '........',
  '........',
  '........',
  '...n....',
  '....@...',
  '........',
  '........',
  '......#.',
];

/** Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. */
export const SCRAP_SHOVE_TESTING: TestingSpec<ScrapShoveState, ScrapShoveMove> = {
  bot: scrapShoveBot,
  examples: {
    start: START,
    middle: MIDDLE,
    win: () => applyMove(stateFromText(ALMOST_WON), { kind: 'shove', col: 3, row: 5 }).state,
    lose: () => applyMove(stateFromText(ALMOST_LOST), { kind: 'wait' }).state,
  },
};
