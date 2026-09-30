// apps/__GAME_ID__/src/levels/__GAME_ID__-levels.test.ts
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { applyMove } from '@e07/__GAME_ID__/rules/apply-move.ts';
import { create } from '@e07/__GAME_ID__/rules/create.ts';
import { listMoves } from '@e07/__GAME_ID__/rules/list-moves.ts';
import { outcome } from '@e07/__GAME_ID__/rules/outcome.ts';

import { __GAME_CONST___DAILY_DIFFICULTY, __GAME_CONST___LEVELS } from './__GAME_ID__-levels.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };

describe('__GAME_CONST___LEVELS', () => {
  it('proves every shipped level winnable at its recorded par, with packs matching the config', () => {
    const problems = levelsContractProblems({
      levels: __GAME_CONST___LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: 60_000,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs', () => {
    expect(__GAME_CONST___LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it('rates every level against par (a puzzle game)', () => {
    expect(__GAME_CONST___LEVELS.table.every((entry) => entry.stars.kind === 'par')).toBe(true);
  });

  it('starts the daily challenge at the daily difficulty from the date and salt', () => {
    expect(dailyStart(__GAME_CONST___LEVELS, '2026-09-28')?.difficulty).toBe(__GAME_CONST___DAILY_DIFFICULTY);
  });
});
