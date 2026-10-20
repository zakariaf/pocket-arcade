// apps/poker-drop/src/testing/poker-drop-board-turn.ts
// The busiest turn the board's tests and pixel goldens replay: seed 1 at difficulty 0 with a few
// loose low cards stacked on the prepared opening, and the eighth drop into the gap column. It makes
// a two-step cascade, raises a row whose own hand bursts, and lets the cards above fall after every
// burst, so every event kind of a drop reaches the board.
import { applyMove } from '@e07/poker-drop/rules/apply-move.ts';
import { cardOf } from '@e07/poker-drop/rules/cards.ts';
import { create } from '@e07/poker-drop/rules/create.ts';

import type {
  PokerDropMove,
  PokerDropResult,
  PokerDropState,
} from '@e07/poker-drop/rules/poker-drop-types.ts';

/** Loose cards above the two prepared rows (cell index -> card): no line is full, so no hand. */
const LOOSE: Readonly<Partial<Record<number, number>>> = {
  10: cardOf(2, 0),
  11: cardOf(4, 1),
  12: cardOf(6, 2),
  13: cardOf(8, 3),
  15: cardOf(3, 3),
  16: cardOf(5, 0),
};

export type BoardTurn = {
  readonly start: PokerDropState;
  readonly move: PokerDropMove;
  readonly result: PokerDropResult;
};

/** The start state, the move and its result: the same three on every run. */
export function busiestBoardTurn(): BoardTurn {
  const opening = create(1, 0);
  const cells = opening.cells.map((cell, index) => LOOSE[index] ?? cell);
  // The eighth drop of a level whose row rises every 8 drops: the rising row follows the cascade.
  const start = { ...opening, cells, drops: 7 };
  const move: PokerDropMove = { kind: 'drop-card', col: 4 };
  return { start, move, result: applyMove(start, move) };
}
