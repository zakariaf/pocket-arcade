// apps/scrap-shove/src/rules/floor-squares.test.ts
import fc from 'fast-check';

import {
  beyond,
  distanceBetween,
  heapAt,
  isOnFloor,
  isSameCell,
  isTaken,
  neighboursOf,
  robotAt,
  signOf,
  stepToward,
} from './floor-squares.ts';

import type { Floor } from './scrap-shove-types.ts';

const cellArb = fc.record({
  col: fc.integer({ min: 0, max: 7 }),
  row: fc.integer({ min: 0, max: 7 }),
});

const FLOOR: Floor = {
  player: { col: 3, row: 3 },
  robots: [{ id: 1, kind: 'normal', col: 0, row: 0 }],
  heaps: [{ id: 2, col: 5, row: 4, isShoved: false }],
  nextId: 3,
};

describe('signOf', () => {
  it('gives the direction of a whole number', () => {
    expect([-7, -1, 0, 1, 9].map(signOf)).toStrictEqual([-1, -1, 0, 1, 1]);
  });
});

describe('stepToward', () => {
  it('takes one king step, diagonal when both lines differ (spec 13: one step at a time)', () => {
    expect(stepToward({ col: 0, row: 0 }, { col: 3, row: 3 })).toStrictEqual({ col: 1, row: 1 });
    expect(stepToward({ col: 6, row: 2 }, { col: 3, row: 2 })).toStrictEqual({ col: 5, row: 2 });
    expect(stepToward({ col: 3, row: 7 }, { col: 4, row: 3 })).toStrictEqual({ col: 4, row: 6 });
  });

  it('closes the distance by exactly one square from any other square', () => {
    fc.assert(
      fc.property(cellArb, cellArb, (from, to) => {
        fc.pre(!isSameCell(from, to));
        expect(distanceBetween(stepToward(from, to), to)).toBe(distanceBetween(from, to) - 1);
      }),
    );
  });
});

describe('beyond', () => {
  it('continues a step one square further', () => {
    expect(beyond({ col: 3, row: 3 }, { col: 4, row: 2 })).toStrictEqual({ col: 5, row: 1 });
  });
});

describe('isOnFloor', () => {
  it('accepts only squares of the side x side floor', () => {
    const squares = [
      { col: 0, row: 0 },
      { col: 7, row: 7 },
      { col: -1, row: 3 },
      { col: 3, row: 8 },
    ];
    expect(squares.map((cell) => isOnFloor(cell, 8))).toStrictEqual([true, true, false, false]);
  });
});

describe('pieces on squares', () => {
  it('finds the robot and the heap on a square, or null', () => {
    expect(robotAt(FLOOR, { col: 0, row: 0 })?.id).toBe(1);
    expect(robotAt(FLOOR, { col: 1, row: 0 })).toBeNull();
    expect(heapAt(FLOOR, { col: 5, row: 4 })?.id).toBe(2);
    expect(heapAt(FLOOR, { col: 3, row: 3 })).toBeNull();
  });

  it('counts the player, robots and heaps as taking a square', () => {
    const squares = [
      { col: 3, row: 3 },
      { col: 0, row: 0 },
      { col: 5, row: 4 },
      { col: 2, row: 2 },
    ];
    expect(squares.map((cell) => isTaken(FLOOR, cell))).toStrictEqual([true, true, true, false]);
  });
});

describe('neighboursOf', () => {
  it('lists the eight neighbours in reading order', () => {
    expect(neighboursOf({ col: 3, row: 3 }, 8)).toStrictEqual([
      { col: 2, row: 2 },
      { col: 3, row: 2 },
      { col: 4, row: 2 },
      { col: 2, row: 3 },
      { col: 4, row: 3 },
      { col: 2, row: 4 },
      { col: 3, row: 4 },
      { col: 4, row: 4 },
    ]);
  });

  it('leaves out squares off the floor in a corner', () => {
    expect(neighboursOf({ col: 0, row: 7 }, 8)).toStrictEqual([
      { col: 0, row: 6 },
      { col: 1, row: 6 },
      { col: 1, row: 7 },
    ]);
  });
});
