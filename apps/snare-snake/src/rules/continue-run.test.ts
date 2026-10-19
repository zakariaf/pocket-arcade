// apps/snare-snake/src/rules/continue-run.test.ts
// Spec 8.10: "Games may allow one continue per level or run". Snare Snake's (design notes,
// Continue): the snake is untangled one step back and gets three more moves.
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { TUNING } from './snare-snake-tuning.ts';

import type { SnareSnakeState } from './snare-snake-types.ts';

const at = (col: number, row: number): number => row * 7 + col;

/** Head in the top-end corner, a critter below it: no allowed move. */
const TANGLED: SnareSnakeState = {
  ...create(1, 0),
  snake: [at(6, 0), at(5, 0), at(4, 0)],
  critters: [{ id: 0, cell: at(6, 1) }],
  moves: 12,
};

/** The outcome after a continue from the last state of a seeded line, or null when it is not lost. */
function afterContinue(
  seed: number,
  difficulty: number,
  choices: readonly number[],
): string | null {
  const { states } = playChoices({ listMoves, applyMove }, create(seed, difficulty), choices);
  const last = states.at(-1) ?? create(seed, difficulty);
  return outcome(last).kind === 'lost' ? outcome(continueAfterLoss(last).state).kind : null;
}

describe('continueAfterLoss (spec 8.10: one continue per run)', () => {
  it('gives an out-of-moves run three more moves', () => {
    const result = continueAfterLoss({ ...create(1, 0), moves: 30 });
    expect(result.events).toStrictEqual([{ kind: 'moves-added', count: TUNING.continueMoves }]);
    expect(result.state.maxMoves).toBe(30 + TUNING.continueMoves);
    expect(outcome(result.state).kind).toBe('playing');
  });

  it('steps a tangled snake back one cell and gives it three more moves', () => {
    const result = continueAfterLoss(TANGLED);
    expect(result.events).toStrictEqual(GOLDEN_TANGLED_EVENTS);
    expect(result.state.snake).toStrictEqual([at(5, 0), at(4, 0)]);
    expect(result.state.maxMoves).toBe(30 + TUNING.continueMoves);
    expect(outcome(result.state).kind).toBe('playing');
  });

  it('refuses a second continue in the same run', () => {
    const once = continueAfterLoss({ ...create(1, 0), moves: 30 }).state;
    expect(() => continueAfterLoss({ ...once, moves: once.maxMoves })).toThrow(RangeError);
  });

  it('refuses a run that is still playing or won', () => {
    expect(() => continueAfterLoss(create(1, 0))).toThrow(RangeError);
    expect(() => continueAfterLoss({ ...create(1, 0), critters: [] })).toThrow(RangeError);
  });

  it('makes every way of losing reached in play playable again (property)', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 0, max: 99 }),
        fc.array(fc.nat(), { maxLength: 60 }),
        (seed, difficulty, choices) => {
          expect(afterContinue(seed, difficulty, choices)).not.toBe('lost');
        },
      ),
    );
  });
});

const GOLDEN_TANGLED_EVENTS = [
  { kind: 'snake-stepped-back', from: 6, to: 5, length: 2 },
  { kind: 'moves-added', count: 3 },
];
