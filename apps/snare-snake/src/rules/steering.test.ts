// apps/snare-snake/src/rules/steering.test.ts
// Design notes, rule 3: the head moves one cell; never off the board, back onto the neck or onto a
// critter. Moving onto any other segment is allowed: it closes a loop.
import { create } from './create.ts';
import { openDirections, targetOf } from './steering.ts';

import type { SnareSnakeState } from './snare-snake-types.ts';

const at = (col: number, row: number): number => row * 7 + col;

function placed(snake: readonly number[], critters: readonly number[]): SnareSnakeState {
  return { ...create(1, 0), snake, critters: critters.map((cell, id) => ({ id, cell })) };
}

describe('targetOf', () => {
  it('returns the cell the head enters, or null off the board, on the neck or on a critter', () => {
    const state = placed([at(0, 3), at(1, 3), at(1, 4), at(0, 4)], [at(0, 2)]);
    expect(targetOf(state, 'up')).toBeNull();
    expect(targetOf(state, 'right')).toBeNull();
    expect(targetOf(state, 'left')).toBeNull();
    expect(targetOf(state, 'down')).toBe(at(0, 4));
  });

  it('lets a one-segment snake go back the way it came (it has no neck)', () => {
    expect(targetOf(placed([at(3, 3)], [at(6, 7)]), 'left')).toBe(at(2, 3));
  });
});

describe('openDirections', () => {
  it('lists the open directions in the order up, right, down, left', () => {
    expect(openDirections(placed([at(3, 3), at(3, 4)], [at(4, 3)]))).toStrictEqual(['up', 'left']);
  });
});
