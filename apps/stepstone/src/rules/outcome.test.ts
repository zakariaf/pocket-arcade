// apps/stepstone/src/rules/outcome.test.ts
// Spec 10 RULES: '"Is it over?": win, lose (with a reason), or still playing.' Stepstone is won on
// the flag and lost when no stone is in reach (undo is then the only way out).
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { pondFromText } from './pond-text.ts';

import type { StepstoneState } from './stepstone-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat(), { maxLength: 40 });

function pond(text: string, moves = 0): StepstoneState {
  return { ...pondFromText(text), moves, par: 2, kindsUsed: [] };
}

describe('outcome', () => {
  it('says won with the hops made as the score once the frog stands on the flag', () => {
    expect(outcome(pond(['R.f', 'R.R', 'RRR'].join('\n'), 4))).toStrictEqual({
      kind: 'won',
      score: 4,
    });
  });

  it('says lost, stuck, when no stone is in reach of the hop', () => {
    expect(outcome(pond(['k..', '...', '..F'].join('\n')))).toStrictEqual({
      kind: 'lost',
      reasonKey: 'stepstone.lose.stuck',
    });
  });

  it('says lost when every stone in reach has sunk', () => {
    expect(outcome(pond(['k~.', '~~.', '..F'].join('\n')))).toStrictEqual({
      kind: 'lost',
      reasonKey: 'stepstone.lose.stuck',
    });
  });

  it('says playing while a stone is in reach', () => {
    expect(outcome(pond(['kR.', '...', '..F'].join('\n')))).toStrictEqual({ kind: 'playing' });
  });

  describe('properties', () => {
    it('lists moves exactly while the run is playing, for every visited state', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          for (const state of playChoices(RULES, create(seed, difficulty), choices).states) {
            expect(listMoves(state).length > 0).toBe(outcome(state).kind === 'playing');
          }
        }),
        { numRuns: 150 },
      );
    });

    it('scores a win with a whole number of hops, never below par', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states } = playChoices(RULES, create(seed, difficulty), choices);
          const last = states[states.length - 1];
          const result = last === undefined ? null : outcome(last);
          if (result?.kind !== 'won' || last === undefined) return;
          expect(Number.isInteger(result.score)).toBe(true);
          expect(result.score).toBeGreaterThanOrEqual(last.par);
        }),
        { numRuns: 150 },
      );
    });
  });
});
