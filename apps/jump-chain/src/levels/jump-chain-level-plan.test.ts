// apps/jump-chain/src/levels/jump-chain-level-plan.test.ts
// Spec 8.1 and D9: 3 packs x 30 levels from a seed and a difficulty, each won by the witness;
// "Score games: 3 / 2 / 1 stars at score thresholds".
import { ENDLESS_DIFFICULTY, MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { create } from '@e07/jump-chain/rules/create.ts';

import {
  JUMP_CHAIN_LEVEL_PLAN,
  LEVELS_PER_PACK,
  MIN_WITNESS_MOVES,
  difficultyFor,
  scoreThresholds,
} from './jump-chain-level-plan.ts';
import { JUMP_CHAIN_SOLVER, WITNESS_MAX_NODES } from './jump-chain-solver.ts';

import type { JumpChainState } from '@e07/jump-chain/rules/jump-chain-types.ts';

type WitnessRun = ReturnType<typeof JUMP_CHAIN_SOLVER.solve>;
type SeedOneWitness = { readonly start: JumpChainState; readonly witness: WitnessRun };

let seedOneWitness: SeedOneWitness | undefined;

/** Seed 1 at difficulty 0 and the witness's run on it, solved once per file on first use. */
function seedOne(): SeedOneWitness {
  if (seedOneWitness === undefined) {
    const start = create(1, 0);
    seedOneWitness = { start, witness: JUMP_CHAIN_SOLVER.solve(start, WITNESS_MAX_NODES) };
  }
  return seedOneWitness;
}

/** The witness's win on seed 1 and the level candidate it makes; throws when it did not win. */
function witnessedSeedOne(): {
  readonly witness: Extract<WitnessRun, { kind: 'solved' }>;
  readonly candidate: Parameters<typeof JUMP_CHAIN_LEVEL_PLAN.rate>[0];
} {
  const { start, witness } = seedOne();
  if (witness.kind !== 'solved') throw new Error('seed 1 is witnessed at difficulty 0');
  return { witness, candidate: { level: 1, seed: 1, difficulty: 0, start, ...witness } };
}

const LEVELS = Array.from({ length: 3 * 30 }, (_, index) => index + 1);

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
    expect(scoreThresholds(380)).toStrictEqual([0, 380, 456]);
  });

  it('keeps the thresholds strictly ascending for tiny witness scores', () => {
    expect(scoreThresholds(0)).toStrictEqual([0, 1, 2]);
  });
});

describe('JUMP_CHAIN_LEVEL_PLAN', () => {
  it('has a witness that wins seed 1 at difficulty 0', () => {
    expect(seedOne().witness.kind).toBe('solved');
  });

  it("rates a witnessed level by score, from the witness bot's final score", () => {
    const { witness, candidate } = witnessedSeedOne();
    expect(JUMP_CHAIN_LEVEL_PLAN.rate(candidate)).toStrictEqual({
      kind: 'score',
      thresholds: scoreThresholds(witness.final.score),
    });
    expect(witness.final.score).toBe(GOLDEN_SEED_1_WITNESS_SCORE);
  });

  it('rejects a level the witness wins too quickly to teach anything', () => {
    const { candidate } = witnessedSeedOne();
    expect(JUMP_CHAIN_LEVEL_PLAN.rate({ ...candidate, par: MIN_WITNESS_MOVES - 1 })).toBeNull();
    expect(JUMP_CHAIN_LEVEL_PLAN.rate({ ...candidate, par: MIN_WITNESS_MOVES })).not.toBeNull();
  });

  it('declares three packs of thirty levels named by catalog keys', () => {
    expect(JUMP_CHAIN_LEVEL_PLAN.packs.map((pack) => pack.nameId)).toStrictEqual([
      'jump-chain.pack-name.1',
      'jump-chain.pack-name.2',
      'jump-chain.pack-name.3',
    ]);
    expect(LEVELS_PER_PACK).toBe(30);
    expect(JUMP_CHAIN_LEVEL_PLAN.levelsPerPack).toBe(LEVELS_PER_PACK);
  });
});

/** Pinned: the witness's final score on seed 1 at difficulty 0. */
const GOLDEN_SEED_1_WITNESS_SCORE = 440;
