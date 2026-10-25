// apps/scrap-shove/src/rules/opening.test.ts
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { boardText, stateFromText } from './board-text.ts';
import { distanceBetween, isSameCell, stepToward } from './floor-squares.ts';
import { drawFrom, freeSquares, placeCrashPair, placeHeaps, placeRobots } from './opening.ts';

import type { Layout } from './opening.ts';

function layoutOf(lines: readonly string[], seed = 1): Layout {
  const { player, robots, heaps, nextId } = stateFromText(lines);
  return { floor: { player, robots, heaps, nextId }, rng: seedRng(seed) };
}

const EMPTY = [
  '........',
  '........',
  '........',
  '...@....',
  '........',
  '........',
  '........',
  '........',
];

describe('drawFrom', () => {
  it('picks a seeded item and advances the stream', () => {
    const layout = layoutOf(EMPTY);
    const pick = drawFrom(layout, ['a', 'b', 'c']);
    expect(['a', 'b', 'c']).toContain(pick.item);
    expect(pick.rng).not.toStrictEqual(layout.rng);
  });

  it('refuses an empty list (the tuning never asks for one)', () => {
    expect(() => drawFrom(layoutOf(EMPTY), [])).toThrow(RangeError);
  });
});

describe('freeSquares', () => {
  it('lists the free squares at a distance from the player within the bounds', () => {
    const squares = freeSquares(layoutOf(EMPTY).floor, 1, 1);
    expect(squares).toHaveLength(8);
    expect(freeSquares(layoutOf(['n.......', ...EMPTY.slice(1)]).floor, 3, 3)).not.toContainEqual({
      col: 0,
      row: 0,
    });
  });
});

describe('placeCrashPair', () => {
  it('places two normal robots that step onto one square on the first robots turn', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000 }), (seed) => {
        const { floor } = placeCrashPair(layoutOf(EMPTY, seed));
        const [first, second] = floor.robots;
        expect(floor.robots.map((robot) => robot.kind)).toStrictEqual(['normal', 'normal']);
        if (first === undefined || second === undefined) throw new Error('no pair');
        expect(isSameCell(stepToward(first, floor.player), stepToward(second, floor.player))).toBe(
          true,
        );
        expect(
          Math.min(distanceBetween(first, floor.player), distanceBetween(second, floor.player)),
        ).toBeGreaterThanOrEqual(3);
      }),
    );
  });
});

describe('placeRobots', () => {
  it('places the robots of a kind at least the given distance away, with fresh ids', () => {
    const { floor } = placeRobots(layoutOf(EMPTY), { kind: 'fast', count: 2, minDistance: 4 });
    expect(floor.robots.map((robot) => [robot.id, robot.kind])).toStrictEqual([
      [1, 'fast'],
      [2, 'fast'],
    ]);
    floor.robots.forEach((robot) => {
      expect(distanceBetween(robot, floor.player)).toBeGreaterThanOrEqual(4);
    });
    expect(floor.nextId).toBe(3);
  });
});

describe('placeHeaps', () => {
  it('lays the first heap two steps into the heavy robot lane (the design fix: heaps in the robots paths)', () => {
    const lines = [
      'h.......',
      '........',
      '........',
      '...@....',
      '........',
      '........',
      '........',
      '........',
    ];
    expect(boardText(placeHeaps(layoutOf(lines), 1).floor, 8)).toBe(
      [
        'h.......',
        '........',
        '..#.....',
        '...@....',
        '........',
        '........',
        '........',
        '........',
      ].join('\n'),
    );
  });

  it('falls back to one step into the lane, then to any square, when the lane is taken', () => {
    const oneStep = [
      'h.......',
      '........',
      '..#.....',
      '...@....',
      '........',
      '........',
      '........',
      '........',
    ];
    expect(placeHeaps(layoutOf(oneStep), 1).floor.heaps.at(-1)).toMatchObject({ col: 1, row: 1 });
    const blocked = [
      'h.......',
      '.#......',
      '..#.....',
      '...@....',
      '........',
      '........',
      '........',
      '........',
    ];
    const heap = placeHeaps(layoutOf(blocked), 1).floor.heaps.at(-1);
    expect(
      heap === undefined ? 0 : distanceBetween(heap, { col: 3, row: 3 }),
    ).toBeGreaterThanOrEqual(2);
  });

  it('lays the other heaps two steps ahead of a normal robot when that square is free', () => {
    const lines = [
      '........',
      '........',
      '........',
      '...@....',
      '........',
      '........',
      '........',
      '.......n',
    ];
    expect(placeHeaps(layoutOf(lines), 1).floor.heaps).toStrictEqual([
      { id: 2, col: 5, row: 5, isShoved: false },
    ]);
  });

  it('lays a heap on a random far square when the square ahead is too close or taken', () => {
    const lines = [
      '........',
      '........',
      '........',
      '...@....',
      '........',
      '.....#..',
      '........',
      '.......n',
    ];
    const heap = placeHeaps(layoutOf(lines), 1).floor.heaps.at(-1);
    expect(heap?.id).toBe(3);
    expect(
      heap === undefined ? 0 : distanceBetween(heap, { col: 3, row: 3 }),
    ).toBeGreaterThanOrEqual(2);
    const near = [
      '........',
      '........',
      '........',
      '...@....',
      '........',
      '.....n..',
      '........',
      '........',
    ];
    const nearHeap = placeHeaps(layoutOf(near), 1).floor.heaps.at(-1);
    expect(
      nearHeap === undefined ? 0 : distanceBetween(nearHeap, { col: 3, row: 3 }),
    ).toBeGreaterThanOrEqual(2);
  });
});
