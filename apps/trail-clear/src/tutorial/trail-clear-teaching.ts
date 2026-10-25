// apps/trail-clear/src/tutorial/trail-clear-teaching.ts
// Spec S13: the first level teaches itself with a pointer hand and one short sentence at a time.
// The tutorial is the last four tiles of an easy level, on a board that holds one road: a house on
// the left and a bend on the right. Join them with a straight, turn a bend to lead the road on,
// close it with a house to clear its five tiles, and place the last tile to win.
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { traySlotTarget } from '@e07/trail-clear/board/layout-board.ts';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { cellAt } from '@e07/trail-clear/rules/board-cells.ts';
import { create } from '@e07/trail-clear/rules/create.ts';
import { distinctTurns } from '@e07/trail-clear/rules/tiles.ts';
import { knobsFor } from '@e07/trail-clear/rules/trail-clear-tuning.ts';

import type { TeachingSpec, TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type {
  PlacedTile,
  TileKind,
  TrailClearMove,
  TrailClearState,
} from '@e07/trail-clear/rules/trail-clear-types.ts';

/** The easiest level row: the tutorial is its run with four tiles left in the bag. */
const DIFFICULTY = 0;
/** This seed deals the bend, the house and a straight after the first three placements. */
const DEAL_SEED = 25;

/** The tile the tutorial starts with and ends with. */
const STRAIGHT: TileKind = 'road-straight';

type Spot = { readonly col: number; readonly row: number; readonly tile: PlacedTile };

/** A level-0 position with these tiles, this offered tile and `left` tiles still to place. */
function position(spots: readonly Spot[], offered: TileKind, left: number): TrailClearState {
  const cells: (PlacedTile | null)[] = create(1, DIFFICULTY).cells.map(() => null);
  for (const spot of spots) cells[cellAt(spot.col, spot.row)] = spot.tile;
  return {
    ...create(1, DIFFICULTY),
    cells,
    offered,
    placements: knobsFor(DIFFICULTY).bag - left,
    score: 0,
    loopsClosed: 0,
    rng: seedRng(DEAL_SEED),
  };
}

/** An opening tile (placed before the first move): only the real opening's ends may be one. */
function opening(kind: TileKind, turns: number): PlacedTile {
  return { kind, turns, placedAt: 0 };
}

/** A tile placed earlier in the run, by placement `placedAt`. */
function earlier(kind: TileKind, turns: number, placedAt: number): PlacedTile {
  return { kind, turns, placedAt };
}

function place(turns: number, col: number, row: number): TrailClearMove {
  return { kind: 'place-tile', turns, col, row };
}

/** The drag from the tray slot showing the move's turn of `offered` to the move's cell. */
function drag(offered: TileKind, move: TrailClearMove): TutorialPointer {
  return {
    kind: 'drag',
    from: traySlotTarget(distinctTurns(offered).indexOf(move.turns)),
    to: { regionId: 'board', col: move.col, row: move.row },
  };
}

/** A house facing east at (1, 2) and a bend from the west up to (3, 1) at (3, 2). */
const TUTORIAL_START = position(
  [
    { col: 1, row: 2, tile: earlier('road-end', 1, 1) },
    { col: 3, row: 2, tile: earlier('road-bend', 3, 2) },
  ],
  STRAIGHT,
  4,
);
/** Straight east to west between the house and the bend. */
const JOIN = place(1, 2, 2);
/** A bend from the south to the west, above the first bend. */
const TURN = place(2, 3, 1);
/** A house facing east closes the road: five tiles cleared. */
const CLOSE = place(1, 2, 1);
/** The last tile, upright in the middle of the empty board. */
const LAST = place(0, 2, 2);
const AFTER_JOIN = applyMove(TUTORIAL_START, JOIN).state;
const AFTER_TURN = applyMove(AFTER_JOIN, TURN).state;
/** How to play, page 4: a ford between a house above and a pond below closes both at once. */
const DOUBLE = position(
  [
    { col: 2, row: 1, tile: opening('road-end', 2) },
    { col: 2, row: 3, tile: opening('river-end', 0) },
  ],
  'ford',
  8,
);
const FORD = place(0, 2, 2);
const GOAL_ID = 'trail-clear.goal';

/** Spec S13: one short sentence per step, one pointer, one expected action; Skip from step 2. */
export const TRAIL_CLEAR_TEACHING: TeachingSpec<TrailClearState, TrailClearMove> = {
  tutorial: {
    start: TUTORIAL_START,
    steps: [
      {
        messageId: 'trail-clear.tutorial.step-1',
        pointer: drag(STRAIGHT, JOIN),
        expect: { kind: 'move', move: JOIN },
      },
      {
        messageId: 'trail-clear.tutorial.step-2',
        pointer: drag('road-bend', TURN),
        expect: { kind: 'move', move: TURN },
      },
      {
        messageId: 'trail-clear.tutorial.step-3',
        pointer: drag('road-end', CLOSE),
        expect: { kind: 'move', move: CLOSE },
      },
      {
        messageId: 'trail-clear.tutorial.step-4',
        pointer: drag(STRAIGHT, LAST),
        expect: { kind: 'move', move: LAST },
      },
    ],
  },
  howToPlay: [
    {
      titleId: GOAL_ID,
      bodyId: 'trail-clear.how-to-play.step-1',
      example: TUTORIAL_START,
      pointer: drag(STRAIGHT, JOIN),
    },
    {
      titleId: GOAL_ID,
      bodyId: 'trail-clear.how-to-play.step-2',
      example: AFTER_JOIN,
      pointer: drag('road-bend', TURN),
    },
    {
      titleId: GOAL_ID,
      bodyId: 'trail-clear.how-to-play.step-3',
      example: AFTER_TURN,
      pointer: drag('road-end', CLOSE),
    },
    {
      titleId: GOAL_ID,
      bodyId: 'trail-clear.how-to-play.step-4',
      example: DOUBLE,
      pointer: drag('ford', FORD),
    },
  ],
};
