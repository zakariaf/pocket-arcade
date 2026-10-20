// apps/poker-drop/src/board/to-view.test.ts
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { isRiseDue } from '@e07/poker-drop/rules/apply-move.ts';
import { cardOf } from '@e07/poker-drop/rules/cards.ts';
import { create } from '@e07/poker-drop/rules/create.ts';

import { EMPTY_CELL } from './board-ids.ts';
import { dropsBeforeRise, toView } from './to-view.ts';

const PERSIAN = { formatNumber: (value: number) => new Intl.NumberFormat('fa').format(value) };
const LATIN = { formatNumber: String };
const START = create(3, 0);

describe('toView', () => {
  it('keeps the well bottom row first, with EMPTY_CELL for an empty cell, and both cards dealt', () => {
    const cells = START.cells.map((_, index) => (index === 2 ? cardOf(14, 1) : null));
    const view = toView({ ...START, cells, hand: cardOf(9, 0), next: cardOf(10, 3) }, LATIN);
    expect(view).toMatchObject({ cols: 5, rows: 6, hand: cardOf(9, 0), next: cardOf(10, 3) });
    expect(view.cells).toHaveLength(30);
    expect(view.cells[2]).toBe(cardOf(14, 1));
    expect(view.cells.filter((cell) => cell === EMPTY_CELL)).toHaveLength(29);
  });

  // spec 13 (design notes 1): "The board shows the drops left before the next rise"; spec 7.3:
  // numbers drawn on game boards follow the chosen digits.
  it('counts the drops before the next rising row and localises them', () => {
    expect(toView({ ...START, drops: 5 }, PERSIAN)).toMatchObject({
      riseDrops: 3,
      riseText: '۳',
    });
  });

  it('labels each cascade step with its localised multiplier', () => {
    const view = toView(START, PERSIAN);
    expect(view.stepTexts[2]).toBe('×۲');
    expect(view.stepTexts[9]).toBe('×۹');
    expect(toView(START, LATIN).stepTexts[3]).toBe('×3');
  });
});

describe('dropsBeforeRise', () => {
  it('counts down to the next rise of a level row (the easiest rises every 8 drops)', () => {
    expect(dropsBeforeRise(0, 0)).toBe(8);
    expect(dropsBeforeRise(0, 7)).toBe(1);
    expect(dropsBeforeRise(0, 8)).toBe(8);
  });

  it('follows the endless ramp (the rows rise one drop sooner every 40 drops)', () => {
    expect(dropsBeforeRise(ENDLESS_DIFFICULTY, 0)).toBe(10);
    expect(dropsBeforeRise(ENDLESS_DIFFICULTY, 38)).toBe(7);
  });

  it('names exactly the drop that the rules raise the next row after', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), fc.nat({ max: 600 }), (difficulty, drops) => {
        const ahead = dropsBeforeRise(difficulty, drops);
        expect(isRiseDue(difficulty, drops + ahead)).toBe(true);
        for (let step = 1; step < ahead; step += 1) {
          expect(isRiseDue(difficulty, drops + step)).toBe(false);
        }
      }),
      { seed: 27, numRuns: 200 },
    );
  });
});
