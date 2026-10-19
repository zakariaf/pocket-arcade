// apps/snare-snake/src/rules/opening.test.ts
// The design fix's opening (design notes): the snake starts coiled around a nest of critters.
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { neighboursOf } from './board-grid.ts';
import { drawOpening, nestCells, ringAround } from './opening.ts';
import { TUNING } from './snare-snake-tuning.ts';

const GRID = { cols: 7, rows: 8 };
const ONE_NEST = { col: 2, row: 2, width: 1, height: 1 };
const TWO_NEST = { col: 2, row: 2, width: 2, height: 1 };

describe('ringAround', () => {
  it('lists the eight cells around a one-cell nest clockwise from the top-start corner', () => {
    expect(ringAround(GRID, ONE_NEST)).toStrictEqual([8, 9, 10, 17, 24, 23, 22, 15]);
  });

  it('lists the ten cells around a two-cell nest, each next to the one before', () => {
    const ring = ringAround(GRID, TWO_NEST);
    expect(ring).toHaveLength(10);
    ring.forEach((cell, index) => {
      expect(neighboursOf(GRID, cell)).toContain(ring[(index + 1) % ring.length]);
    });
  });
});

describe('nestCells', () => {
  it('lists the nest cells row by row', () => {
    expect(nestCells(GRID, TWO_NEST)).toStrictEqual([16, 17]);
    expect(nestCells(GRID, { col: 2, row: 2, width: 1, height: 2 })).toStrictEqual([16, 23]);
  });
});

describe('drawOpening', () => {
  const knobs = TUNING.levelRows[0];

  it('coils the snake around its nest with nestGap ring cells open in front of the head', () => {
    fc.assert(
      fc.property(fc.nat(), (seed) => {
        const { snake, critters } = drawOpening(GRID, knobs, seedRng(seed));
        const nest = critters.slice(0, knobs.nestCritters).map((critter) => critter.cell);
        // Every nest cell's sides are segments, the other nest cell, or one of the open gap cells.
        const open = new Set(
          nest
            .flatMap((cell) => neighboursOf(GRID, cell))
            .filter((cell) => !snake.includes(cell) && !nest.includes(cell)),
        );
        expect(open.size).toBeGreaterThan(0);
        expect(open.size).toBeLessThanOrEqual(TUNING.nestGap);
      }),
    );
  });

  it('passes the stream on: the rng it returns is past the draws it made', () => {
    const start = seedRng(3);
    expect(drawOpening(GRID, knobs, start).rng).not.toStrictEqual(start);
  });

  it('gives up with a RangeError when no opening fits the board', () => {
    expect(() => drawOpening({ cols: 4, rows: 4 }, knobs, seedRng(1))).toThrow(RangeError);
  });
});
