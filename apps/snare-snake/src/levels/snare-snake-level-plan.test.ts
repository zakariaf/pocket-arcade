// apps/snare-snake/src/levels/snare-snake-level-plan.test.ts
// Spec 8.1: "Score games: 3 / 2 / 1 stars at score thresholds"; D9: 3 packs x 30 levels.
import { ENDLESS_DIFFICULTY, MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { create } from '@e07/snare-snake/rules/create.ts';

import {
  LEVELS_PER_PACK,
  MIN_WITNESS_MOVES,
  SNARE_SNAKE_LEVEL_PLAN,
  difficultyFor,
  scoreThresholds,
} from './snare-snake-level-plan.ts';
import { SNARE_SNAKE_SOLVER, WITNESS_MAX_NODES } from './snare-snake-solver.ts';

type WitnessRun = ReturnType<typeof SNARE_SNAKE_SOLVER.solve>;
type Candidate = Parameters<typeof SNARE_SNAKE_LEVEL_PLAN.rate>[0];

/** Seed 1 at difficulty 0 and the witness's win on it, as the level candidate it makes. */
function witnessedSeedOne(): {
  readonly witness: Extract<WitnessRun, { kind: 'solved' }>;
  readonly candidate: Candidate;
} {
  const start = create(1, 0);
  const witness = SNARE_SNAKE_SOLVER.solve(start, WITNESS_MAX_NODES);
  if (witness.kind !== 'solved') throw new Error('seed 1 is witnessed at difficulty 0');
  return { witness, candidate: { level: 1, seed: 1, difficulty: 0, start, ...witness } };
}

const LEVELS = Array.from({ length: 3 * LEVELS_PER_PACK }, (_slot, index) => index + 1);

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

  it('starts each pack in its own tuning row band (pack 2 at 33, pack 3 at 66)', () => {
    expect([1, 31, 61].map(difficultyFor)).toStrictEqual([0, 33, 66]);
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

describe('SNARE_SNAKE_LEVEL_PLAN', () => {
  it("rates a witnessed level by score, from the witness bot's final score", () => {
    const { witness, candidate } = witnessedSeedOne();
    expect(witness.final.score).toBe(GOLDEN_SEED_1_SCORE);
    expect(SNARE_SNAKE_LEVEL_PLAN.rate(candidate)).toStrictEqual({
      kind: 'score',
      thresholds: scoreThresholds(GOLDEN_SEED_1_SCORE),
    });
  });

  it('rejects a level the witness wins too quickly to teach anything, and accepts the minimum', () => {
    const { candidate } = witnessedSeedOne();
    expect(SNARE_SNAKE_LEVEL_PLAN.rate({ ...candidate, par: MIN_WITNESS_MOVES - 1 })).toBeNull();
    expect(SNARE_SNAKE_LEVEL_PLAN.rate({ ...candidate, par: MIN_WITNESS_MOVES })).not.toBeNull();
  });

  it('declares three packs of thirty levels named by catalog keys', () => {
    expect(SNARE_SNAKE_LEVEL_PLAN.packs.map((pack) => pack.nameId)).toStrictEqual([
      'snare-snake.pack-name.1',
      'snare-snake.pack-name.2',
      'snare-snake.pack-name.3',
    ]);
    expect(SNARE_SNAKE_LEVEL_PLAN.levelsPerPack).toBe(30);
  });
});

const GOLDEN_SEED_1_SCORE = 195;
