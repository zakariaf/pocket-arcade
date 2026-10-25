// apps/toggle-drop/src/rules/toggle-drop-evaluate.ts
// How a reasonable player values a position: the greedy bot (testing.bot) plays by it. It lives in
// rules/ so the level code could use it too (levels/ may not import testing/).
import { dropPath } from './drop-path.ts';
import { outcome } from './outcome.ts';

import type { ToggleDropState } from './toggle-drop-types.ts';

/** Above any position the rules can make: a won board always outranks a playing one. */
const WON_VALUE = 1000;
/** A ball in a cup is worth more than any number of open shots. */
const BALL_IN_CUP_VALUE = 10;

/** Columns whose next drop would land in a cup that still needs a ball (a player sees these). */
export function openShots(state: ToggleDropState): number {
  let shots = 0;
  for (let col = 0; col < state.cols; col += 1) {
    const landing = dropPath(state, col).landing;
    if ((state.filled[landing] ?? 0) < (state.needs[landing] ?? 0)) shots += 1;
  }
  return shots;
}

/**
 * Higher is better for the player: a win (more balls left first), else the balls already in cups,
 * then how many columns would land the next ball in a cup that needs it.
 */
export function evaluateToggleDrop(state: ToggleDropState): number {
  const result = outcome(state);
  if (result.kind === 'won') return WON_VALUE + result.score;
  if (result.kind === 'lost') return -WON_VALUE;
  const inCups = state.filled.reduce((sum, count) => sum + count, 0);
  return inCups * BALL_IN_CUP_VALUE + openShots(state);
}
