// apps/trail-clear/src/testing/trail-clear-testing.ts
// Spec 10 TESTING: "A simple bot that can play the game" and "Example states for automatic
// screenshots (start, middle, win, lose)".
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { ALL_CELLS } from '@e07/trail-clear/rules/board-cells.ts';
import { create } from '@e07/trail-clear/rules/create.ts';
import { listMoves } from '@e07/trail-clear/rules/list-moves.ts';
import { knobsFor } from '@e07/trail-clear/rules/trail-clear-tuning.ts';

import { trailClearBot } from './trail-clear-bot.ts';

import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';
import type {
  PlacedTile,
  TrailClearMove,
  TrailClearState,
} from '@e07/trail-clear/rules/trail-clear-types.ts';

/** Seed 1, difficulty 0: the opening of create's golden (the gap at col 3, row 2). */
const START = (): TrailClearState => create(1, 0);
/** The opening's double: the ford into the gap, turned to face the road end. */
const OPENING_DOUBLE: TrailClearMove = { kind: 'place-tile', turns: 1, col: 3, row: 2 };

/** After the opening double, the first listed placement of the next tile. */
function middle(): TrailClearState {
  const doubled = applyMove(START(), OPENING_DOUBLE).state;
  return applyMove(doubled, pickAt(listMoves(doubled), 0)).state;
}

/** River ends pointing north everywhere but the middle cell, with a bridge offered: no room. */
function lose(): TrailClearState {
  const cells = ALL_CELLS.map((cell): PlacedTile | null =>
    cell === 12 ? null : { kind: 'river-end', turns: 0, placedAt: 1 + (cell % 9) },
  );
  return { ...START(), cells, offered: 'bridge', placements: 18, score: 210, loopsClosed: 4 };
}

/** Example states for screenshots, the debug menu and E2E setup: start, middle, win, lose. */
export const TRAIL_CLEAR_TESTING: TestingSpec<TrailClearState, TrailClearMove> = {
  bot: trailClearBot,
  examples: {
    start: START,
    middle,
    win: () => ({
      ...START(),
      cells: ALL_CELLS.map(() => null),
      offered: null,
      placements: knobsFor(0).bag,
      score: 480,
      loopsClosed: 7,
    }),
    lose,
  },
};
