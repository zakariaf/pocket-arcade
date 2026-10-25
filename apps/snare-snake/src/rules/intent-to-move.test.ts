// apps/snare-snake/src/rules/intent-to-move.test.ts
// Spec 10 BOARD AND CONTROLS: "Turns a touch into a move (or nothing)"; spec 8.11: the game is
// playable with one finger, so a tap on a side of the head steers the snake that way too.
import fc from 'fast-check';

import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';

import type { Direction } from './snare-snake-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/**
 * Seed 1 at difficulty 0: a 7 x 8 board, the head at column 4, row 4, the neck above it (up is
 * backwards) and a critter on its left (left is blocked), so only right and down are open.
 */
const STATE = create(1, 0);
const cell = (col: number, row: number): BoardTarget => ({ regionId: 'board', col, row });
const tap = (target: BoardTarget): InputIntent => ({ kind: 'tap', target, selected: null });
const swipe = (direction: Direction): InputIntent => ({ kind: 'swipe', direction, from: null });
const steer = (direction: Direction) => ({ kind: 'steer', direction });

/** A random swipe or a random tap anywhere on (or just off) the largest board. */
const anyIntent = fc.oneof(
  fc.constantFrom<Direction>('up', 'right', 'down', 'left').map(swipe),
  fc
    .record({ col: fc.integer({ min: -1, max: 8 }), row: fc.integer({ min: -1, max: 10 }) })
    .map(({ col, row }) => tap(cell(col, row))),
);

describe('intentToMove', () => {
  it('steers the snake the way the player swipes when the head may go there', () => {
    expect(intentToMove(STATE, swipe('right'))).toStrictEqual(steer('right'));
    expect(intentToMove(STATE, swipe('down'))).toStrictEqual(steer('down'));
  });

  it('refuses a swipe back onto the neck or onto a critter', () => {
    expect(intentToMove(STATE, swipe('up'))).toBeNull();
    expect(intentToMove(STATE, swipe('left'))).toBeNull();
  });

  it('steers toward a tapped cell beside the head, the same move as the swipe that way', () => {
    expect(intentToMove(STATE, tap(cell(5, 4)))).toStrictEqual(intentToMove(STATE, swipe('right')));
    expect(intentToMove(STATE, tap(cell(4, 5)))).toStrictEqual(intentToMove(STATE, swipe('down')));
  });

  it('steers toward a far tapped cell along the side that is further away', () => {
    expect(intentToMove(STATE, tap(cell(6, 4)))).toStrictEqual(steer('right'));
    expect(intentToMove(STATE, tap(cell(6, 5)))).toStrictEqual(steer('right'));
    expect(intentToMove(STATE, tap(cell(5, 7)))).toStrictEqual(steer('down'));
  });

  it('gives nothing for a tap on the head, on a diagonal or toward a closed side', () => {
    expect(intentToMove(STATE, tap(cell(4, 4)))).toBeNull();
    expect(intentToMove(STATE, tap(cell(5, 5)))).toBeNull();
    expect(intentToMove(STATE, tap(cell(4, 0)))).toBeNull();
    expect(intentToMove(STATE, tap(cell(1, 4)))).toBeNull();
  });

  it('refuses a cell off the grid and any other region', () => {
    expect(intentToMove(STATE, tap(cell(STATE.cols, 4)))).toBeNull();
    expect(intentToMove(STATE, tap(cell(4, STATE.rows)))).toBeNull();
    expect(intentToMove(STATE, tap({ regionId: 'tray', col: 5, row: 4 }))).toBeNull();
  });

  it('gives no move once the run is won (listMoves is empty)', () => {
    const won = { ...STATE, critters: [], caught: STATE.total };
    expect(listMoves(won)).toStrictEqual([]);
    expect(intentToMove(won, swipe('right'))).toBeNull();
    expect(intentToMove(won, tap(cell(5, 4)))).toBeNull();
  });

  it('gives no move once the run is lost (out of moves)', () => {
    const lost = { ...STATE, moves: STATE.maxMoves };
    expect(intentToMove(lost, swipe('down'))).toBeNull();
  });

  it('ignores intents this game does not use', () => {
    const unused: InputIntent[] = [
      { kind: 'long-press', target: cell(5, 4) },
      { kind: 'drag-end', from: cell(4, 4), to: cell(5, 4) },
      { kind: 'aim', dx: 10, dy: -40 },
    ];
    expect(unused.map((intent) => intentToMove(STATE, intent))).toStrictEqual([null, null, null]);
  });

  it('returns only moves that listMoves lists', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 9_999 }),
        fc.integer({ min: 0, max: 99 }),
        anyIntent,
        (seed, difficulty, intent) => {
          const state = create(seed, difficulty);
          const move = intentToMove(state, intent);
          const listed = listMoves(state).map((legal) => JSON.stringify(legal));
          expect(move === null || listed.includes(JSON.stringify(move))).toBe(true);
        },
      ),
      { seed: 3, numRuns: 300 },
    );
  });

  it('turns every open way into its move by swipe and by a tap beside the head', () => {
    fc.assert(
      fc.property(fc.nat({ max: 9_999 }), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        const state = create(seed, difficulty);
        const head = state.snake[0] ?? 0;
        const col = head % state.cols;
        const row = Math.floor(head / state.cols);
        const beside = [
          cell(col, row - 1),
          cell(col + 1, row),
          cell(col, row + 1),
          cell(col - 1, row),
        ];
        const bySwipe = (['up', 'right', 'down', 'left'] as const).map((way) =>
          intentToMove(state, swipe(way)),
        );
        expect(beside.map((target) => intentToMove(state, tap(target)))).toStrictEqual(bySwipe);
        expect(bySwipe.filter((move) => move !== null)).toStrictEqual(listMoves(state));
      }),
      { seed: 5, numRuns: 200 },
    );
  });
});
