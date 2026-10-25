// apps/swap-guard/src/rules/intent-to-move.test.ts
// Spec 10 BOARD AND CONTROLS: "Turns a touch into a move (or nothing)"; spec 8.11: the game is
// playable with one finger: a tap on a square next to the guard swaps with it.
import fc from 'fast-check';

import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';

import type { SwapGuardState } from './swap-guard-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** A 5 x 5 board: the guard at column 1, row 1 (square 6), a spear below it, an archer far off. */
const STATE: SwapGuardState = {
  ...create(1, 0),
  size: 5,
  guard: 6,
  enemies: [
    { id: 0, kind: 'spear', facing: 'up', cell: 11 },
    { id: 1, kind: 'archer', facing: 'left', cell: 24 },
  ],
  enemyCount: 2,
};
const cell = (col: number, row: number): BoardTarget => ({ regionId: 'board', col, row });
const tap = (target: BoardTarget): InputIntent => ({ kind: 'tap', target, selected: null });

describe('intentToMove', () => {
  it('swaps with the tapped square next to the guard, an enemy or an empty tile', () => {
    // Square 11 holds a spear, square 0 is empty; both touch the guard (0 diagonally).
    expect(intentToMove(STATE, tap(cell(1, 2)))).toStrictEqual({ kind: 'swap', cell: 11 });
    expect(intentToMove(STATE, tap(cell(0, 0)))).toStrictEqual({ kind: 'swap', cell: 0 });
  });

  it('refuses the guard itself, a square further away, off the grid and any other region', () => {
    expect(intentToMove(STATE, tap(cell(1, 1)))).toBeNull();
    expect(intentToMove(STATE, tap(cell(3, 1)))).toBeNull();
    expect(intentToMove(STATE, tap(cell(STATE.size, 1)))).toBeNull();
    expect(intentToMove(STATE, tap(cell(-1, 1)))).toBeNull();
    expect(intentToMove(STATE, tap({ regionId: 'tray', col: 1, row: 2 }))).toBeNull();
  });

  it('gives no move once the run is won (no enemy stands)', () => {
    const won = { ...STATE, enemies: [] };
    expect(listMoves(won)).toStrictEqual([]);
    expect(intentToMove(won, tap(cell(1, 2)))).toBeNull();
  });

  it('gives no move once the run is lost (the guard was hit)', () => {
    const lost = { ...STATE, isHit: true };
    expect(intentToMove(lost, tap(cell(1, 2)))).toBeNull();
  });

  it('ignores intents this game does not use', () => {
    const unused: InputIntent[] = [
      { kind: 'swipe', direction: 'up', from: null },
      { kind: 'long-press', target: cell(1, 2) },
      { kind: 'drag-end', from: cell(1, 1), to: cell(1, 2) },
      { kind: 'aim', dx: 10, dy: -40 },
    ];
    expect(unused.map((intent) => intentToMove(STATE, intent))).toStrictEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('returns only moves that listMoves lists, and every listed move from its tap (property)', () => {
    fc.assert(
      fc.property(
        fc.record({
          seed: fc.nat({ max: 9_999 }),
          difficulty: fc.integer({ min: 0, max: 100 }),
          col: fc.integer({ min: -1, max: 6 }),
          row: fc.integer({ min: -1, max: 6 }),
        }),
        ({ seed, difficulty, col, row }) => {
          const state = create(seed, difficulty);
          const move = intentToMove(state, tap(cell(col, row)));
          const listed = listMoves(state);
          expect(move === null || listed.some((legal) => legal.cell === move.cell)).toBe(true);
          const reached = listed.map((legal) =>
            intentToMove(
              state,
              tap(cell(legal.cell % state.size, Math.floor(legal.cell / state.size))),
            ),
          );
          expect(reached).toStrictEqual(listed);
        },
      ),
      { seed: 3, numRuns: 200 },
    );
  });
});
