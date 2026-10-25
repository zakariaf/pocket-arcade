// apps/trail-clear/src/levels/trail-clear-level-plan.test.ts
// Spec 8.1: "Score games: 3 / 2 / 1 stars at score thresholds." D9: 3 packs x 30 levels.
import { ENDLESS_DIFFICULTY, MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { create } from '@e07/trail-clear/rules/create.ts';

import {
  LEVELS_PER_PACK,
  MIN_WITNESS_LOOPS,
  TRAIL_CLEAR_LEVEL_PLAN,
  difficultyFor,
  scoreThresholds,
} from './trail-clear-level-plan.ts';
import { TRAIL_CLEAR_SOLVER, WITNESS_MAX_NODES } from './trail-clear-solver.ts';

import type { TrailClearState } from '@e07/trail-clear/rules/trail-clear-types.ts';

type WitnessRun = ReturnType<typeof TRAIL_CLEAR_SOLVER.solve>;
type SeedOneWitness = { readonly start: TrailClearState; readonly witness: WitnessRun };

let seedOneWitness: SeedOneWitness | undefined;

/** Seed 1 at difficulty 0 and the witness's run on it, solved once per file on first use. */
function seedOne(): SeedOneWitness {
  if (seedOneWitness === undefined) {
    const start = create(1, 0);
    seedOneWitness = { start, witness: TRAIL_CLEAR_SOLVER.solve(start, WITNESS_MAX_NODES) };
  }
  return seedOneWitness;
}

/** The witness's win on seed 1 and the level candidate it makes; throws when it did not win. */
function witnessedSeedOne(): {
  readonly witness: Extract<WitnessRun, { kind: 'solved' }>;
  readonly candidate: Parameters<typeof TRAIL_CLEAR_LEVEL_PLAN.rate>[0];
} {
  const { start, witness } = seedOne();
  if (witness.kind !== 'solved') throw new Error('seed 1 is witnessed at difficulty 0');
  return { witness, candidate: { level: 1, seed: 1, difficulty: 0, start, ...witness } };
}

const LEVELS = Array.from({ length: 3 * LEVELS_PER_PACK }, (_, index) => index + 1);

describe('difficultyFor', () => {
  it('rises from 0 at level 1 to the top level row at the last level without ever falling', () => {
    const curve = LEVELS.map(difficultyFor);
    expect(curve[0]).toBe(0);
    expect(curve.at(-1)).toBe(MAX_LEVEL_DIFFICULTY);
    expect(curve).toStrictEqual([...curve].sort((a, b) => a - b));
  });

  it('stays below the endless difficulty and clamps level numbers outside the table', () => {
    expect(MAX_LEVEL_DIFFICULTY).toBeLessThan(ENDLESS_DIFFICULTY);
    expect([0, 500].map(difficultyFor)).toStrictEqual([0, MAX_LEVEL_DIFFICULTY]);
  });
});

describe('scoreThresholds', () => {
  it('lets any score win, gives 2 stars at the witness score and 3 stars 20 % above it', () => {
    expect(scoreThresholds(800)).toStrictEqual([0, 800, 960]);
  });

  it('keeps the thresholds strictly ascending for tiny witness scores', () => {
    expect(scoreThresholds(0)).toStrictEqual([0, 1, 2]);
  });
});

describe('TRAIL_CLEAR_LEVEL_PLAN', () => {
  it('has a witness that wins seed 1 at difficulty 0', () => {
    expect(seedOne().witness.kind).toBe('solved');
  });

  it("rates a witnessed level by score, from the witness bot's final score", () => {
    const { witness, candidate } = witnessedSeedOne();
    expect(TRAIL_CLEAR_LEVEL_PLAN.rate(candidate)).toStrictEqual({
      kind: 'score',
      thresholds: scoreThresholds(witness.final.score),
    });
  });

  it('rejects a level whose witness closes too few loops to be a puzzle', () => {
    const { candidate, witness } = witnessedSeedOne();
    const final = { ...witness.final, loopsClosed: MIN_WITNESS_LOOPS - 1 };
    expect(TRAIL_CLEAR_LEVEL_PLAN.rate({ ...candidate, final })).toBeNull();
  });

  it('declares three packs of thirty levels named by catalog keys', () => {
    expect(TRAIL_CLEAR_LEVEL_PLAN.packs.map((pack) => pack.nameId)).toStrictEqual([
      'trail-clear.pack-name.1',
      'trail-clear.pack-name.2',
      'trail-clear.pack-name.3',
    ]);
    expect(TRAIL_CLEAR_LEVEL_PLAN.levelsPerPack).toBe(30);
  });
});
