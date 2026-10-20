// apps/poker-drop/src/rules/intent-to-move.test.ts
import fc from 'fast-check';

import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';

import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** Seed 1 at difficulty 0: two prepared rows beside the empty gap column, every column open. */
const STATE = create(1, 0);
const cell = (col: number, row: number): BoardTarget => ({ regionId: 'well', col, row });
const tap = (target: BoardTarget): InputIntent => ({ kind: 'tap', target, selected: null });
/** Column 2 filled to the top: no room for another card. */
const FULL_COLUMN_2 = STATE.cells.map((card, index) => (index % 5 === 2 ? index : card));

describe('intentToMove', () => {
  // spec 13 (design notes 3): "A tap anywhere in a column that has room drops the card in hand there".
  it('drops the card into the tapped column, whichever row of it was tapped', () => {
    expect(intentToMove(STATE, tap(cell(3, 5)))).toStrictEqual({ kind: 'drop-card', col: 3 });
    expect(intentToMove(STATE, tap(cell(3, 0)))).toStrictEqual({ kind: 'drop-card', col: 3 });
    expect(intentToMove(STATE, tap(cell(0, 2)))).toStrictEqual({ kind: 'drop-card', col: 0 });
  });

  it('refuses a full column, a column off the well and any other region', () => {
    const full = { ...STATE, cells: FULL_COLUMN_2 };
    expect(intentToMove(full, tap(cell(2, 0)))).toBeNull();
    expect(intentToMove(full, tap(cell(1, 0)))).toStrictEqual({ kind: 'drop-card', col: 1 });
    expect(intentToMove(STATE, tap(cell(5, 0)))).toBeNull();
    expect(intentToMove(STATE, tap(cell(-1, 0)))).toBeNull();
    expect(intentToMove(STATE, tap({ regionId: 'tray', col: 0, row: 0 }))).toBeNull();
  });

  it('gives no move once the level is won (listMoves is empty)', () => {
    const won = { ...STATE, handsMade: STATE.goal };
    expect(listMoves(won)).toStrictEqual([]);
    expect(intentToMove(won, tap(cell(4, 0)))).toBeNull();
  });

  it('gives no move once the well is full (the run is lost)', () => {
    const lost = { ...STATE, cells: STATE.cells.map((_, index) => index % 52) };
    expect(intentToMove(lost, tap(cell(4, 0)))).toBeNull();
    expect(intentToMove({ ...STATE, hasOverflowed: true }, tap(cell(4, 0)))).toBeNull();
  });

  it('ignores intents this game does not use (its board has panMode none)', () => {
    const unused: InputIntent[] = [
      { kind: 'swipe', direction: 'down', from: null },
      { kind: 'long-press', target: cell(1, 1) },
      { kind: 'drag-end', from: cell(0, 0), to: cell(1, 1) },
      { kind: 'aim', dx: 10, dy: -40 },
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
          difficulty: fc.integer({ min: 0, max: 100 }),
          col: fc.integer({ min: -1, max: 6 }),
          row: fc.integer({ min: -1, max: 6 }),
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

  it('reaches every listed move with a tap on its column', () => {
    const moves = [0, 1, 2, 3, 4].map((col) => intentToMove(STATE, tap(cell(col, 3))));
    expect(moves).toStrictEqual(listMoves(STATE));
  });
});
