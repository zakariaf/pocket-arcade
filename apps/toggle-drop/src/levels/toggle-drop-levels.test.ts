// apps/toggle-drop/src/levels/toggle-drop-levels.test.ts
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { create } from '@e07/toggle-drop/rules/create.ts';
import { listMoves } from '@e07/toggle-drop/rules/list-moves.ts';
import { outcome } from '@e07/toggle-drop/rules/outcome.ts';

import { TOGGLE_DROP_DAILY_DIFFICULTY, TOGGLE_DROP_LEVELS } from './toggle-drop-levels.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };

describe('TOGGLE_DROP_LEVELS', () => {
  it('proves every shipped level winnable at its recorded par, with packs matching the config', () => {
    const problems = levelsContractProblems({
      levels: TOGGLE_DROP_LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: 60_000,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs', () => {
    expect(TOGGLE_DROP_LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it('rates every level against par (a puzzle game)', () => {
    expect(TOGGLE_DROP_LEVELS.table.every((entry) => entry.stars.kind === 'par')).toBe(true);
  });

  it('starts the daily challenge at the daily difficulty from the date and salt', () => {
    expect(dailyStart(TOGGLE_DROP_LEVELS, '2026-09-28')?.difficulty).toBe(
      TOGGLE_DROP_DAILY_DIFFICULTY,
    );
  });
});
