// apps/flock-tilt/src/rules/continue-run.test.ts
import fc from 'fast-check';

import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { parseField } from './field-text.ts';
import { TUNING } from './flock-tilt-tuning.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { FlockTiltState } from './flock-tilt-types.ts';

function stateOf(
  lines: readonly string[],
  overrides: Partial<FlockTiltState> = {},
): FlockTiltState {
  return {
    ...parseField(lines),
    tilts: 0,
    tiltLimit: TUNING.tiltLimit,
    par: 3,
    hasContinued: false,
    beforeLoss: null,
    ...overrides,
  };
}

/** A cap far above the tilt budget, so a broken rule can never hang the test. */
const MAX_TILTS = 400;

/** Seeded random tilts until the run ends (the tilt budget makes every run end). */
function playToEnd(seed: number, difficulty: number): FlockTiltState {
  let state = create(seed, difficulty);
  let rng = seedRng(seed);
  for (let tilt = 0; tilt < MAX_TILTS && outcome(state).kind === 'playing'; tilt += 1) {
    const moves = listMoves(state);
    const pick = nextInt(rng, moves.length);
    rng = pick.state;
    const move = moves[pick.value];
    if (move === undefined) throw new Error('a playing state lists no move');
    state = applyMove(state, move).state;
  }
  return state;
}

describe('continueAfterLoss (spec 8.10: "the last move is undone")', () => {
  it('takes back the tilt that lost the sheep: the sheep is back on the field', () => {
    const start = stateOf(['s...w', '....o']);
    const lost = applyMove(start, { kind: 'tilt', direction: 'right' }).state;
    const { state, events } = continueAfterLoss(lost);
    expect(state.sheep).toStrictEqual(start.sheep);
    expect(state.wolves).toStrictEqual(start.wolves);
    expect(state.tilts).toBe(0);
    expect(state.hasContinued).toBe(true);
    expect(state.beforeLoss).toBeNull();
    expect(events).toStrictEqual([{ kind: 'tilt-taken-back', tiltsAdded: TUNING.continueTilts }]);
    expect(outcome(state)).toStrictEqual({ kind: 'playing' });
  });

  it('gives a run that ran out of tilts its last tilt back and more tilts', () => {
    const start = stateOf(['s....', '....o'], { tilts: TUNING.tiltLimit - 1 });
    const lost = applyMove(start, { kind: 'tilt', direction: 'right' }).state;
    const { state } = continueAfterLoss(lost);
    expect(state.tilts).toBe(TUNING.tiltLimit - 1);
    expect(state.tiltLimit).toBe(TUNING.tiltLimit + TUNING.continueTilts);
    expect(outcome(state)).toStrictEqual({ kind: 'playing' });
  });

  it('refuses a second continue in the same run', () => {
    const start = stateOf(['s...w', '....o']);
    const lost = applyMove(start, { kind: 'tilt', direction: 'right' }).state;
    const again = applyMove(continueAfterLoss(lost).state, { kind: 'tilt', direction: 'right' });
    expect(outcome(again.state).kind).toBe('lost');
    expect(() => continueAfterLoss(again.state)).toThrow(RangeError);
  });

  it('refuses a run that is not lost', () => {
    expect(() => continueAfterLoss(create(1, 0))).toThrow(RangeError);
  });

  describe('properties', () => {
    it('turns every lost run, either way of losing, into a playing run', () => {
      fc.assert(
        fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
          const end = playToEnd(seed, difficulty);
          fc.pre(outcome(end).kind === 'lost');
          expect(outcome(continueAfterLoss(end).state)).toStrictEqual({ kind: 'playing' });
        }),
        { numRuns: 25 },
      );
    });
  });
});
