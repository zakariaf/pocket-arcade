// apps/poker-drop/src/levels/poker-drop-level-plan.test.ts
import { ENDLESS_DIFFICULTY, MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { create } from '@e07/poker-drop/rules/create.ts';

import {
  LEVELS_PER_PACK,
  MIN_WITNESS_DROPS,
  POKER_DROP_LEVEL_PLAN,
  difficultyFor,
  scoreThresholds,
} from './poker-drop-level-plan.ts';
import { POKER_DROP_SOLVER, WITNESS_MAX_NODES } from './poker-drop-solver.ts';

import type { PokerDropState } from '@e07/poker-drop/rules/poker-drop-types.ts';

type WitnessRun = ReturnType<typeof POKER_DROP_SOLVER.solve>;
type SeedOneWitness = { readonly start: PokerDropState; readonly witness: WitnessRun };

let seedOneWitness: SeedOneWitness | undefined;

/** Seed 1 at difficulty 0 and the witness's run on it, solved once per file on first use. */
function seedOne(): SeedOneWitness {
  if (seedOneWitness === undefined) {
    const start = create(1, 0);
    seedOneWitness = { start, witness: POKER_DROP_SOLVER.solve(start, WITNESS_MAX_NODES) };
  }
  return seedOneWitness;
}

/** The witness's win on seed 1 and the level candidate it makes; throws when it did not win. */
function witnessedSeedOne(): {
  readonly witness: Extract<WitnessRun, { kind: 'solved' }>;
  readonly candidate: Parameters<typeof POKER_DROP_LEVEL_PLAN.rate>[0];
} {
  const { start, witness } = seedOne();
  if (witness.kind !== 'solved') throw new Error('seed 1 is witnessed at difficulty 0');
  return { witness, candidate: { level: 1, seed: 1, difficulty: 0, start, ...witness } };
}

const LEVELS = Array.from({ length: 3 * LEVELS_PER_PACK }, (_, index) => index + 1);
const byNumber = (a: number, b: number): number => a - b;

describe('difficultyFor', () => {
  // spec 8.1 and D9: 3 packs of 30 levels whose difficulty rises.
  it('rises from 0 at level 1 to the top level row at the last level without ever falling', () => {
    const curve = LEVELS.map(difficultyFor);
    expect(curve[0]).toBe(0);
    expect(curve.at(-1)).toBe(MAX_LEVEL_DIFFICULTY);
    expect(curve).toStrictEqual([...curve].sort(byNumber));
  });

  it('stays below the endless difficulty and clamps level numbers outside the table', () => {
    expect(MAX_LEVEL_DIFFICULTY).toBeLessThan(ENDLESS_DIFFICULTY);
    expect([0, 500].map(difficultyFor)).toStrictEqual([0, MAX_LEVEL_DIFFICULTY]);
  });
});

describe('scoreThresholds', () => {
  // spec 8.1: "Score games: 3 / 2 / 1 stars at score thresholds."
  it('lets any score win, gives 2 stars at the witness score and 3 stars 20 % above it', () => {
    expect(scoreThresholds(150)).toStrictEqual([0, 150, 180]);
  });

  it('keeps the thresholds strictly ascending for tiny witness scores', () => {
    expect(scoreThresholds(0)).toStrictEqual([0, 1, 2]);
  });
});

describe('POKER_DROP_LEVEL_PLAN', () => {
  it("rates a witnessed level by score, from the witness bot's final score", () => {
    const { witness, candidate } = witnessedSeedOne();
    expect(POKER_DROP_LEVEL_PLAN.rate(candidate)).toStrictEqual({
      kind: 'score',
      thresholds: scoreThresholds(witness.final.score),
    });
  });

  it('rejects a level the witness wins in fewer drops than the minimum', () => {
    const { candidate } = witnessedSeedOne();
    expect(POKER_DROP_LEVEL_PLAN.rate({ ...candidate, par: MIN_WITNESS_DROPS - 1 })).toBeNull();
    expect(POKER_DROP_LEVEL_PLAN.rate({ ...candidate, par: MIN_WITNESS_DROPS })).not.toBeNull();
  });

  it('declares three packs of thirty levels named by catalog keys', () => {
    expect(POKER_DROP_LEVEL_PLAN.packs.map((pack) => pack.nameId)).toStrictEqual([
      'poker-drop.pack-name.1',
      'poker-drop.pack-name.2',
      'poker-drop.pack-name.3',
    ]);
    expect(POKER_DROP_LEVEL_PLAN.levelsPerPack).toBe(30);
  });
});
