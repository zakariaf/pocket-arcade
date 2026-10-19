// apps/scrap-shove/src/rules/create.test.ts
// Classification: turn-based (apply the move, then animate its events); input: a tap on a square
// next to the player steps there or shoves its heap, a tap on the player waits (panMode 'none').
import fc from 'fast-check';

import { jsonShapeProblems } from '@e07/game-kit/testing/json-shape.ts';

import { boardText } from './board-text.ts';
import { create, firstWinnable, startLayout } from './create.ts';
import { distanceBetween, isSameCell, stepToward } from './floor-squares.ts';
import { outcome } from './outcome.ts';
import { TUNING, knobsFor } from './scrap-shove-tuning.ts';
import { solveFloor } from './solve-floor.ts';

import type { Cell, ScrapShoveState } from './scrap-shove-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });

function kindCounts(state: ScrapShoveState): number[] {
  return ['normal', 'fast', 'heavy'].map(
    (kind) => state.robots.filter((robot) => robot.kind === kind).length,
  );
}

function squareKeys(state: ScrapShoveState): string[] {
  const cells: Cell[] = [state.player, ...state.robots, ...state.heaps];
  return cells.map((cell) => `${String(cell.col)},${String(cell.row)}`);
}

function nearestRobot(state: ScrapShoveState): number {
  return Math.min(...state.robots.map((robot) => distanceBetween(robot, state.player)));
}

/** True when two robots step onto the same square on the first robots' turn. */
function hasMeetingPair(state: ScrapShoveState): boolean {
  const steps = state.robots.map((robot) => stepToward(robot, state.player));
  return steps.some((step, index) =>
    steps.slice(index + 1).some((other) => isSameCell(step, other)),
  );
}

describe('create (turn-based; a tap next to the player steps or shoves)', () => {
  it('keeps the pinned floor for seed 1 at difficulty 0 (a changed floor breaks saved levels)', () => {
    expect(boardText(create(1, 0), 8)).toBe(GOLDEN_SEED_1_FLOOR);
  });

  it('lays out one 8 x 8 floor with the player, all three robot kinds and scrap (spec 13: one grid size)', () => {
    const state = create(7, 99);
    expect([state.cols, state.rows]).toStrictEqual([8, 8]);
    expect(kindCounts(state)).toStrictEqual([7, 2, 3]);
    expect(state.heaps).toHaveLength(4);
    expect(state).toMatchObject({
      robotsTotal: 12,
      caughtBy: null,
      rescue: null,
      hasContinued: false,
    });
  });

  it('adds robots, fast ones and heavy ones on harder rows (spec 13: floors that get denser)', () => {
    const counts = [0, 25, 50, 75].map((difficulty) => kindCounts(create(3, difficulty)));
    expect(counts).toStrictEqual([
      [4, 0, 1],
      [5, 1, 1],
      [6, 1, 2],
      [7, 2, 3],
    ]);
  });

  it('lays out only floors the solver proves winnable (spec 8.1: no level is impossible)', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        expect(solveFloor(create(seed, difficulty), TUNING.createMaxNodes).kind).toBe('solved');
      }),
      { numRuns: 40 },
    );
  });

  it('tries the next layout of the seed stream when the first cannot be won', () => {
    const first = firstWinnable(startLayout(39), knobsFor(0), { attempts: 1, maxNodes: 60_000 });
    expect(solveFloor(first, 60_000).kind).toBe('unsolvable');
    expect(create(39, 0)).not.toStrictEqual(first);
    expect(create(39, 0).player).toStrictEqual(first.player);
  });

  it('keeps the last layout tried when none is proven within the budget', () => {
    const third = firstWinnable(startLayout(1), knobsFor(0), { attempts: 3, maxNodes: 0 });
    expect(third).not.toStrictEqual(create(1, 0));
    expect(third.robots).toHaveLength(5);
  });

  it('clamps difficulties outside 0..100', () => {
    expect(create(5, -3)).toStrictEqual(create(5, 0));
    expect(create(5, 250)).toStrictEqual(create(5, 100));
  });

  it('gives different seeds different floors', () => {
    const floors = new Set(Array.from({ length: 20 }, (_, seed) => boardText(create(seed, 0), 8)));
    expect(floors.size).toBe(20);
  });

  it('gives the same state for the same seed and difficulty', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        expect(create(seed, difficulty)).toStrictEqual(create(seed, difficulty));
      }),
    );
  });

  it('places exactly the robots and heaps of the difficulty row, never two on one square', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        const state = create(seed, difficulty);
        const knobs = knobsFor(difficulty);
        expect(kindCounts(state)).toStrictEqual([knobs.normal, knobs.fast, knobs.heavy]);
        expect(state.heaps).toHaveLength(knobs.heaps);
        expect(new Set(squareKeys(state)).size).toBe(squareKeys(state).length);
      }),
    );
  });

  it('keeps every robot at least three squares from the player at the start (spec 13: floor 1 can corner the player)', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        expect(nearestRobot(create(seed, difficulty))).toBeGreaterThanOrEqual(3);
      }),
    );
  });

  it('opens with two robots that step onto one square on the first robots turn (the first crash)', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        expect(hasMeetingPair(create(seed, difficulty))).toBe(true);
      }),
    );
  });

  it('starts every floor unfinished and JSON-safe', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        const state = create(seed, difficulty);
        expect(outcome(state).kind).toBe('playing');
        expect(jsonShapeProblems(state)).toStrictEqual([]);
      }),
    );
  });
});

const GOLDEN_SEED_1_FLOOR = [
  '.......#',
  '.....h..',
  '........',
  '.n..#...',
  '.n..@...',
  '........',
  '.n.....#',
  '...n....',
].join('\n');
