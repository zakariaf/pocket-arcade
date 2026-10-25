// apps/snare-snake/src/testing/snare-snake-bot.test.ts
// Spec 8.13: bots play the game thousands of times before anyone does; these are their hooks.
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { applyMove } from '@e07/snare-snake/rules/apply-move.ts';
import { create } from '@e07/snare-snake/rules/create.ts';
import { listMoves } from '@e07/snare-snake/rules/list-moves.ts';

import {
  evaluateSnareSnake,
  scoreOfSnareSnake,
  snareSnakeBot,
  tagSnareSnakeEvent,
} from './snare-snake-bot.ts';

import type { SnareSnakeState } from '@e07/snare-snake/rules/snare-snake-types.ts';

const at = (col: number, row: number): number => row * 7 + col;
const CAUGHT = {
  kind: 'critters-caught',
  critterIds: [0],
  cells: [9],
  count: 1,
  points: 10,
} as const;

/** The ring around (2, 2) one bite from closing, with the snake's tail into the corner. */
const COILED = [
  at(1, 2),
  at(1, 3),
  at(2, 3),
  at(3, 3),
  at(3, 2),
  at(3, 1),
  at(2, 1),
  at(1, 1),
  at(0, 1),
  at(0, 0),
];

function placed(snake: readonly number[], critters: readonly number[]): SnareSnakeState {
  return { ...create(1, 0), snake, critters: critters.map((cell, id) => ({ id, cell })) };
}

describe('tagSnareSnakeEvent', () => {
  it('tags a catch as the payoff, and a loop catching more than one critter as the twist too', () => {
    expect(tagSnareSnakeEvent(CAUGHT)).toStrictEqual(['payoff']);
    expect(
      tagSnareSnakeEvent({ ...CAUGHT, critterIds: [0, 1], cells: [9, 10], count: 2, points: 40 }),
    ).toStrictEqual(['payoff', 'twist']);
    expect(
      tagSnareSnakeEvent({ kind: 'loop-closed', loop: [1, 2], enclosed: [], spent: 3, length: 4 }),
    ).toStrictEqual([]);
  });
});

describe('scoreOfSnareSnake', () => {
  it('reports the points the top bar shows', () => {
    expect(scoreOfSnareSnake({ ...create(1, 0), score: 135 })).toBe(135);
  });
});

describe('evaluateSnareSnake', () => {
  it('prefers more critters caught', () => {
    const start = create(1, 0);
    expect(evaluateSnareSnake({ ...start, caught: 1 })).toBeGreaterThan(evaluateSnareSnake(start));
  });

  it('prefers a loop that encloses a critter over the same snake with the critter elsewhere', () => {
    expect(evaluateSnareSnake(placed(COILED, [at(2, 2), at(6, 7)]))).toBeGreaterThan(
      evaluateSnareSnake(placed(COILED, [at(5, 6), at(6, 7)])),
    );
  });

  it('prefers room ahead of the head over a cramped corner', () => {
    const open = placed([at(3, 4), at(3, 5), at(3, 6)], [at(6, 0)]);
    const cramped = placed([at(0, 1), at(1, 1), at(1, 0)], [at(6, 0), at(0, 2)]);
    expect(evaluateSnareSnake(open)).toBeGreaterThan(evaluateSnareSnake(cramped));
  });

  it('keeps the pinned value of the seed 1 opening', () => {
    expect(evaluateSnareSnake(create(1, 0))).toBe(GOLDEN_SEED_1_VALUE);
  });
});

describe('snareSnakeBot', () => {
  it('closes the loop around the critter when one bite catches it', () => {
    const state = placed(COILED, [at(2, 2), at(6, 7)]);
    const choice = snareSnakeBot(state, listMoves(state), seedRng(1));
    expect(choice.move).toStrictEqual({ kind: 'steer', direction: 'up' });
  });

  it('picks only listed moves (property)', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        let state = create(seed, difficulty);
        let rng = seedRng(seed);
        for (let turn = 0; turn < 8 && listMoves(state).length > 0; turn += 1) {
          const moves = listMoves(state);
          const choice = snareSnakeBot(state, moves, rng);
          expect(moves).toContainEqual(choice.move);
          rng = choice.rng;
          state = applyMove(state, choice.move).state;
        }
      }),
    );
  });
});

const GOLDEN_SEED_1_VALUE = 852;
