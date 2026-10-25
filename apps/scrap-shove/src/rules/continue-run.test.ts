// apps/scrap-shove/src/rules/continue-run.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { stateFromText } from './board-text.ts';
import { continueRun } from './continue-run.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { ScrapShoveState } from './scrap-shove-types.ts';

const RULES = { listMoves, applyMove };

/** The floor before the catch: waiting lets the robot next to the player catch them. */
const BEFORE = stateFromText(['n...', '.n..', '..@.', '....']);
const LOST = applyMove(BEFORE, { kind: 'wait' }).state;

function firstLoss(seed: number, choices: readonly number[]): ScrapShoveState | null {
  const { states } = playChoices(RULES, create(seed, 75), choices);
  return states.find((state) => outcome(state).kind === 'lost') ?? null;
}

describe('continueRun (spec 8.10: one continue, the last move is undone)', () => {
  it('puts the floor back as it was before the move that got the player caught', () => {
    const { state, events } = continueRun(LOST);
    expect(outcome(state).kind).toBe('playing');
    expect(state).toStrictEqual({ ...BEFORE, hasContinued: true });
    expect(events).toStrictEqual([{ kind: 'step-reverted' }]);
  });

  it('refuses a second continue in the same run', () => {
    const again = applyMove(continueRun(LOST).state, { kind: 'wait' }).state;
    expect(outcome(again).kind).toBe('lost');
    expect(() => continueRun(again)).toThrow(RangeError);
  });

  it('refuses a run that is not lost', () => {
    expect(() => continueRun(BEFORE)).toThrow(RangeError);
  });

  it('turns every loss of a played run back into a playing state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.array(fc.nat(), { maxLength: 30 }),
        (seed, choices) => {
          const lost = firstLoss(seed, choices);
          fc.pre(lost !== null);
          const { state } = continueRun(lost);
          expect(outcome(state).kind).toBe('playing');
          expect(state.rescue).toBeNull();
        },
      ),
    );
  });
});
