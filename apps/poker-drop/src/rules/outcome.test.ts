// apps/poker-drop/src/rules/outcome.test.ts
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { create } from './create.ts';
import { WELL_FULL, outcome } from './outcome.ts';

import type { PokerDropState } from './poker-drop-types.ts';

/** A well with every cell holding a card (the cards do not matter to the outcome). */
function fullWell(state: PokerDropState): PokerDropState {
  return { ...state, cells: state.cells.map((_, index) => index % 52) };
}

describe('outcome', () => {
  // S7: a short, friendly lose reason; spec 8.1: score games rate stars by score.
  it('is won with the score once the level goal of hands is made', () => {
    const start = create(1, 0);
    expect(outcome({ ...start, handsMade: start.goal, score: 340 })).toStrictEqual({
      kind: 'won',
      score: 340,
    });
    expect(outcome({ ...start, handsMade: start.goal + 2, score: 500 })).toStrictEqual({
      kind: 'won',
      score: 500,
    });
  });

  it('is lost with poker-drop.lose.well-full when no column has room', () => {
    expect(outcome(fullWell(create(1, 30)))).toStrictEqual({ kind: 'lost', reasonKey: WELL_FULL });
    expect(WELL_FULL).toBe('poker-drop.lose.well-full');
  });

  it('is lost when a rising row pushed a card past the top, even with room left', () => {
    expect(outcome({ ...create(1, 30), hasOverflowed: true })).toStrictEqual({
      kind: 'lost',
      reasonKey: WELL_FULL,
    });
  });

  it('prefers the win when the last drop both makes the goal and fills the well', () => {
    const start = create(2, 0);
    expect(outcome({ ...fullWell(start), handsMade: start.goal, score: 90 }).kind).toBe('won');
  });

  it('keeps an endless run (goal 0) playing, however many hands it makes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000 }), fc.nat(1000), (seed, hands) => {
        const endless = create(seed, ENDLESS_DIFFICULTY);
        expect(outcome({ ...endless, handsMade: hands }).kind).toBe('playing');
      }),
    );
  });

  it('is playing while the goal is ahead and a column has room', () => {
    expect(outcome(create(3, 60))).toStrictEqual({ kind: 'playing' });
  });
});
