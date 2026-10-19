// apps/poker-drop/src/rules/poker-drop-evaluate.test.ts
import { cardOf } from './cards.ts';
import { create } from './create.ts';
import { evaluatePokerDrop } from './poker-drop-evaluate.ts';
import { cellIndex, emptyWell } from './well.ts';

import type { Cell, PokerDropState } from './poker-drop-types.ts';

/** A start state whose well holds exactly these cards (col, row, rank, suit). */
function withCards(cards: readonly (readonly [number, number, number, number])[]): PokerDropState {
  const cells: Cell[] = emptyWell();
  for (const [col, row, rank, suit] of cards) cells[cellIndex(col, row)] = cardOf(rank, suit);
  return { ...create(1, 0), cells };
}

describe('evaluatePokerDrop', () => {
  // game-balance-and-bots: the evaluation values a position as a reasonable person does.
  it('rates a won position above any playing one, and a lost one below', () => {
    const start = create(1, 0);
    const won = { ...start, handsMade: start.goal, score: 100 };
    const lost = { ...start, hasOverflowed: true };
    expect(evaluatePokerDrop(won)).toBeGreaterThan(
      evaluatePokerDrop({ ...start, handsMade: 5, score: 900 }),
    );
    expect(evaluatePokerDrop(lost)).toBeLessThan(evaluatePokerDrop(start));
  });

  it('values more hands made and more points', () => {
    const start = create(1, 0);
    expect(evaluatePokerDrop({ ...start, handsMade: 3 })).toBeGreaterThan(evaluatePokerDrop(start));
    expect(evaluatePokerDrop({ ...start, score: 50 })).toBeGreaterThan(evaluatePokerDrop(start));
  });

  it('prefers spreading the cards to stacking a nearly full column', () => {
    const column = [
      [0, 0, 2, 0],
      [0, 1, 4, 1],
      [0, 2, 6, 2],
      [0, 3, 8, 3],
    ] as const;
    const stacked = withCards([...column, [0, 4, 10, 0]]);
    const spread = withCards([...column, [1, 0, 10, 0]]);
    expect(evaluatePokerDrop(spread)).toBeGreaterThan(evaluatePokerDrop(stacked));
  });

  it('values a pair in an open line, the promise of a hand', () => {
    const pair = withCards([
      [0, 0, 9, 0],
      [1, 0, 9, 1],
    ]);
    const none = withCards([
      [0, 0, 9, 0],
      [1, 0, 4, 1],
    ]);
    expect(evaluatePokerDrop(pair)).toBeGreaterThan(evaluatePokerDrop(none));
  });

  it('keeps the pinned value of the seed 1 opening', () => {
    expect(evaluatePokerDrop(create(1, 0))).toBe(GOLDEN_SEED_1_VALUE);
  });
});

/** Seed 1, difficulty 0: two prepared two-pair rows, 8 cards (cost 16), their pairs and suits promised. */
const GOLDEN_SEED_1_VALUE = 32;
