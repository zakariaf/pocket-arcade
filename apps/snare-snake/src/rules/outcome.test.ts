// apps/snare-snake/src/rules/outcome.test.ts
// Spec 10 RULES: "Is it over?: win, lose (with a reason), or still playing." S7 shows a short,
// friendly reason: snare-snake.lose.tangled or snare-snake.lose.out-of-moves.
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { LOSE_OUT_OF_MOVES, LOSE_TANGLED, outcome } from './outcome.ts';

import type { SnareSnakeState } from './snare-snake-types.ts';

const at = (col: number, row: number): number => row * 7 + col;

/** True when no state of the line lists a move while playing, or lists one once it is over. */
function listsExactlyWhilePlaying(states: readonly SnareSnakeState[]): boolean {
  return states.every(
    (state) => (listMoves(state).length === 0) === (outcome(state).kind !== 'playing'),
  );
}

describe('outcome', () => {
  it('reports playing while critters and moves remain', () => {
    expect(outcome(create(1, 0))).toStrictEqual({ kind: 'playing' });
  });

  it('reports a win with the score once every critter is caught', () => {
    const won = { ...create(1, 0), critters: [], caught: 4, score: 135 };
    expect(outcome(won)).toStrictEqual({ kind: 'won', score: 135 });
  });

  it('reports the out-of-moves loss when the moves run out', () => {
    const spent = { ...create(1, 0), moves: 30 };
    expect(outcome(spent)).toStrictEqual({ kind: 'lost', reasonKey: LOSE_OUT_OF_MOVES });
    expect(LOSE_OUT_OF_MOVES).toBe('snare-snake.lose.out-of-moves');
  });

  it('reports the tangled loss when the head has no allowed move', () => {
    const tangled = {
      ...create(1, 0),
      snake: [at(6, 0), at(5, 0)],
      critters: [{ id: 0, cell: at(6, 1) }],
    };
    expect(outcome(tangled)).toStrictEqual({ kind: 'lost', reasonKey: LOSE_TANGLED });
    expect(LOSE_TANGLED).toBe('snare-snake.lose.tangled');
  });

  it('lets a win beat a loss: the last critter caught on the last move still wins', () => {
    const lastMove = { ...create(1, 0), critters: [], moves: 30, score: 40 };
    expect(outcome(lastMove)).toStrictEqual({ kind: 'won', score: 40 });
  });

  it('lists no moves exactly when the game is over (property)', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 0, max: 99 }),
        fc.array(fc.nat(), { maxLength: 60 }),
        (seed, difficulty, choices) => {
          const { states } = playChoices(
            { listMoves, applyMove },
            create(seed, difficulty),
            choices,
          );
          expect(listsExactlyWhilePlaying(states)).toBe(true);
        },
      ),
    );
  });

  it('keeps the pinned end of the seed 1 run played by the first listed move', () => {
    const choices = Array.from({ length: 60 }, () => 0);
    const { states } = playChoices({ listMoves, applyMove }, create(1, 0), choices);
    expect(outcome(states.at(-1) ?? create(1, 0))).toStrictEqual(GOLDEN_SEED_1_FIRST_MOVE_END);
  });
});

const GOLDEN_SEED_1_FIRST_MOVE_END = { kind: 'lost', reasonKey: 'snare-snake.lose.out-of-moves' };
