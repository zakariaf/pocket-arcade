// apps/snare-snake/src/rules/snare-snake-evaluate.test.ts
// How a reasonable player values a Snare Snake position (spec 8.13: the bots and the level witness
// play with it).
import { create } from './create.ts';
import { bestSnare, evaluateSnareSnake } from './snare-snake-evaluate.ts';

import type { SnareSnakeState } from './snare-snake-types.ts';

const at = (col: number, row: number): number => row * 7 + col;

function placed(snake: readonly number[], critters: readonly number[]): SnareSnakeState {
  return { ...create(1, 0), snake, critters: critters.map((cell, id) => ({ id, cell })) };
}

/** The ring around (2, 2) one bite from closing. */
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

describe('bestSnare', () => {
  it('values a loop that catches now above the same catch further away', () => {
    const now = bestSnare(placed(COILED, [at(2, 2), at(6, 7)]), 3);
    expect(now).toBe(4);
    expect(bestSnare(placed(COILED, [at(2, 2), at(6, 7)]), 1)).toBe(2);
  });

  it('finds no snare when no loop near the head catches anything', () => {
    expect(bestSnare(placed([at(3, 4), at(3, 5), at(3, 6)], [at(6, 0)]), 3)).toBe(0);
  });

  it('finds the opening coil of seed 1 three moves ahead', () => {
    expect(bestSnare(create(1, 0), 3)).toBe(GOLDEN_SEED_1_SNARE);
  });
});

describe('evaluateSnareSnake', () => {
  it('values a caught critter above anything else', () => {
    const start = create(1, 0);
    expect(evaluateSnareSnake({ ...start, caught: 1 })).toBeGreaterThan(
      evaluateSnareSnake(start) + 500,
    );
  });

  it('values room ahead of the head over a cramped corner', () => {
    const open = placed([at(3, 4), at(3, 5), at(3, 6)], [at(6, 0)]);
    const cramped = placed([at(0, 1), at(1, 1), at(1, 0)], [at(6, 0), at(0, 2)]);
    expect(evaluateSnareSnake(open)).toBeGreaterThan(evaluateSnareSnake(cramped));
  });

  it('keeps the pinned value of the seed 1 opening', () => {
    expect(evaluateSnareSnake(create(1, 0))).toBe(GOLDEN_SEED_1_VALUE);
  });
});

const GOLDEN_SEED_1_SNARE = 6;
const GOLDEN_SEED_1_VALUE = 852;
