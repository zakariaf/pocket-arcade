// apps/toggle-drop/src/rules/outcome.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { OUT_OF_BALLS, outcome } from './outcome.ts';

import type { ToggleDropState } from './toggle-drop-types.ts';

const RULES = { listMoves, applyMove };

/** Two cups (under columns 0 and 1), one ball each, three balls to drop. */
function board(overrides: Partial<ToggleDropState> = {}): ToggleDropState {
  return {
    cols: 3,
    rows: 2,
    pegs: [-1, 1, -1, 0, -1, 0],
    flips: [0, 0, 0, 0, 0, 0],
    needs: [1, 1, 0],
    filled: [0, 0, 0],
    ballsLeft: 3,
    drops: 0,
    ...overrides,
  };
}

describe('outcome', () => {
  // Design notes: won when every cup is full, lost (out of balls) when the balls are spent first.
  it('says playing while a cup needs a ball and balls are left', () => {
    expect(outcome(board({ filled: [1, 0, 0] }))).toStrictEqual({ kind: 'playing' });
  });

  it('says won when every cup is full, scoring the balls left over', () => {
    expect(outcome(board({ filled: [1, 1, 0], ballsLeft: 2 }))).toStrictEqual({
      kind: 'won',
      score: 2,
    });
  });

  it('says won when the last ball fills the last cup', () => {
    expect(outcome(board({ filled: [1, 1, 0], ballsLeft: 0 }))).toStrictEqual({
      kind: 'won',
      score: 0,
    });
  });

  it('says lost, out of balls, when the balls are spent and a cup still needs one', () => {
    expect(outcome(board({ filled: [1, 0, 0], ballsLeft: 0 }))).toStrictEqual({
      kind: 'lost',
      reasonKey: 'toggle-drop.lose.out-of-balls',
    });
    expect(OUT_OF_BALLS).toBe('toggle-drop.lose.out-of-balls');
  });

  it('lists moves exactly while the outcome is playing (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 99 }),
        fc.array(fc.nat(), { maxLength: 12 }),
        (seed, difficulty, choices) => {
          const { states } = playChoices(RULES, create(seed, difficulty), choices);
          for (const state of states) {
            expect(listMoves(state).length > 0).toBe(outcome(state).kind === 'playing');
          }
        },
      ),
    );
  });
});
