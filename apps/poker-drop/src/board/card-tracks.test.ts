// apps/poker-drop/src/board/card-tracks.test.ts
import { cardOf } from '@e07/poker-drop/rules/cards.ts';
import { busiestBoardTurn } from '@e07/poker-drop/testing/poker-drop-board-turn.ts';

import { traceCards } from './card-tracks.ts';

import type { PokerDropEvent } from '@e07/poker-drop/rules/poker-drop-types.ts';

const KING = cardOf(13, 0);
const QUEEN = cardOf(12, 1);
/** Two lines that share cell 0 burst together: the shared card leaves once. */
const SHARED: readonly PokerDropEvent[] = [
  {
    kind: 'hand-burst',
    step: 1,
    hand: 'two-pair',
    lineKind: 'row',
    line: [0, 1, 2, 3, 4],
    cells: [0, 1],
    cards: [KING, QUEEN],
    points: 20,
    atMs: 400,
  },
  {
    kind: 'hand-burst',
    step: 1,
    hand: 'two-pair',
    lineKind: 'column',
    line: [0, 5, 10, 15, 20],
    cells: [0, 5],
    cards: [KING, cardOf(9, 2)],
    points: 20,
    atMs: 400,
  },
];

describe('traceCards', () => {
  it('lets a card in two bursting lines leave once', () => {
    const { gone } = traceCards(SHARED);
    expect(gone.map((card) => [card.path.card, card.path.col, card.row])).toStrictEqual([
      [KING, 0, 0],
      [QUEEN, 1, 0],
      [cardOf(9, 2), 0, 1],
    ]);
  });

  it('gives a card first named after a rise the rise that brought it up', () => {
    const events: readonly PokerDropEvent[] = [
      { kind: 'row-rose', cards: [1, 2, 3, 4, 5], atMs: 100, landMs: 300 },
      {
        kind: 'cards-fell',
        step: 1,
        falls: [{ card: KING, col: 2, fromRow: 3, toRow: 1, landMs: 700 }],
        atMs: 500,
      },
    ];
    expect(traceCards(events).survivors).toStrictEqual([
      [
        7,
        {
          col: 2,
          card: KING,
          segments: [
            { startMs: 100, endMs: 300, fromRow: 2, toRow: 3, easing: 'in-out-quad' },
            { startMs: 500, endMs: 700, fromRow: 3, toRow: 1, easing: 'in-quad' },
          ],
        },
      ],
    ]);
  });

  it('follows the busiest turn: seven cards moved and stayed, twelve left, the drop landed at 408 ms', () => {
    const trace = traceCards(busiestBoardTurn().result.events);
    expect(trace.survivors.map(([index]) => index)).toStrictEqual([1, 2, 3, 4, 5, 6, 10]);
    expect(trace.gone).toHaveLength(12);
    expect(trace.drop?.landMs).toBe(408);
  });

  it('follows no card through a move that names none', () => {
    expect(traceCards([{ kind: 'card-dealt', hand: 1, next: 2, atMs: 0 }])).toStrictEqual({
      survivors: [],
      gone: [],
      drop: null,
    });
  });

  it('lets a top-row hole leave the well as the row rises, so the card that rises into it can burst', () => {
    const burstAt = (atMs: number, card: number): PokerDropEvent => ({
      kind: 'hand-burst',
      step: 1,
      hand: 'two-pair',
      lineKind: 'row',
      line: [25, 26, 27, 28, 29],
      cells: [25],
      cards: [card],
      points: 20,
      atMs,
    });
    const events: readonly PokerDropEvent[] = [
      burstAt(100, KING),
      { kind: 'row-rose', cards: [1, 2, 3, 4, 5], atMs: 200, landMs: 400 },
      burstAt(500, QUEEN),
    ];
    const { gone } = traceCards(events);
    expect(gone.map((card) => [card.path.card, card.row, card.path.segments.length])).toStrictEqual(
      [
        [KING, 5, 0],
        [QUEEN, 5, 1],
      ],
    );
  });
});
