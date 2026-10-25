// apps/snare-snake/src/board/to-view.test.ts
// Spec 10 BOARD AND CONTROLS: "Draws the board from the state"; spec 7.3: numbers follow the
// chosen digits, so the view holds them already localised.
import fc from 'fast-check';

import { applyMove } from '@e07/snare-snake/rules/apply-move.ts';
import { create } from '@e07/snare-snake/rules/create.ts';

import { toView } from './to-view.ts';

import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';

const LATIN: ViewFormat = { formatNumber: (value) => String(value) };
const PERSIAN: ViewFormat = {
  formatNumber: (value) =>
    String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(digit))),
};
const at = (col: number, row: number): number => row * 7 + col;

describe('toView', () => {
  it('copies the board, the snake and the critters, and counts the moves left in the chosen digits', () => {
    const state = { ...create(1, 0), moves: 18 };
    const view = toView(state, PERSIAN);
    expect([view.cols, view.rows, view.snake]).toStrictEqual([7, 8, state.snake]);
    expect(view.movesLeftText).toBe('۱۲');
    expect([view.movesLeft, view.caught, view.total]).toStrictEqual([12, 0, 4]);
  });

  it('marks the critters next to the snake as frozen', () => {
    const state = {
      ...create(1, 0),
      snake: [at(1, 1), at(2, 1)],
      critters: [
        { id: 0, cell: at(1, 2) },
        { id: 1, cell: at(5, 5) },
      ],
    };
    expect(toView(state, LATIN).critters).toStrictEqual([
      { id: 0, cell: at(1, 2), isFrozen: true },
      { id: 1, cell: at(5, 5), isFrozen: false },
    ]);
  });

  it('looks the head the way it last moved, and right for a one-segment snake', () => {
    const base = create(1, 0);
    expect(toView({ ...base, snake: [at(3, 2), at(3, 3)] }, LATIN).heading).toBe('up');
    expect(toView({ ...base, snake: [at(2, 3), at(3, 3)] }, LATIN).heading).toBe('left');
    expect(toView({ ...base, snake: [at(3, 3)] }, LATIN).heading).toBe('right');
  });

  it('faces the way the player steered after closing a loop, not the bitten segment heading', () => {
    // Moving down into (3, 3), then steering left bites the segment at (2, 3), which was laid
    // moving up: the new head's neck sits below it, yet the snake turned left.
    const state = {
      ...create(1, 0),
      snake: [at(3, 3), at(3, 2), at(2, 2), at(2, 3), at(2, 4), at(2, 5)],
      critters: [{ id: 0, cell: at(6, 7) }],
    };
    const looped = applyMove(state, { kind: 'steer', direction: 'left' }).state;
    expect(looped.snake[0]).toBe(at(2, 3));
    expect(toView(looped, LATIN).heading).toBe('left');
  });

  it('is a pure function of the state (property)', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        const state = create(seed, difficulty);
        expect(toView(state, LATIN)).toStrictEqual(toView(structuredClone(state), LATIN));
      }),
    );
  });
});
