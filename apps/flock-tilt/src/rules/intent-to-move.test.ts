// apps/flock-tilt/src/rules/intent-to-move.test.ts
import fc from 'fast-check';

import { create } from './create.ts';
import { parseField } from './field-text.ts';
import { TUNING } from './flock-tilt-tuning.ts';
import { intentToMove, TILT_KEY_IDS } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { DIRECTIONS } from './tilt-field.ts';

import type { Direction, FlockTiltMove, FlockTiltState } from './flock-tilt-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** A playing state from a text map. */
function stateOf(
  lines: readonly string[],
  overrides: Partial<FlockTiltState> = {},
): FlockTiltState {
  return {
    ...parseField(lines),
    tilts: 0,
    tiltLimit: TUNING.tiltLimit,
    par: 1,
    hasContinued: false,
    beforeLoss: null,
    ...overrides,
  };
}

/** A sheep in the middle: every tilt moves it. */
const OPEN = stateOf(['.....', '..s..', '....o']);
/** A sheep in the top-left corner: only right and down move anything. */
const CORNER = stateOf(['s....', '.....', '....o']);

const swipe = (direction: Direction): InputIntent => ({ kind: 'swipe', direction, from: null });
const tap = (target: BoardTarget): InputIntent => ({ kind: 'tap', target, selected: null });
const key = (direction: Direction): BoardTarget => ({
  regionId: TILT_KEY_IDS[direction],
  col: 0,
  row: 0,
});
const tilt = (direction: Direction): FlockTiltMove => ({ kind: 'tilt', direction });

/** Every intent a player can make on this board: four swipes, four keys, a tap on a field cell. */
const INTENT = fc.oneof(
  fc.constantFrom(...DIRECTIONS).map(swipe),
  fc.constantFrom(...DIRECTIONS).map((direction) => tap(key(direction))),
  fc
    .record({ col: fc.integer({ min: -1, max: 7 }), row: fc.integer({ min: -1, max: 7 }) })
    .map(({ col, row }) => tap({ regionId: 'field', col, row })),
);

/** The move an intent gives is null or one listMoves lists. */
function isListedOrNull(state: FlockTiltState, intent: InputIntent): boolean {
  const move = intentToMove(state, intent);
  const listed = listMoves(state).map((legal) => JSON.stringify(legal));
  return move === null || listed.includes(JSON.stringify(move));
}

/** Every listed tilt is reached by its swipe and by its key (exhaustive). */
function isEveryMoveReachable(state: FlockTiltState): boolean {
  return listMoves(state).every(
    (move) =>
      JSON.stringify(intentToMove(state, swipe(move.direction))) === JSON.stringify(move) &&
      JSON.stringify(intentToMove(state, tap(key(move.direction)))) === JSON.stringify(move),
  );
}

describe('intentToMove (spec 13: "swipe in 4 directions (or tap a side)")', () => {
  it('tilts the field the way of each swipe that moves something', () => {
    expect(DIRECTIONS.map((direction) => intentToMove(OPEN, swipe(direction)))).toStrictEqual(
      DIRECTIONS.map(tilt),
    );
  });

  it('refuses a swipe that would move nothing, so no tilt is wasted', () => {
    expect(intentToMove(CORNER, swipe('up'))).toBeNull();
    expect(intentToMove(CORNER, swipe('left'))).toBeNull();
    expect(intentToMove(CORNER, swipe('down'))).toStrictEqual(tilt('down'));
  });

  it('tilts towards the side whose tilt key is tapped', () => {
    expect(DIRECTIONS.map((direction) => intentToMove(OPEN, tap(key(direction))))).toStrictEqual(
      DIRECTIONS.map(tilt),
    );
  });

  it('refuses a tilt key whose tilt would move nothing', () => {
    expect(intentToMove(CORNER, tap(key('up')))).toBeNull();
    expect(intentToMove(CORNER, tap(key('right')))).toStrictEqual(tilt('right'));
  });

  it('does nothing for a tap on the field itself', () => {
    expect(intentToMove(OPEN, tap({ regionId: 'field', col: 2, row: 1 }))).toBeNull();
  });

  it('gives no move once the run is won, lost to the wolf, or out of tilts', () => {
    const won = stateOf(['s...o'], { sheep: [{ id: 0, cell: 4, status: 'penned' }] });
    const lost = stateOf(['s...o', 'w....'], { sheep: [{ id: 0, cell: 0, status: 'lost' }] });
    const spent = stateOf(['s...o'], { tilts: TUNING.tiltLimit });
    const moves = [won, lost, spent].flatMap((state) =>
      DIRECTIONS.flatMap((direction) => [
        intentToMove(state, swipe(direction)),
        intentToMove(state, tap(key(direction))),
      ]),
    );
    expect(moves.filter((move) => move !== null)).toStrictEqual([]);
  });

  it('ignores intents this game does not use', () => {
    const field = { regionId: 'field', col: 2, row: 1 };
    const unused: InputIntent[] = [
      { kind: 'long-press', target: key('down') },
      { kind: 'drag-end', from: field, to: key('left') },
      { kind: 'aim', dx: 10, dy: -40 },
    ];
    expect(unused.map((intent) => intentToMove(OPEN, intent))).toStrictEqual([null, null, null]);
  });

  describe('properties', () => {
    it('returns only moves that listMoves lists', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 9_999 }),
          fc.integer({ min: 0, max: 99 }),
          INTENT,
          (seed, difficulty, intent) => {
            expect(isListedOrNull(create(seed, difficulty), intent)).toBe(true);
          },
        ),
        { seed: 3, numRuns: 60 },
      );
    });

    it('reaches every listed tilt by its swipe and by its key', () => {
      fc.assert(
        fc.property(fc.nat({ max: 9_999 }), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
          expect(isEveryMoveReachable(create(seed, difficulty))).toBe(true);
        }),
        { seed: 5, numRuns: 40 },
      );
    });
  });
});
