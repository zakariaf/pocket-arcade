// apps/swap-guard/src/board/to-view.test.ts
// Spec 10 BOARD AND CONTROLS: "Draws the board from the state"; spec 7.3: numbers follow the
// chosen digits, so the view holds them already localised.
import fc from 'fast-check';

import { applyMove } from '@e07/swap-guard/rules/apply-move.ts';
import { create } from '@e07/swap-guard/rules/create.ts';
import { listMoves } from '@e07/swap-guard/rules/list-moves.ts';

import { toView } from './to-view.ts';

import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';
import type { SwapGuardState } from '@e07/swap-guard/rules/swap-guard-types.ts';

const LATIN: ViewFormat = { formatNumber: (value) => String(value) };
const PERSIAN: ViewFormat = {
  formatNumber: (value) =>
    String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(digit))),
};

/** A 5 x 5 board: the guard at 12, a spear above it facing down, an archer at 0 facing right. */
const BOARD: SwapGuardState = {
  ...create(1, 0),
  size: 5,
  guard: 12,
  enemies: [
    { id: 0, kind: 'archer', facing: 'right', cell: 0 },
    { id: 1, kind: 'spear', facing: 'down', cell: 7 },
    { id: 2, kind: 'brute', facing: 'up', cell: 24 },
  ],
  enemyCount: 4,
  swaps: 3,
  maxSwaps: 15,
};

describe('toView', () => {
  it('copies the board and its pieces, and counts the swaps left in the chosen digits', () => {
    const view = toView(BOARD, PERSIAN);
    expect([view.size, view.guard, view.enemies]).toStrictEqual([5, 12, BOARD.enemies]);
    expect(view.swapsLeftText).toBe('۱۲');
    expect([view.swapsLeft, view.maxSwaps]).toStrictEqual([12, 15]);
    expect([view.defeated, view.total, view.isHit]).toStrictEqual([1, 4, false]);
  });

  it('marks every square a strike will land on, pointing the way the strike goes', () => {
    // The archer's arrow flies right until it meets nobody (the whole top row); the spear strikes
    // the guard below it; the brute in the corner slams up and left.
    expect(toView(BOARD, LATIN).marks).toStrictEqual([
      { cell: 1, facing: 'right' },
      { cell: 2, facing: 'right' },
      { cell: 3, facing: 'right' },
      { cell: 4, facing: 'right' },
      { cell: 12, facing: 'down' },
      { cell: 19, facing: 'up' },
      { cell: 23, facing: 'left' },
    ]);
  });

  it('keeps the enemies the last swap knocked out, so the board can show them fall', () => {
    const start = create(1, 0);
    const double = listMoves(start)
      .map((move) => applyMove(start, move).state)
      .find((state) => state.enemies.length === start.enemies.length - 2);
    expect(double).toBeDefined();
    const view = toView(double ?? start, LATIN);
    expect(view.fallen).toStrictEqual(double?.lastSwap?.defeated);
    expect(toView(start, LATIN).fallen).toStrictEqual([]);
  });

  it('keeps the swaps left at zero or more', () => {
    expect(toView({ ...BOARD, swaps: 15 }, LATIN).swapsLeft).toBe(0);
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
