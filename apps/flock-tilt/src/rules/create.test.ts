// apps/flock-tilt/src/rules/create.test.ts
import fc from 'fast-check';

import { create, createWithin } from './create.ts';
import { solveField } from './field-search.ts';
import { fieldStatus } from './field-status.ts';
import { fieldText } from './field-text.ts';
import { TUNING, knobsFor } from './flock-tilt-tuning.ts';
import { stepFrom, DIRECTIONS } from './tilt-field.ts';

import type { FlockTiltState } from './flock-tilt-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 99 });

function touchesWolf(state: FlockTiltState, cell: number): boolean {
  return DIRECTIONS.some((direction) =>
    state.wolves.some((wolf) => wolf.cell === stepFrom(state, cell, direction)),
  );
}

/** Counts the row asks for (spec 13: one 7x7 field, rocks, a pen, sheep and 1-2 wolves). */
function countProblems(state: FlockTiltState, difficulty: number): string[] {
  const knobs = knobsFor(difficulty);
  const rocks = state.rocks.length;
  return [
    state.cols === 7 && state.rows === 7 ? '' : 'not 7x7',
    state.sheep.length === knobs.sheep ? '' : 'sheep count',
    state.wolves.length === knobs.wolves ? '' : 'wolf count',
    rocks >= knobs.minRocks && rocks <= knobs.maxRocks ? '' : 'rocks',
  ];
}

/** Places: one thing per cell, on the field, every sheep out of the pen and away from wolves. */
function placeProblems(state: FlockTiltState): string[] {
  const cells = [state.pen, ...state.rocks, ...state.sheep.map((s) => s.cell)];
  const occupied = [...cells, ...state.wolves.map((wolf) => wolf.cell)];
  return [
    new Set(occupied).size === occupied.length ? '' : 'two things on one cell',
    occupied.every((cell) => cell >= 0 && cell < 49) ? '' : 'off the field',
    state.sheep.every((sheep) => sheep.status === 'field') ? '' : 'a sheep not on the field',
    state.sheep.some((sheep) => touchesWolf(state, sheep.cell)) ? 'a sheep touches a wolf' : '',
  ];
}

function startProblems(state: FlockTiltState, difficulty: number): string[] {
  return [...countProblems(state, difficulty), ...placeProblems(state)].filter((p) => p !== '');
}

describe('create (turn-based, 4-way swipe; spec 10 RULES: "Start state for a level")', () => {
  it('keeps the pinned field for seed 1 at difficulty 0 (a changed field breaks saved levels)', () => {
    const state = create(1, 0);
    expect(fieldText(state)).toBe(GOLDEN_SEED_1_FIELD.join('\n'));
    expect(state.par).toBe(GOLDEN_SEED_1_PAR);
  });

  it('starts a run with no tilts made, the full budget, no continue used', () => {
    const state = create(7, 30);
    expect(state.tilts).toBe(0);
    expect(state.tiltLimit).toBe(TUNING.tiltLimit);
    expect(state.hasContinued).toBe(false);
    expect(state.beforeLoss).toBeNull();
    expect(fieldStatus(state)).toBe('playing');
  });

  it('adds sheep and a second wolf in the harder rows', () => {
    expect([0, 25, 50, 75].map((d) => create(3, d).sheep.length)).toStrictEqual([2, 3, 4, 5]);
    expect([0, 25, 50, 75].map((d) => create(3, d).wolves.length)).toStrictEqual([1, 1, 1, 2]);
  });

  it('clamps difficulties outside 0..100', () => {
    expect(create(5, -3)).toStrictEqual(create(5, 0));
    expect(create(5, 250)).toStrictEqual(create(5, 100));
  });

  it('falls back to a prepared field, winnable in one tilt, when no draw is kept', () => {
    const state = createWithin(9, 80, 0);
    expect(startProblems(state, 80)).toStrictEqual([]);
    expect(state.rocks).toStrictEqual([21, 22, 23, 24, 25]);
    expect(state.par).toBe(1);
    expect(solveField(state, 8, 1000)?.par).toBe(1);
  });

  describe('properties', () => {
    it('gives the same state for the same seed and difficulty', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(create(seed, difficulty)).toStrictEqual(create(seed, difficulty));
        }),
        { numRuns: 40 },
      );
    });

    it('places the field from the seed: rocks, one pen, the row of sheep and wolves, apart', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(startProblems(create(seed, difficulty), difficulty)).toStrictEqual([]);
        }),
        { numRuns: 60 },
      );
    });

    it('makes only fields the search wins at the recorded par, inside the row band', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          const knobs = knobsFor(difficulty);
          expect(solveField(state, 8, TUNING.searchNodes)?.par).toBe(state.par);
          expect(state.par).toBeGreaterThanOrEqual(knobs.minPar);
          expect(state.par).toBeLessThanOrEqual(knobs.maxPar);
        }),
        { numRuns: 60 },
      );
    });

    it('gives different seeds different fields', () => {
      const texts = Array.from({ length: 20 }, (_, seed) => fieldText(create(seed, 40)));
      expect(new Set(texts).size).toBe(20);
    });
  });
});

const GOLDEN_SEED_1_FIELD = [
  '.#s...#',
  '..##..#',
  '..##..w',
  '.......',
  '....s..',
  '.......',
  '..#..o.',
];

const GOLDEN_SEED_1_PAR = 3;
