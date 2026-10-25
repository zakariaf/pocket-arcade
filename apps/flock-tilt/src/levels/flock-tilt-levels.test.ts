// apps/flock-tilt/src/levels/flock-tilt-levels.test.ts
import { applyMove } from '@e07/flock-tilt/rules/apply-move.ts';
import { create } from '@e07/flock-tilt/rules/create.ts';
import { listMoves } from '@e07/flock-tilt/rules/list-moves.ts';
import { outcome } from '@e07/flock-tilt/rules/outcome.ts';
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';

import {
  FLOCK_TILT_DAILY_DIFFICULTY,
  FLOCK_TILT_DAILY_SALT,
  FLOCK_TILT_LEVELS,
} from './flock-tilt-levels.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };

describe('FLOCK_TILT_LEVELS (spec 8.1: "each level is checked by a solver before it ships")', () => {
  it('proves every shipped level winnable at its recorded par, with packs matching the config', () => {
    const problems = levelsContractProblems({
      levels: FLOCK_TILT_LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: 60_000,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs (spec S8)', () => {
    expect(FLOCK_TILT_LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it('rates every level against par (a puzzle game) and repeats no field', () => {
    expect(FLOCK_TILT_LEVELS.table.every((entry) => entry.stars.kind === 'par')).toBe(true);
    const seeds = FLOCK_TILT_LEVELS.table.map(
      (entry) => `${String(entry.seed)}/${String(entry.difficulty)}`,
    );
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('starts the daily challenge at difficulty 45 with its own salt, and has no endless run', () => {
    expect(dailyStart(FLOCK_TILT_LEVELS, '2026-09-28')?.difficulty).toBe(
      FLOCK_TILT_DAILY_DIFFICULTY,
    );
    expect(FLOCK_TILT_DAILY_SALT).toBe(0x9c3b);
    expect(FLOCK_TILT_LEVELS.endless).toStrictEqual({ kind: 'none' });
  });
});
