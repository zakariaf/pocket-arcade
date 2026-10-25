// apps/trail-clear/src/testing/trail-clear-testing.ts
// Spec 10 TESTING: "A simple bot that can play the game" and "Example states for automatic
// screenshots (start, middle, win, lose)".
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { create } from '@e07/trail-clear/rules/create.ts';
import { listMoves } from '@e07/trail-clear/rules/list-moves.ts';

import { trailClearBot } from './trail-clear-bot.ts';

import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';
import type { TrailClearMove, TrailClearState } from '@e07/trail-clear/rules/trail-clear-types.ts';

/** Seed 1, difficulty 0: the opening of create's golden (the gap at col 3, row 2). */
const START = (): TrailClearState => create(1, 0);
/** The opening's double: the ford into the gap, turned to face the road end. */
const OPENING_DOUBLE: TrailClearMove = { kind: 'place-tile', turns: 1, col: 3, row: 2 };

/** After the opening double, the first listed placement of the next tile. */
function middle(): TrailClearState {
  const doubled = applyMove(START(), OPENING_DOUBLE).state;
  return applyMove(doubled, pickAt(listMoves(doubled), 0)).state;
}

/** Moves written as turns, column and row ("012": one turn, column 1, row 2). */
function replayLine(line: string): TrailClearState {
  return line.split(' ').reduce((state, move) => {
    const [turns, col, row] = [0, 1, 2].map((at) => Number(move.charAt(at)));
    return applyMove(state, {
      kind: 'place-tile',
      turns: turns ?? 0,
      col: col ?? 0,
      row: row ?? 0,
    }).state;
  }, START());
}

/** The witness's winning line of seed 1 at difficulty 0: all 24 tiles of the bag placed. */
const WIN_LINE =
  '132 012 210 211 111 331 321 013 231 321 121 032 222 024 112 002 023 131 200 001 100 111 341 001';
/**
 * A player who always takes the middle listed move: on placement 23 the next tile fits nowhere.
 * After the continue, the first listed move places the bag's last tile (the run is won, not lost).
 */
const LOSE_LINE =
  '012 202 132 232 003 022 123 341 121 043 211 311 333 223 132 130 114 134 310 131 341 112 021';

/** Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. */
export const TRAIL_CLEAR_TESTING: TestingSpec<TrailClearState, TrailClearMove> = {
  bot: trailClearBot,
  examples: {
    start: START,
    middle,
    win: () => replayLine(WIN_LINE),
    lose: () => replayLine(LOSE_LINE),
  },
};
