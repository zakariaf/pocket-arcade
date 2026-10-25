// apps/flock-tilt/src/rules/list-moves.test.ts
import fc from 'fast-check';

import { create } from './create.ts';
import { parseField } from './field-text.ts';
import { TUNING } from './flock-tilt-tuning.ts';
import { listMoves } from './list-moves.ts';
import { tiltField } from './tilt-field.ts';

import type { FlockTiltState } from './flock-tilt-types.ts';

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

/** Each listed tilt once, at least one, and every one of them moves an animal. */
function checkListedMoves(state: FlockTiltState): void {
  const directions = listMoves(state).map((move) => move.direction);
  expect(new Set(directions).size).toBe(directions.length);
  expect(directions.length).toBeGreaterThan(0);
  const still = directions.filter((direction) => tiltField(state, direction).slides.length === 0);
  expect(still).toStrictEqual([]);
}

describe('listMoves (spec 13: "swipe in 4 directions (or tap a side)")', () => {
  it('lists the four tilts in a fixed order when each moves something', () => {
    expect(listMoves(stateOf(['.....', '..s..', '....o']))).toStrictEqual([
      { kind: 'tilt', direction: 'up' },
      { kind: 'tilt', direction: 'right' },
      { kind: 'tilt', direction: 'down' },
      { kind: 'tilt', direction: 'left' },
    ]);
  });

  it('leaves out a tilt that moves nothing, so a wasted swipe is never a move', () => {
    expect(listMoves(stateOf(['s....', '.....', '....o']))).toStrictEqual([
      { kind: 'tilt', direction: 'right' },
      { kind: 'tilt', direction: 'down' },
    ]);
  });

  it('counts a tilt that moves only a wolf', () => {
    expect(listMoves(stateOf(['s#..o', '#....', '....w']))).toStrictEqual([
      { kind: 'tilt', direction: 'up' },
      { kind: 'tilt', direction: 'left' },
    ]);
  });

  it('lists nothing once the run is over: won, lost to the wolf, or out of tilts', () => {
    const won = stateOf(['s...o'], { sheep: [{ id: 0, cell: 4, status: 'penned' }] });
    const lost = stateOf(['s...o', 'w....'], { sheep: [{ id: 0, cell: 0, status: 'lost' }] });
    const spent = stateOf(['s...o'], { tilts: TUNING.tiltLimit });
    expect([won, lost, spent].map(listMoves)).toStrictEqual([[], [], []]);
  });

  describe('properties', () => {
    it('lists each move once, and only tilts that move an animal', () => {
      fc.assert(
        fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
          checkListedMoves(create(seed, difficulty));
        }),
        { numRuns: 40 },
      );
    });
  });
});
