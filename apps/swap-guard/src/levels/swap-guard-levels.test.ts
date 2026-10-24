// apps/swap-guard/src/levels/swap-guard-levels.test.ts
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { applyMove } from '@e07/swap-guard/rules/apply-move.ts';
import { create } from '@e07/swap-guard/rules/create.ts';
import { listMoves } from '@e07/swap-guard/rules/list-moves.ts';
import { outcome } from '@e07/swap-guard/rules/outcome.ts';

import {
  SWAP_GUARD_DAILY_DIFFICULTY,
  SWAP_GUARD_DAILY_SALT,
  SWAP_GUARD_LEVELS,
} from './swap-guard-levels.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };

describe('SWAP_GUARD_LEVELS', () => {
  it('proves every shipped level winnable at its recorded par, with packs matching the config (spec 8.1, 15.7)', () => {
    const problems = levelsContractProblems({
      levels: SWAP_GUARD_LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: 30_000,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs', () => {
    expect(SWAP_GUARD_LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it('rates every level against par (a puzzle game)', () => {
    expect(SWAP_GUARD_LEVELS.table.every((entry) => entry.stars.kind === 'par')).toBe(true);
  });

  it('ships no two levels with the same board', () => {
    const boards = SWAP_GUARD_LEVELS.table.map((entry) =>
      JSON.stringify(create(entry.seed, entry.difficulty)),
    );
    expect(new Set(boards).size).toBe(boards.length);
  });

  it('has no endless mode (game.config.ts modes.endless is false)', () => {
    expect(SWAP_GUARD_LEVELS.endless).toStrictEqual({ kind: 'none' });
  });

  it('starts the daily challenge at difficulty 45 with its own salt (spec 8.3)', () => {
    expect([SWAP_GUARD_DAILY_DIFFICULTY, SWAP_GUARD_DAILY_SALT]).toStrictEqual([45, 0x8790]);
    expect(dailyStart(SWAP_GUARD_LEVELS, '2026-09-28')?.difficulty).toBe(45);
  });
});
