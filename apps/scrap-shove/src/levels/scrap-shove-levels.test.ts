// apps/scrap-shove/src/levels/scrap-shove-levels.test.ts
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { applyMove } from '@e07/scrap-shove/rules/apply-move.ts';
import { create } from '@e07/scrap-shove/rules/create.ts';
import { listMoves } from '@e07/scrap-shove/rules/list-moves.ts';
import { outcome } from '@e07/scrap-shove/rules/outcome.ts';

import {
  SCRAP_SHOVE_DAILY_DIFFICULTY,
  SCRAP_SHOVE_DAILY_SALT,
  SCRAP_SHOVE_LEVELS,
} from './scrap-shove-levels.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };

describe('SCRAP_SHOVE_LEVELS', () => {
  it('proves every shipped level winnable at its recorded par, with packs matching the config (spec 8.1)', () => {
    const problems = levelsContractProblems({
      levels: SCRAP_SHOVE_LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: 60_000,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs (spec S8)', () => {
    expect(SCRAP_SHOVE_LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it('rates every level against par (a puzzle game: 3 stars at or under par)', () => {
    expect(SCRAP_SHOVE_LEVELS.table.every((entry) => entry.stars.kind === 'par')).toBe(true);
  });

  it('ships no two levels with the same seed and difficulty', () => {
    const keys = SCRAP_SHOVE_LEVELS.table.map(
      (entry) => `${String(entry.seed)}/${String(entry.difficulty)}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('starts the daily challenge from the date and its own salt at a medium difficulty (spec 8.3)', () => {
    expect(SCRAP_SHOVE_DAILY_SALT).toBe(0xd628);
    expect(dailyStart(SCRAP_SHOVE_LEVELS, '2026-09-28')?.difficulty).toBe(
      SCRAP_SHOVE_DAILY_DIFFICULTY,
    );
    expect(SCRAP_SHOVE_LEVELS.endless).toStrictEqual({ kind: 'none' });
  });
});
