// apps/swap-guard/src/testing/swap-guard-testing.ts
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { applyMove } from '@e07/swap-guard/rules/apply-move.ts';
import { create } from '@e07/swap-guard/rules/create.ts';
import { planLine } from '@e07/swap-guard/rules/plan-line.ts';

import { swapGuardBot } from './swap-guard-bot.ts';

import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';
import type { SwapGuardMove, SwapGuardState } from '@e07/swap-guard/rules/swap-guard-types.ts';

/**
 * Level 1 of levels/pack-1.json, the level the debug links and E2E flows open. Copied, not imported:
 * the Node tools that load this module (print-level-line.ts) cannot import JSON without an import
 * attribute; the testing test proves the copy matches the pack.
 */
export const LEVEL_1 = { seed: 568_326_197, difficulty: 0 } as const;

/** Level 1's board: the guard in the threatening spear's strike, the double hit one swap away. */
const START = (): SwapGuardState => create(LEVEL_1.seed, LEVEL_1.difficulty);

/** The swap with the opening's second enemy (id 1): the two hit each other. */
function doubleHit(start: SwapGuardState): SwapGuardMove {
  return { kind: 'swap', cell: pickAt(start.enemies, 1).cell };
}

/** The swap with the threatening spear (id 0): it walks into its own strike, the guard into another. */
function walkIntoStrike(start: SwapGuardState): SwapGuardMove {
  return { kind: 'swap', cell: pickAt(start.enemies, 0).cell };
}

/** Level 1 won along planLine's line (create keeps only starts that line wins). */
function wonRun(): SwapGuardState {
  const start = START();
  const line = planLine(start) ?? [];
  return line.reduce((state, move) => applyMove(state, move).state, start);
}

/** Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. */
export const SWAP_GUARD_TESTING: TestingSpec<SwapGuardState, SwapGuardMove> = {
  bot: swapGuardBot,
  examples: {
    start: START,
    middle: () => applyMove(START(), doubleHit(START())).state,
    win: wonRun,
    lose: () => applyMove(START(), walkIntoStrike(START())).state,
  },
};
