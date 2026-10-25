// apps/jump-chain/src/testing/jump-chain-testing.ts
// Spec 10 TESTING: "A simple bot that can play the game" and "Example states for automatic
// screenshots (start, middle, win, lose)".
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { applyMove } from '@e07/jump-chain/rules/apply-move.ts';
import { create } from '@e07/jump-chain/rules/create.ts';
import { listMoves } from '@e07/jump-chain/rules/list-moves.ts';
import { outcome } from '@e07/jump-chain/rules/outcome.ts';

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

/** Moves the lose line may take: the start board is lost in 12 (a test pins the loss). */
const LOSE_MOVE_CAP = 100;

/**
 * Played, never written by hand, so a save restores it: from the start, always the last listed
 * move, until the ranks overrun your side (score 150, an enemy on column 1 of your row).
 */
function lose(): JumpChainState {
  let state = START();
  for (let played = 0; played < LOSE_MOVE_CAP && outcome(state).kind === 'playing'; played += 1) {
    const moves = listMoves(state);
    state = applyMove(state, pickAt(moves, moves.length - 1)).state;
  }
  return state;
}

/** Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. */
export const JUMP_CHAIN_TESTING: TestingSpec<JumpChainState, JumpChainMove> = {
  bot: jumpChainBot,
  examples: {
    start: START,
    middle,
    win: () => ({ ...START(), enemies: [], captured: START().total, ranksCleared: 3, score: 340 }),
    lose,
  },
};
