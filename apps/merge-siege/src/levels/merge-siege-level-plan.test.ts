// apps/merge-siege/src/levels/merge-siege-level-plan.test.ts
// Spec 8.1 and D9: "3 packs x 30 levels", "Levels are generated from a seed number plus a
// difficulty", "Score games: 3 / 2 / 1 stars at score thresholds." Merge Siege is a score game:
// the witness's final score sets the stars, and its line length (par) only filters out levels it
// wins too quickly.
import { ENDLESS_DIFFICULTY, MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { create } from '@e07/merge-siege/rules/create.ts';

import {
  LEVELS_PER_PACK,
  MERGE_SIEGE_LEVEL_PLAN,
  MIN_WITNESS_SWIPES,
  difficultyFor,
  scoreThresholds,
} from './merge-siege-level-plan.ts';
import { MERGE_SIEGE_SOLVER, WITNESS_MAX_NODES } from './merge-siege-solver.ts';

type WitnessRun = ReturnType<typeof MERGE_SIEGE_SOLVER.solve>;

/** The witness's win on seed 1 at difficulty 0 and the level candidate it makes. */
function witnessedSeedOne(): {
  readonly witness: Extract<WitnessRun, { kind: 'solved' }>;
  readonly candidate: Parameters<typeof MERGE_SIEGE_LEVEL_PLAN.rate>[0];
} {
  const start = create(1, 0);
  const witness = MERGE_SIEGE_SOLVER.solve(start, WITNESS_MAX_NODES);
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
    expect(scoreThresholds(250)).toStrictEqual([0, 250, 300]);
  });

  it('keeps the thresholds strictly ascending for tiny witness scores', () => {
    expect(scoreThresholds(0)).toStrictEqual([0, 1, 2]);
  });
});

describe('MERGE_SIEGE_LEVEL_PLAN', () => {
  it("rates a witnessed level by score, from the witness bot's final score", () => {
    const { witness, candidate } = witnessedSeedOne();
    expect(witness.final.score).toBe(GOLDEN_WITNESS_SCORE);
    expect(MERGE_SIEGE_LEVEL_PLAN.rate(candidate)).toStrictEqual({
      kind: 'score',
      thresholds: scoreThresholds(GOLDEN_WITNESS_SCORE),
    });
  });

  it('rejects a level the witness wins too quickly to teach anything', () => {
    const { candidate } = witnessedSeedOne();
    expect(MERGE_SIEGE_LEVEL_PLAN.rate({ ...candidate, par: MIN_WITNESS_SWIPES - 1 })).toBeNull();
  });

  it('declares three packs of thirty levels named by catalog keys', () => {
    expect(MERGE_SIEGE_LEVEL_PLAN.packs.map((pack) => pack.nameId)).toStrictEqual([
      'merge-siege.pack-name.1',
      'merge-siege.pack-name.2',
      'merge-siege.pack-name.3',
    ]);
    expect(MERGE_SIEGE_LEVEL_PLAN.levelsPerPack).toBe(30);
  });
});

/** Pinned: the witness's final score on seed 1 at difficulty 0. */
const GOLDEN_WITNESS_SCORE = 348;
