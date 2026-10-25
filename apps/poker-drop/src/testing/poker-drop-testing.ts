// apps/poker-drop/src/testing/poker-drop-testing.ts
import { applyMove } from '@e07/poker-drop/rules/apply-move.ts';
import { create } from '@e07/poker-drop/rules/create.ts';
import { listMoves } from '@e07/poker-drop/rules/list-moves.ts';

import { pokerDropBot } from './poker-drop-bot.ts';

import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';
import type { PokerDropMove, PokerDropState } from '@e07/poker-drop/rules/poker-drop-types.ts';

/** Seed 1 at difficulty 0: two prepared rows of two pair beside the empty column 5. */
const START = (): PokerDropState => create(1, 0);

/** Plays a start to its end, always dropping into the leftmost or the rightmost open column. */
export function playToEnd(start: PokerDropState, side: 'leftmost' | 'rightmost'): PokerDropState {
  let state = start;
  for (let moves = listMoves(state); moves.length > 0; moves = listMoves(state)) {
    const move = side === 'leftmost' ? moves[0] : moves.at(-1);
    if (move === undefined) break;
    state = applyMove(state, move).state;
  }
  return state;
}

/** Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. */
export const POKER_DROP_TESTING: TestingSpec<PokerDropState, PokerDropMove> = {
  bot: pokerDropBot,
  examples: {
    start: START,
    // the first drop into the gap: two pair bursts and the cascade makes a second hand
    middle: () => applyMove(START(), { kind: 'drop-card', col: 4 }).state,
    // a real win: 20 drops into the leftmost open column make the level's 6 hands (score 220)
    win: () => playToEnd(START(), 'leftmost'),
    // a real loss: 16 drops into the rightmost open column, then a rising row overflows the well
    lose: () => playToEnd(START(), 'rightmost'),
  },
};
