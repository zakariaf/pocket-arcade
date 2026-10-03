// apps/line-siege/src/levels/line-siege-level-plan.test.ts
import { ENDLESS_DIFFICULTY, MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { create } from '@e07/line-siege/rules/create.ts';

import {
  LEVELS_PER_PACK,
  LINE_SIEGE_LEVEL_PLAN,
  MIN_WITNESS_PLACEMENTS,
  difficultyFor,
  scoreThresholds,
} from './line-siege-level-plan.ts';
import { LINE_SIEGE_SOLVER, WITNESS_MAX_NODES } from './line-siege-solver.ts';

import type { LineSiegeState } from '@e07/line-siege/rules/line-siege-types.ts';

type WitnessRun = ReturnType<typeof LINE_SIEGE_SOLVER.solve>;
type SeedOneWitness = { readonly start: LineSiegeState; readonly witness: WitnessRun };

let seedOneWitness: SeedOneWitness | undefined;

/**
 * Seed 1 at difficulty 0 and the witness's run on it, solved once per file on first use inside an
 * example, so a broken witness fails examples instead of the file's collection.
 */
function seedOne(): SeedOneWitness {
  if (seedOneWitness === undefined) {
    const start = create(1, 0);
    seedOneWitness = { start, witness: LINE_SIEGE_SOLVER.solve(start, WITNESS_MAX_NODES) };
  }
  return seedOneWitness;
}

/** The witness's win on seed 1 and the level candidate it makes; throws when it did not win. */
function witnessedSeedOne(): {
  readonly witness: Extract<WitnessRun, { kind: 'solved' }>;
  readonly candidate: Parameters<typeof LINE_SIEGE_LEVEL_PLAN.rate>[0];
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
    expect(scoreThresholds(150)).toStrictEqual([0, 150, 180]);
  });

  it('keeps the thresholds strictly ascending for tiny witness scores', () => {
    expect(scoreThresholds(0)).toStrictEqual([0, 1, 2]);
  });
});

describe('LINE_SIEGE_LEVEL_PLAN', () => {
  it('has a witness that wins seed 1 at difficulty 0', () => {
    expect(seedOne().witness.kind).toBe('solved');
  });

  it("rates a witnessed level by score, from the witness bot's final score", () => {
    const { witness, candidate } = witnessedSeedOne();
    expect(witness.final.score).toBe(170);
    expect(LINE_SIEGE_LEVEL_PLAN.rate(candidate)).toStrictEqual({
      kind: 'score',
      thresholds: [0, 170, 204],
    });
  });

  it('rejects a level the witness wins too quickly to teach anything', () => {
    const { candidate } = witnessedSeedOne();
    const par = MIN_WITNESS_PLACEMENTS - 1;
    expect(LINE_SIEGE_LEVEL_PLAN.rate({ ...candidate, par })).toBeNull();
  });

  it('declares three packs of thirty levels named by catalog keys', () => {
    expect(LINE_SIEGE_LEVEL_PLAN.packs.map((pack) => pack.nameId)).toStrictEqual([
      'line-siege.pack-name.1',
      'line-siege.pack-name.2',
      'line-siege.pack-name.3',
    ]);
    expect(LINE_SIEGE_LEVEL_PLAN.levelsPerPack).toBe(30);
  });
});

describe('LINE_SIEGE_LEVEL_PLAN minimum', () => {
  it('accepts a level the witness wins in exactly the minimum number of placements', () => {
    const { candidate } = witnessedSeedOne();
    const rated = LINE_SIEGE_LEVEL_PLAN.rate({ ...candidate, par: MIN_WITNESS_PLACEMENTS });
    expect(rated).toStrictEqual({ kind: 'score', thresholds: [0, 170, 204] });
  });
});
