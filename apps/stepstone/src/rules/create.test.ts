// apps/stepstone/src/rules/create.test.ts
// Spec 8.1: "Levels are generated from a seed number plus a difficulty, not drawn by hand. The
// same seed always makes the same level." Stepstone is turn-based (apply the hop, then animate its
// events), played with a tap on a reachable stone.
import fc from 'fast-check';

import { create } from './create.ts';
import { hopDistance } from './hop-distance.ts';
import { MOVE_KINDS } from './hops.ts';
import { kindsIn, pondText } from './pond-text.ts';
import { knobsFor } from './stepstone-tuning.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });

describe('create (a turn-based game: apply the hop, then animate its events)', () => {
  it('keeps the pinned pond for seed 1 at difficulty 0 (a changed pond breaks saved levels)', () => {
    const state = create(1, 0);
    expect(pondText(state)).toBe(GOLDEN_SEED_1_POND);
    expect(state.par).toBe(GOLDEN_SEED_1_PAR);
  });

  it('lays the pond its tuning row asks for, never smaller at a higher difficulty', () => {
    const difficulties = [0, 25, 50, 75, 99];
    const sides = difficulties.map((difficulty) => create(3, difficulty).side);
    expect(sides).toStrictEqual(difficulties.map((difficulty) => knobsFor(difficulty).side));
    expect([...sides].sort((a, b) => a - b)).toStrictEqual(sides);
  });

  it('starts a run with no hops made and the start stone as the first hop kind used', () => {
    const state = create(7, 30);
    expect(state.moves).toBe(0);
    expect(state.kindsUsed).toStrictEqual([state.cells[state.frog]]);
  });

  it('clamps difficulties outside 0..100', () => {
    expect(create(5, -3)).toStrictEqual(create(5, 0));
    expect(create(5, 250)).toStrictEqual(create(5, 100));
  });

  it('lays different ponds for different seeds', () => {
    const ponds = new Set(Array.from({ length: 40 }, (_, seed) => pondText(create(seed, 50))));
    expect(ponds.size).toBe(40);
  });

  describe('properties', () => {
    it('gives the same state for the same seed and difficulty', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(create(seed, difficulty)).toStrictEqual(create(seed, difficulty));
        }),
        { numRuns: 60 },
      );
    });

    it('starts every game with one flag and the frog on a hop stone, away from the flag', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          expect(state.cells[state.frog]).not.toBe('flag');
          expect(flagsIn(state.cells)).toBe(1);
          expect(MOVE_KINDS).toContain(state.cells[state.frog]);
        }),
        { numRuns: 60 },
      );
    });

    it('caps the hop kinds at those of its row, four glyphs at most (v1)', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expectKindsOfRow(seed, difficulty);
        }),
        { numRuns: 60 },
      );
    });

    it('lays a pond the frog can cross, its par the shortest route', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          expect(state.par).toBeGreaterThanOrEqual(1);
          expect(hopDistance(state)).toBe(state.par);
        }),
        { numRuns: 60 },
      );
    });
  });

  it('needs at least the fewest hops of its row in nearly every pond', () => {
    const short = Array.from({ length: 200 }, (_, seed) => create(seed, 60)).filter(
      (state) => state.par < knobsFor(60).minPar,
    );
    expect(short.length).toBeLessThanOrEqual(4);
  });
});

/** How many flag stones a pond has. */
function flagsIn(cells: readonly string[]): number {
  return cells.filter((cell) => cell === 'flag').length;
}

/** The pond's hop kinds are its row's, never more than the four v1 glyphs. */
function expectKindsOfRow(seed: number, difficulty: number): void {
  const kinds = kindsIn(create(seed, difficulty).cells);
  expect(kinds.length).toBeLessThanOrEqual(4);
  expect(knobsFor(difficulty).kinds).toStrictEqual(expect.arrayContaining(kinds));
}

const GOLDEN_SEED_1_POND = ['..r..', '.....', '..K.F', '..RK.', '.....'].join('\n');
const GOLDEN_SEED_1_PAR = 3;
