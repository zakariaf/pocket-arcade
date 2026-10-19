// apps/stepstone/src/testing/stepstone-testing.ts
// Spec 10 TESTING: "A simple bot that can play the game" and "Example states for automatic
// screenshots (start, middle, win, lose)".
import { applyMove } from '@e07/stepstone/rules/apply-move.ts';
import { create } from '@e07/stepstone/rules/create.ts';
import { pondFromText } from '@e07/stepstone/rules/pond-text.ts';

import { stepstoneBot } from './stepstone-bot.ts';

import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';
import type { StepstoneMove, StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';

/** Seed 1, difficulty 0: the pond of the rules golden (rook, king, king to the flag, par 3). */
const START = (): StepstoneState => create(1, 0);
/** The golden route: the king at 12, the king at 18, the flag at 14. */
const ROUTE: readonly number[] = [12, 18, 14];

/** The frog on a king stone with only water and sunk stones around it. */
const STUCK = ['K....', '.~~~.', '.~k~.', '.~~~.', 'R...F'].join('\n');

function hopAlong(hops: number): StepstoneState {
  return ROUTE.slice(0, hops).reduce(
    (state, to) => applyMove(state, { kind: 'hop', to }).state,
    START(),
  );
}

/** Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. */
export const STEPSTONE_TESTING: TestingSpec<StepstoneState, StepstoneMove> = {
  bot: stepstoneBot,
  examples: {
    start: START,
    middle: () => hopAlong(1),
    win: () => hopAlong(ROUTE.length),
    lose: () => ({ ...pondFromText(STUCK), moves: 3, par: 5, kindsUsed: ['rook', 'king'] }),
  },
};
