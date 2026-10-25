// apps/trail-clear/src/rules/intent-to-move.test.ts
// Spec 13 (trail-clear): "Drag the offered tile onto the board; edges must match". A drag from a
// tray slot (one slot per distinct turn of the offered tile) to a board cell places that turn
// there; tap-then-tap does the same (a tray tap only selects: UI state, never a move). Legality is
// "listMoves offers this move", nothing else.
import fc from 'fast-check';

import { create } from './create.ts';
import { TRAIL_CLEAR_SELECT_REGIONS, intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { distinctTurns } from './tiles.ts';

import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** Seed 1, difficulty 0: the ford is offered; turned once it closes the opening's double at (3, 2). */
const STATE = create(1, 0);
const cell = (col: number, row: number): BoardTarget => ({ regionId: 'board', col, row });
const slot = (index: number): BoardTarget => ({ regionId: 'tray', col: index, row: 0 });
const DOUBLE = { kind: 'place-tile', turns: 1, col: 3, row: 2 } as const;

describe('intentToMove', () => {
  it('places the dragged turn where the finger lets go', () => {
    expect(intentToMove(STATE, { kind: 'drag-end', from: slot(1), to: cell(3, 2) })).toStrictEqual(
      DOUBLE,
    );
  });

  it('reads the slot from the row when the tray stands beside the board', () => {
    const beside = { regionId: 'tray', col: 0, row: 1 };
    expect(intentToMove(STATE, { kind: 'drag-end', from: beside, to: cell(3, 2) })).toStrictEqual(
      DOUBLE,
    );
  });

  it('refuses a turn that does not fit, a drop off the board, a missing slot and a drag from the board', () => {
    const intents: InputIntent[] = [
      { kind: 'drag-end', from: slot(0), to: cell(3, 2) },
      { kind: 'drag-end', from: slot(1), to: null },
      { kind: 'drag-end', from: slot(1), to: slot(2) },
      { kind: 'drag-end', from: cell(0, 1), to: cell(3, 2) },
      { kind: 'drag-end', from: slot(5), to: cell(3, 2) },
    ];
    expect(intents.map((intent) => intentToMove(STATE, intent))).toStrictEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('cancels a drag released back where it started: no move, the tile stays offered', () => {
    const back = distinctTurns('ford').map((_, index) =>
      intentToMove(STATE, { kind: 'drag-end', from: slot(index), to: slot(index) }),
    );
    expect(back).toStrictEqual(distinctTurns('ford').map(() => null));
    const onBoard = intentToMove(STATE, { kind: 'drag-end', from: cell(3, 2), to: cell(3, 2) });
    expect(onBoard).toBeNull();
  });

  it('places the selected turn where the next tap lands (tap-then-tap)', () => {
    const tap: InputIntent = { kind: 'tap', target: cell(3, 2), selected: slot(1) };
    expect(intentToMove(STATE, tap)).toStrictEqual(DOUBLE);
  });

  it('selects only on a tray tap and ignores a board tap without a selection', () => {
    const taps: InputIntent[] = [
      { kind: 'tap', target: slot(0), selected: null },
      { kind: 'tap', target: slot(2), selected: slot(1) },
      { kind: 'tap', target: cell(3, 2), selected: null },
      { kind: 'tap', target: cell(3, 2), selected: slot(0) },
    ];
    expect(taps.map((intent) => intentToMove(STATE, intent))).toStrictEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(TRAIL_CLEAR_SELECT_REGIONS).toStrictEqual(['tray']);
  });

  it('ignores long presses, swipes and aims', () => {
    const unused: InputIntent[] = [
      { kind: 'long-press', target: cell(1, 1) },
      { kind: 'swipe', direction: 'up', from: null },
      { kind: 'aim', dx: 10, dy: -40 },
    ];
    expect(unused.map((intent) => intentToMove(STATE, intent))).toStrictEqual([null, null, null]);
  });

  it('gives nothing once the bag is empty (a won level)', () => {
    const won = { ...STATE, offered: null };
    expect(intentToMove(won, { kind: 'drag-end', from: slot(1), to: cell(3, 2) })).toBeNull();
  });

  it('returns only moves that listMoves offers, and the same move by tap and by drag', () => {
    fc.assert(
      fc.property(
        fc.record({
          seed: fc.nat({ max: 9_999 }),
          from: fc.integer({ min: 0, max: 4 }),
          col: fc.integer({ min: -1, max: 5 }),
          row: fc.integer({ min: -1, max: 5 }),
        }),
        ({ seed, from, col, row }) => {
          const state = create(seed, 0);
          const drag = intentToMove(state, {
            kind: 'drag-end',
            from: slot(from),
            to: cell(col, row),
          });
          const tap = intentToMove(state, {
            kind: 'tap',
            target: cell(col, row),
            selected: slot(from),
          });
          const listed = listMoves(state).map((candidate) => JSON.stringify(candidate));
          expect(drag === null || listed.includes(JSON.stringify(drag))).toBe(true);
          expect(JSON.stringify(tap)).toBe(JSON.stringify(drag));
        },
      ),
      { seed: 3, numRuns: 200 },
    );
  });

  it('reaches every listed move from some slot and cell', () => {
    const turns = distinctTurns(STATE.offered ?? 'ford');
    const reached = listMoves(STATE).filter(
      (move) =>
        intentToMove(STATE, {
          kind: 'drag-end',
          from: slot(turns.indexOf(move.turns)),
          to: cell(move.col, move.row),
        }) !== null,
    );
    expect(reached).toHaveLength(listMoves(STATE).length);
  });
});
