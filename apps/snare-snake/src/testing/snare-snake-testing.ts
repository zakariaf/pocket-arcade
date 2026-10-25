// apps/snare-snake/src/testing/snare-snake-testing.ts
// Spec 10 TESTING: "A simple bot that can play the game" and "Example states for automatic
// screenshots (start, middle, win, lose)".
import { applyMove } from '@e07/snare-snake/rules/apply-move.ts';
import { create } from '@e07/snare-snake/rules/create.ts';

import { snareSnakeBot } from './snare-snake-bot.ts';

import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';
import type {
  Direction,
  SnareSnakeMove,
  SnareSnakeState,
} from '@e07/snare-snake/rules/snare-snake-types.ts';

const START = (): SnareSnakeState => create(1, 0);

/** Seed 1's opening line: into the gap, along it, and the bite that closes the coil. */
const OPENING: readonly Direction[] = ['down', 'left', 'left'];

function played(directions: readonly Direction[]): SnareSnakeState {
  return directions.reduce(
    (state, direction) => applyMove(state, { kind: 'steer', direction }).state,
    START(),
  );
}

/** Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. */
export const SNARE_SNAKE_TESTING: TestingSpec<SnareSnakeState, SnareSnakeMove> = {
  bot: snareSnakeBot,
  examples: {
    start: START,
    middle: () => played(OPENING),
    win: () => {
      const middle = played(OPENING);
      return { ...middle, critters: [], caught: middle.total, score: middle.score + 100 };
    },
    lose: () => ({ ...START(), moves: START().maxMoves }),
  },
};
