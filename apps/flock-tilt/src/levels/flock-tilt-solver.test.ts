// apps/flock-tilt/src/levels/flock-tilt-solver.test.ts
import fc from 'fast-check';

import { applyMove } from '@e07/flock-tilt/rules/apply-move.ts';
import { create } from '@e07/flock-tilt/rules/create.ts';
import { parseField } from '@e07/flock-tilt/rules/field-text.ts';
import { TUNING, knobsFor } from '@e07/flock-tilt/rules/flock-tilt-tuning.ts';
import { listMoves } from '@e07/flock-tilt/rules/list-moves.ts';
import { outcome } from '@e07/flock-tilt/rules/outcome.ts';
import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';

import { FLOCK_TILT_SOLVER, suggestTilt } from './flock-tilt-solver.ts';

import type { FlockTiltState } from '@e07/flock-tilt/rules/flock-tilt-types.ts';

const ENGINE = { listMoves, applyMove, outcome };

function stateOf(
  lines: readonly string[],
  overrides: Partial<FlockTiltState> = {},
): FlockTiltState {
  return {
    ...parseField(lines),
    tilts: 0,
    tiltLimit: TUNING.tiltLimit,
    par: 2,
    hasContinued: false,
    beforeLoss: null,
    ...overrides,
  };
}

describe('FLOCK_TILT_SOLVER (spec 8.1: "the solver also calculates par")', () => {
  it('finds the two tilts that pen a sheep in the far corner (par 2)', () => {
    const result = FLOCK_TILT_SOLVER.solve(stateOf(['s....', '....o', 'w....']), 1000);
    expect(result.kind).toBe('solved');
    expect(result.kind === 'solved' ? result.par : -1).toBe(2);
  });

  it('pens a lined-up flock with one tilt', () => {
    expect(FLOCK_TILT_SOLVER.solve(stateOf(['o.sss', '.....', '....w']), 1000)).toStrictEqual({
      kind: 'solved',
      par: 1,
      line: [{ kind: 'tilt', direction: 'left' }],
      final: applyMove(stateOf(['o.sss', '.....', '....w']), { kind: 'tilt', direction: 'left' })
        .state,
    });
  });

  it('reports a field no tilt can win as unsolvable, and stops at the node budget', () => {
    expect(FLOCK_TILT_SOLVER.solve(stateOf(['s#...', '#...o', '....w']), 1000)).toStrictEqual({
      kind: 'unsolvable',
    });
    expect(FLOCK_TILT_SOLVER.solve(create(3, 80), 1)).toStrictEqual({ kind: 'budget-exceeded' });
  });

  it('solves every generated field at the par create recorded, with a line the engine accepts', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        const start = create(seed, difficulty);
        const result = FLOCK_TILT_SOLVER.solve(start, 60_000);
        const line = result.kind === 'solved' ? result.line : [];
        expect(result.kind === 'solved' ? result.par : -1).toBe(start.par);
        expect(start.par).toBeLessThanOrEqual(knobsFor(difficulty).maxPar);
        expect(verifyLine(ENGINE, start, line)).toStrictEqual({ kind: 'wins', moves: start.par });
      }),
      { seed: 19, numRuns: 40 },
    );
  });
});

describe('suggestTilt (spec 8.5: "The game\'s solver suggests the next good move")', () => {
  it('suggests the first tilt of a shortest winning line', () => {
    expect(suggestTilt(stateOf(['.....', 's...o', 'w....']))).toStrictEqual({
      kind: 'tilt',
      direction: 'right',
    });
  });

  it('keeps the field winnable from every state on the solver line', () => {
    const start = create(5, 40);
    let state = start;
    for (let step = 0; step < start.par; step += 1) {
      const hint = suggestTilt(state);
      expect(hint).not.toBeNull();
      expect(listMoves(state)).toContainEqual(hint);
      state = applyMove(state, hint ?? { kind: 'tilt', direction: 'up' }).state;
    }
    expect(outcome(state).kind).toBe('won');
  });

  it('gives a fresh first move from a state off the solver line', () => {
    const start = create(6, 10);
    const offLine = listMoves(start)
      .map((move) => applyMove(start, move).state)
      .find((state) => outcome(state).kind === 'playing' && suggestTilt(state) !== null);
    const hint = offLine === undefined ? null : suggestTilt(offLine);
    const solved = offLine === undefined ? null : FLOCK_TILT_SOLVER.solve(offLine, 60_000);
    expect(hint).toStrictEqual(solved?.kind === 'solved' ? solved.line[0] : undefined);
  });

  it('gives no hint once the run is won or lost, or when the field can no longer be won', () => {
    const won = stateOf(['s...o'], { sheep: [{ id: 0, cell: 4, status: 'penned' }] });
    const lost = stateOf(['s...o', 'w....'], { sheep: [{ id: 0, cell: 0, status: 'lost' }] });
    const stuck = stateOf(['s#...', '#...o', '....w']);
    expect([won, lost, stuck].map(suggestTilt)).toStrictEqual([null, null, null]);
  });
});
