// apps/jump-chain/src/testing/jump-chain-testing.ts
// Spec 10 TESTING: "A simple bot that can play the game" and "Example states for automatic
// screenshots (start, middle, win, lose)".
import { applyMove } from '@e07/jump-chain/rules/apply-move.ts';
import { create } from '@e07/jump-chain/rules/create.ts';

import { jumpChainBot } from './jump-chain-bot.ts';

import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';
import type { JumpChainMove, JumpChainState } from '@e07/jump-chain/rules/jump-chain-types.ts';

/** Seed 1, difficulty 0: the board of create's golden (three ranks, your piece on row 7). */
const START = (): JumpChainState => create(1, 0);

/** One step next to the front rank, then a jump over its right-hand enemy. */
function middle(): JumpChainState {
  const stepped = applyMove(START(), { kind: 'step', to: { col: 4, row: 6 } }).state;
  return applyMove(stepped, { kind: 'jump', path: [{ col: 6, row: 4 }] }).state;
}

/** Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. */
export const JUMP_CHAIN_TESTING: TestingSpec<JumpChainState, JumpChainMove> = {
  bot: jumpChainBot,
  examples: {
    start: START,
    middle,
    win: () => ({ ...START(), enemies: [], captured: START().total, ranksCleared: 3, score: 340 }),
    lose: () => ({
      ...START(),
      enemies: [{ id: 0, rank: 0, col: 1, row: 9 }],
      captured: START().total - 1,
      score: 150,
    }),
  },
};
