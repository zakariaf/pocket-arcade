// apps/merge-siege/src/rules/intent-to-move.test.ts
// A swipe slides every tile that way (spec 13). One finger and no gesture works too: a tap on a side
// of the board slides the tiles toward that side, as the toy did (the one-handed and VoiceOver way,
// and the way the E2E flows play). Legality is "listMoves lists it", nothing else.
import fc from 'fast-check';

import { DIRECTIONS } from './board-cells.ts';
import { parseBoard } from './board-text.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';

import type { MergeSiegeState } from './merge-siege-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { SwipeDirection } from '@e07/game-kit/geom/classify-swipe.ts';

/** Seed 1, easiest row: two 2-enemies near the top, the player's 2, 2 and 4 near the bottom. */
const STATE = create(1, 0);
const cell = (col: number, row: number): BoardTarget => ({ regionId: 'board', col, row });
const tap = (target: BoardTarget): InputIntent => ({ kind: 'tap', target, selected: null });
const swipe = (direction: SwipeDirection): InputIntent => ({
  kind: 'swipe',
  direction,
  from: null,
});

/** One tile in the bottom-left corner: it can slide up or right, not down or left. */
const CORNERED: MergeSiegeState = {
  ...STATE,
  cells: parseBoard([
    '. . e2 . .',
    '. . . . .',
    '. . . . .',
    '. . . . .',
    '. . . . .',
    '2 . . . .',
  ]),
};

describe('intentToMove', () => {
  it('slides the tiles the way the finger swiped', () => {
    expect(intentToMove(STATE, swipe('up'))).toStrictEqual({ kind: 'swipe', direction: 'up' });
    expect(intentToMove(CORNERED, swipe('right'))).toStrictEqual({
      kind: 'swipe',
      direction: 'right',
    });
  });

  it('gives nothing for a swipe that would move nothing', () => {
    expect(intentToMove(CORNERED, swipe('down'))).toBeNull();
    expect(intentToMove(CORNERED, swipe('left'))).toBeNull();
  });

  it('slides toward the side of the board a tap lands on', () => {
    const moves = [cell(2, 0), cell(4, 2), cell(2, 5), cell(0, 3)].map((target) =>
      intentToMove(STATE, tap(target)),
    );
    expect(moves).toStrictEqual([
      { kind: 'swipe', direction: 'up' },
      { kind: 'swipe', direction: 'right' },
      { kind: 'swipe', direction: 'down' },
      { kind: 'swipe', direction: 'left' },
    ]);
  });

  it('slides up for a tap on the gate above the board', () => {
    const gate = { regionId: 'gate', col: 4, row: 0 };
    expect(intentToMove(STATE, tap(gate))).toStrictEqual({ kind: 'swipe', direction: 'up' });
  });

  it('gives a tap the same answer as the swipe it stands for, a wasted one included', () => {
    expect(intentToMove(CORNERED, tap(cell(0, 5)))).toBeNull();
    expect(intentToMove(CORNERED, tap(cell(4, 3)))).toStrictEqual(
      intentToMove(CORNERED, swipe('right')),
    );
  });

  it('gives no move once the run is won or lost (listMoves is empty)', () => {
    const won = {
      ...STATE,
      cells: STATE.cells.map((piece) => (piece?.kind === 'enemy' ? null : piece)),
      next: null,
    };
    const lost = {
      ...STATE,
      cells: parseBoard([
        '. . . . .',
        '. . . . .',
        '. . . . .',
        '. . . . .',
        '2 . . . .',
        'e8 . . . .',
      ]),
    };
    expect(listMoves(won)).toStrictEqual([]);
    expect(listMoves(lost)).toStrictEqual([]);
    expect(DIRECTIONS.map((direction) => intentToMove(won, swipe(direction)))).toStrictEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(intentToMove(lost, tap(cell(2, 0)))).toBeNull();
  });

  it('ignores intents this game does not use', () => {
    const unused: InputIntent[] = [
      { kind: 'long-press', target: cell(1, 1) },
      { kind: 'drag-end', from: cell(0, 0), to: cell(1, 1) },
      { kind: 'aim', dx: 10, dy: -40 },
      tap({ regionId: 'tray', col: 0, row: 0 }),
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
          col: fc.integer({ min: -1, max: 5 }),
          row: fc.integer({ min: -1, max: 6 }),
          direction: fc.constantFrom(...DIRECTIONS),
        }),
        ({ seed, difficulty, col, row, direction }) => {
          const state = create(seed, difficulty);
          const listed = listMoves(state).map((legal) => JSON.stringify(legal));
          for (const intent of [tap(cell(col, row)), swipe(direction)]) {
            const move = intentToMove(state, intent);
            expect(move === null || listed.includes(JSON.stringify(move))).toBe(true);
          }
        },
      ),
      { seed: 3, numRuns: 200 },
    );
  });
});
