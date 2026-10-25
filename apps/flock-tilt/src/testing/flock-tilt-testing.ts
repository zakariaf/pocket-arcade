// apps/flock-tilt/src/testing/flock-tilt-testing.ts
import { applyMove } from '@e07/flock-tilt/rules/apply-move.ts';
import { create } from '@e07/flock-tilt/rules/create.ts';

import { flockTiltBot } from './flock-tilt-bot.ts';

import type {
  Direction,
  FlockTiltMove,
  FlockTiltState,
} from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';

const START = (): FlockTiltState => create(1, 0);

/** Plays tilts from level 1's field (the lines the rules golden pins). */
function played(line: readonly Direction[]): FlockTiltState {
  return line.reduce(
    (state, direction) => applyMove(state, { kind: 'tilt', direction }).state,
    START(),
  );
}

/** Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. */
export const FLOCK_TILT_TESTING: TestingSpec<FlockTiltState, FlockTiltMove> = {
  bot: flockTiltBot,
  examples: {
    start: START,
    middle: () => played(['down', 'left']),
    win: () => played(['down', 'left', 'down', 'left']),
    lose: () => played(['up', 'right', 'up', 'left']),
  },
};
