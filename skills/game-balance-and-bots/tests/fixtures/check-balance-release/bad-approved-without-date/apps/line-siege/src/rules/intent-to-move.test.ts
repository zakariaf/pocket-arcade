// apps/line-siege/src/rules/intent-to-move.test.ts
import fc from 'fast-check';

import { create } from './create.ts';
import { LINE_SIEGE_SELECT_REGIONS, intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';

import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** Seed 1, difficulty 0: tray [free, vertical two, horizontal two]; column 7 lacks rows 3-4. */
const STATE = create(1, 0);
const cell = (col: number, row: number): BoardTarget => ({ regionId: 'board', col, row });
const slot = (index: number): BoardTarget => ({ regionId: 'tray', col: index, row: 0 });

describe('intentToMove', () => {
  it('places the dragged tray block with its top-start cell where the finger lets go', () => {
    expect(intentToMove(STATE, { kind: 'drag-end', from: slot(1), to: cell(7, 3) })).toStrictEqual({
      kind: 'place-block',
      trayIndex: 1,
      col: 7,
      row: 3,
    });
  });

  it('reads the slot from the row when the tray stands beside the board', () => {
    const beside = { regionId: 'tray', col: 0, row: 1 };
    expect(intentToMove(STATE, { kind: 'drag-end', from: beside, to: cell(7, 3) })).toStrictEqual({
      kind: 'place-block',
      trayIndex: 1,
      col: 7,
      row: 3,
    });
  });

  it('refuses a block that does not fit, a drop off the board and a drag that starts on the board', () => {
    const intents: InputIntent[] = [
      { kind: 'drag-end', from: slot(1), to: cell(7, 7) },
      { kind: 'drag-end', from: slot(1), to: null },
      { kind: 'drag-end', from: slot(1), to: slot(2) },
      { kind: 'drag-end', from: cell(0, 0), to: cell(7, 3) },
      { kind: 'drag-end', from: slot(5), to: cell(7, 3) },
    ];
    expect(intents.map((intent) => intentToMove(STATE, intent))).toStrictEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('refuses a slot whose block was already placed', () => {
    const used = { ...STATE, tray: [STATE.tray[0] ?? null, null, STATE.tray[2] ?? null] };
    expect(intentToMove(used, { kind: 'drag-end', from: slot(1), to: cell(7, 3) })).toBeNull();
  });

  it("places the selected slot's block where the next tap lands (tap-then-tap)", () => {
    const tap: InputIntent = { kind: 'tap', target: cell(7, 3), selected: slot(1) };
    expect(intentToMove(STATE, tap)).toStrictEqual({
      kind: 'place-block',
      trayIndex: 1,
      col: 7,
      row: 3,
    });
  });

  it('selects only on a tray tap and ignores a board tap without a selection', () => {
    const taps: InputIntent[] = [
      { kind: 'tap', target: slot(0), selected: null },
      { kind: 'tap', target: slot(2), selected: slot(1) },
      { kind: 'tap', target: cell(7, 3), selected: null },
      { kind: 'tap', target: cell(7, 7), selected: slot(1) },
    ];
    expect(taps.map((intent) => intentToMove(STATE, intent))).toStrictEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(LINE_SIEGE_SELECT_REGIONS).toStrictEqual(['tray']);
  });

  it('ignores long presses, swipes and aims', () => {
    const unused: InputIntent[] = [
      { kind: 'long-press', target: cell(1, 1) },
      { kind: 'swipe', direction: 'up', from: null },
      { kind: 'aim', dx: 10, dy: -40 },
    ];
    expect(unused.map((intent) => intentToMove(STATE, intent))).toStrictEqual([null, null, null]);
  });

  it('returns only moves that listMoves offers', () => {
    fc.assert(
      fc.property(
        fc.record({
          seed: fc.nat({ max: 9_999 }),
          from: fc.integer({ min: 0, max: 3 }),
          col: fc.integer({ min: -1, max: 8 }),
          row: fc.integer({ min: -1, max: 8 }),
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
});
