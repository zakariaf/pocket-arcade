// apps/flock-tilt/src/rules/outcome.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
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

describe('outcome (spec 10 RULES: "Is it over?: win, lose (with a reason), or still playing")', () => {
  it('reports playing while a sheep is on the field and tilts are left', () => {
    expect(outcome(create(1, 0))).toStrictEqual({ kind: 'playing' });
  });

  it('reports a win once every sheep is penned, scored by sheep and spare tilts', () => {
    const won = stateOf(['s.s.o'], {
      sheep: [
        { id: 0, cell: 4, status: 'penned' },
        { id: 1, cell: 4, status: 'penned' },
      ],
      tilts: 7,
    });
    const score = 2 * TUNING.pointsPerSheep + (TUNING.tiltLimit - 7) * TUNING.pointsPerSpareTilt;
    expect(outcome(won)).toStrictEqual({ kind: 'won', score });
    expect(score).toBe(GOLDEN_WIN_SCORE);
  });

  it('reports the wolf-got-sheep loss with its catalog key (spec S7: "The wolf got a sheep")', () => {
    const lost = stateOf(['s...o', 'w....'], { sheep: [{ id: 0, cell: 0, status: 'lost' }] });
    expect(outcome(lost)).toStrictEqual({
      kind: 'lost',
      reasonKey: 'flock-tilt.lose.wolf-got-sheep',
    });
  });

  it('reports the out-of-tilts loss with its catalog key once the budget is spent', () => {
    expect(outcome(stateOf(['s...o'], { tilts: TUNING.tiltLimit }))).toStrictEqual({
      kind: 'lost',
      reasonKey: 'flock-tilt.lose.out-of-tilts',
    });
  });

  it('keeps the score at zero or above, even after a continue raised the budget', () => {
    const won = stateOf(['s...o'], {
      sheep: [{ id: 0, cell: 4, status: 'penned' }],
      tilts: TUNING.tiltLimit + 5,
      tiltLimit: TUNING.tiltLimit + TUNING.continueTilts,
    });
    expect(outcome(won)).toStrictEqual({ kind: 'won', score: TUNING.pointsPerSheep });
  });

  it('lists no moves exactly when the run is over', () => {
    fc.assert(
      fc.property(fc.nat(), fc.array(fc.nat(), { maxLength: 40 }), (seed, choices) => {
        const { states } = playChoices({ listMoves, applyMove }, create(seed, 30), choices);
        const mismatched = states.filter(
          (state) => (listMoves(state).length === 0) !== (outcome(state).kind !== 'playing'),
        );
        expect(mismatched).toStrictEqual([]);
      }),
      { numRuns: 40 },
    );
  });
});

const GOLDEN_WIN_SCORE = 530;
