// apps/line-siege/src/rules/line-siege-tuning.ts
// Every balance number of Line Siege, in one place. The rules import these and contain no other
// balance numbers. Every number is a default until the owner's play-test. Change a knob only
// together with a sim run (npm run test:sim) and compare reports/sim/line-siege.json before and
// after; test/sims/line-siege/balance-bands.json says what "balanced" means. A change after the
// level packs exist regenerates them (generate-levels.ts) with a Gate-Change: trailer.
import { isEndlessDifficulty, rowFor } from '@e07/game-kit/contract/difficulty.ts';

/** Spawn weights per monster kind (out of their sum); a kind with weight 0 never appears. */
export type KindWeights = {
  /** Weight of normal monsters (more = easier mix). */
  readonly normal: number;
  /** Weight of armoured monsters, which ignore shockwaves (more = harder). */
  readonly armoured: number;
  /** Weight of fast monsters, which step fastStep rows per march (more = harder). */
  readonly fast: number;
};

/** The knobs that change with difficulty: one level row per band of 0..99, plus the endless row. */
export type DifficultyKnobs = {
  /** Monsters in the level's wave; the level is won when the whole wave is gone (0 = endless, never won). */
  readonly goal: number;
  /** Monsters step toward the wall every Nth placement (higher = calmer). */
  readonly marchEvery: number;
  /** A new monster enters every Nth placement while the wave lasts (higher = fewer monsters). */
  readonly spawnEvery: number;
  /** Lowest health of a new monster (higher = harder). */
  readonly hpMin: number;
  /** Highest health of a new monster (higher = harder). */
  readonly hpMax: number;
  /** Which kinds spawn (more armoured or fast = harder). */
  readonly kinds: KindWeights;
};

/** Only normal monsters: the first rows teach the beam before any kind resists it. */
const NORMAL_ONLY = { normal: 1, armoured: 0, fast: 0 } as const satisfies KindWeights;
/** Some fast monsters (they step two rows per march: less time to aim). */
const SOME_FAST = { normal: 3, armoured: 0, fast: 1 } as const satisfies KindWeights;
/** Every kind: armoured ones ignore the row shockwave, so columns must be aimed. */
const MIXED = { normal: 2, armoured: 1, fast: 1 } as const satisfies KindWeights;

/**
 * Level rows, easiest first; each row clearly harder than the one before (the sim checks the
 * curve). Difficulty 0..99 picks a row with rowFor (four rows: 0-24, 25-49, 50-74, 75-99), so
 * the daily's 45 plays the second row. Columns as documented on DifficultyKnobs.
 */
const LEVEL_ROWS = [
  {
    goal: 4,
    marchEvery: 6,
    spawnEvery: 6,
    hpMin: 3,
    hpMax: 5,
    kinds: {
      normal: 1,
      armoured: 0,
      fast: 0,
    },
  },
  {
    goal: 5,
    marchEvery: 4,
    spawnEvery: 4,
    hpMin: 4,
    hpMax: 7,
    kinds: {
      normal: 3,
      armoured: 0,
      fast: 1,
    },
  },
  {
    goal: 6,
    marchEvery: 4,
    spawnEvery: 3,
    hpMin: 5,
    hpMax: 8,
    kinds: {
      normal: 2,
      armoured: 1,
      fast: 1,
    },
  },
  {
    goal: 7,
    marchEvery: 4,
    spawnEvery: 3,
    hpMin: 6,
    hpMax: 9,
    kinds: {
      normal: 2,
      armoured: 1,
      fast: 1,
    },
  },
] as const satisfies readonly DifficultyKnobs[];

/** The endless run (difficulty 100, ENDLESS_DIFFICULTY): the wave never ends and health rises. */
const ENDLESS_ROW = {
  goal: 0,
  marchEvery: 4,
  spawnEvery: 3,
  hpMin: 4,
  hpMax: 7,
  kinds: MIXED,
} as const satisfies DifficultyKnobs;

export const TUNING = {
  /** The board is boardSize x boardSize cells; every column is a lane (spec: one 8x8 board). */
  boardSize: 8,
  /** Lane rows a monster walks before it breaks the wall (more = calmer). */
  laneRows: 6,
  /** Hearts at the start; each breach costs one (fewer = harder). */
  hearts: 3,
  /** Loose blocks scattered on the opening board (more = a fuller, more lock-prone board). */
  openingBlocks: 6,
  /** Damage of a cleared column's beam to the lowest monster of its lane (spec 13: 8). */
  beamDamage: 8,
  /** Damage of each cleared row's shockwave to every monster but the armoured (spec 13: 2). */
  shockDamage: 2,
  /** Lane rows a fast monster moves per march (a normal one moves 1). */
  fastStep: 2,
  /** Rows the one continue pushes every monster back (spec 8.10; more = kinder). */
  continuePushBack: 3,
  /** Fullest board rows the continue empties after a board-full loss (more = kinder). */
  continueEmptyRows: 2,
  /** Points per cleared line, multiplied by the lines cleared in the same placement (combo). */
  linePoints: 10,
  /** Points per defeated monster. */
  defeatPoints: 25,
  /** Endless: every Nth placement adds 1 to new monsters' health (lower = harder). */
  endlessHpEvery: 12,
  /** Per-difficulty knobs (the tables above). */
  levelRows: LEVEL_ROWS,
  endlessRow: ENDLESS_ROW,
} as const;

/** The knobs of a difficulty 0..100: the endless row at 100, else the level row rowFor picks. */
export function knobsFor(difficulty: number): DifficultyKnobs {
  if (isEndlessDifficulty(difficulty)) return TUNING.endlessRow;
  const row = rowFor(difficulty, TUNING.levelRows.length);
  // A reduce over the non-empty table: no unreachable `?? table[0]` branch for the coverage gate.
  return TUNING.levelRows.reduce((picked, knobs, index) => (index === row ? knobs : picked));
}
