// apps/scrap-shove/src/rules/intent-to-move.test.ts
import fc from 'fast-check';

import { applyMove } from './apply-move.ts';
import { stateFromText } from './board-text.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';

import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** The player in the middle, a heap that can move east, a heap stuck against another, a robot. */
const STATE = stateFromText(['n.....', '......', '..@#..', '..#...', '..#...', '......']);
const cell = (col: number, row: number): BoardTarget => ({ regionId: 'board', col, row });
const tap = (target: BoardTarget): InputIntent => ({ kind: 'tap', target, selected: null });

describe('intentToMove', () => {
  it('steps onto a free square next to the player (spec 10 BOARD AND CONTROLS: "Turns taps / swipes / drags into moves.")', () => {
    expect(intentToMove(STATE, tap(cell(1, 1)))).toStrictEqual({ kind: 'step', col: 1, row: 1 });
  });

  it('shoves the scrap on a tapped square when it can move, and refuses a heap that cannot', () => {
    expect(intentToMove(STATE, tap(cell(3, 2)))).toStrictEqual({ kind: 'shove', col: 3, row: 2 });
    expect(intentToMove(STATE, tap(cell(2, 3)))).toBeNull();
  });

  it('waits when the player taps their own square', () => {
    expect(intentToMove(STATE, tap(cell(2, 2)))).toStrictEqual({ kind: 'wait' });
  });

  it('refuses a square farther away, a square off the floor and any other region', () => {
    expect(intentToMove(STATE, tap(cell(4, 4)))).toBeNull();
    expect(intentToMove(STATE, tap(cell(-1, 2)))).toBeNull();
    expect(intentToMove(STATE, tap({ regionId: 'tray', col: 0, row: 0 }))).toBeNull();
  });

  it('gives no move once the floor is cleared (listMoves is empty)', () => {
    const won = applyMove(stateFromText(['n.n.', '....', '....', '.@..']), { kind: 'wait' }).state;
    expect(listMoves(won)).toStrictEqual([]);
    expect(intentToMove(won, tap(cell(1, 2)))).toBeNull();
  });

  it('gives no move once a robot caught the player', () => {
    const lost = applyMove(stateFromText(['....', '.n..', '..@.', '....']), { kind: 'wait' }).state;
    expect(intentToMove(lost, tap(cell(2, 2)))).toBeNull();
    expect(intentToMove(lost, tap(cell(3, 3)))).toBeNull();
  });

  it('ignores intents this game does not use', () => {
    const unused: InputIntent[] = [
      { kind: 'swipe', direction: 'up', from: null },
      { kind: 'long-press', target: cell(1, 1) },
      { kind: 'drag-end', from: cell(2, 2), to: cell(1, 1) },
      { kind: 'aim', dx: 10, dy: -40 },
    ];
    expect(unused.map((intent) => intentToMove(STATE, intent))).toStrictEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('returns only moves that listMoves lists, and every listed move has a tap', () => {
    fc.assert(
      fc.property(
        fc.record({
          seed: fc.nat({ max: 9_999 }),
          difficulty: fc.integer({ min: 0, max: 100 }),
          col: fc.integer({ min: -1, max: 8 }),
          row: fc.integer({ min: -1, max: 8 }),
        }),
        ({ seed, difficulty, col, row }) => {
          const state = create(seed, difficulty);
          const move = intentToMove(state, tap(cell(col, row)));
          const listed = listMoves(state).map((legal) => JSON.stringify(legal));
          expect(move === null || listed.includes(JSON.stringify(move))).toBe(true);
          const squares = Array.from({ length: 64 }, (_, i) => cell(i % 8, Math.floor(i / 8)));
          const reached = new Set(
            squares.map((square) => JSON.stringify(intentToMove(state, tap(square)))),
          );
          expect(listed.every((legal) => reached.has(legal))).toBe(true);
        },
      ),
      { seed: 5, numRuns: 40 },
    );
  });
});
