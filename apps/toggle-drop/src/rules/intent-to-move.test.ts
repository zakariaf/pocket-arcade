// apps/toggle-drop/src/rules/intent-to-move.test.ts
import fc from 'fast-check';

import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';

import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** Seed 1 at difficulty 0: 5 columns, 3 peg rows (grid rows 0 to 4: chute, pegs, cups). */
const STATE = create(1, 0);
const cell = (col: number, row: number): BoardTarget => ({ regionId: 'board', col, row });
const tap = (target: BoardTarget): InputIntent => ({ kind: 'tap', target, selected: null });

describe('intentToMove', () => {
  it('drops a ball in the tapped column, from the chute down to its cup', () => {
    const rows = [0, 2, STATE.rows + 1];
    expect(rows.map((row) => intentToMove(STATE, tap(cell(3, row))))).toStrictEqual([
      { kind: 'drop', col: 3 },
      { kind: 'drop', col: 3 },
      { kind: 'drop', col: 3 },
    ]);
  });

  it('refuses a column off the board and any other region', () => {
    expect(intentToMove(STATE, tap(cell(STATE.cols, 0)))).toBeNull();
    expect(intentToMove(STATE, tap(cell(-1, 0)))).toBeNull();
    expect(intentToMove(STATE, tap({ regionId: 'tray', col: 0, row: 0 }))).toBeNull();
  });

  it('gives no move once the run is won (every cup full)', () => {
    const won = { ...STATE, filled: STATE.needs };
    expect(listMoves(won)).toStrictEqual([]);
    expect(intentToMove(won, tap(cell(1, 1)))).toBeNull();
  });

  it('gives no move once the run is lost (no balls left)', () => {
    const lost = { ...STATE, ballsLeft: 0 };
    expect(intentToMove(lost, tap(cell(1, 1)))).toBeNull();
  });

  it('ignores intents this game does not use', () => {
    const unused: InputIntent[] = [
      { kind: 'swipe', direction: 'down', from: null },
      { kind: 'long-press', target: cell(1, 1) },
      { kind: 'drag-end', from: cell(0, 0), to: cell(1, 1) },
      { kind: 'aim', dx: 10, dy: 40 },
    ];
    expect(unused.map((intent) => intentToMove(STATE, intent))).toStrictEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('returns only moves that listMoves lists', () => {
    fc.assert(
      fc.property(
        fc.record({
          seed: fc.nat({ max: 9_999 }),
          difficulty: fc.integer({ min: 0, max: 99 }),
          col: fc.integer({ min: -1, max: 9 }),
          row: fc.integer({ min: -1, max: 9 }),
        }),
        ({ seed, difficulty, col, row }) => {
          const state = create(seed, difficulty);
          const move = intentToMove(state, tap(cell(col, row)));
          const listed = listMoves(state).map((legal) => JSON.stringify(legal));
          expect(move === null || listed.includes(JSON.stringify(move))).toBe(true);
        },
      ),
      { seed: 3, numRuns: 200 },
    );
  });
});
