// apps/trail-clear/src/levels/trail-clear-levels.test.ts
// Spec 8.1: every shipped level proven winnable; spec 8.2 and 8.3: the daily and the endless run.
import { ENDLESS_DIFFICULTY, MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { create } from '@e07/trail-clear/rules/create.ts';
import { listMoves } from '@e07/trail-clear/rules/list-moves.ts';
import { outcome } from '@e07/trail-clear/rules/outcome.ts';

import {
  TRAIL_CLEAR_DAILY_DIFFICULTY,
  TRAIL_CLEAR_DAILY_SALT,
  TRAIL_CLEAR_LEVELS,
} from './trail-clear-levels.ts';
import { WITNESS_MAX_NODES } from './trail-clear-solver.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };

describe('TRAIL_CLEAR_LEVELS', () => {
  it('proves every shipped level winnable by the witness, with packs matching the config', () => {
    const problems = levelsContractProblems({
      levels: TRAIL_CLEAR_LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: WITNESS_MAX_NODES,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs', () => {
    expect(TRAIL_CLEAR_LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it('rates every level by score, where any score wins (Trail Clear is a score game)', () => {
    const rules = TRAIL_CLEAR_LEVELS.table.map((entry) => entry.stars);
    expect(rules.every((rule) => rule.kind === 'score' && rule.thresholds[0] === 0)).toBe(true);
  });

  it('starts the daily challenge at the daily difficulty from the date and its own salt', () => {
    expect(TRAIL_CLEAR_DAILY_SALT).toBe(0xe8ed);
    expect(dailyStart(TRAIL_CLEAR_LEVELS, '2026-10-19')?.difficulty).toBe(
      TRAIL_CLEAR_DAILY_DIFFICULTY,
    );
  });

  it('runs endless at the reserved endless difficulty, which no level uses', () => {
    expect(TRAIL_CLEAR_LEVELS.endless).toStrictEqual({
      kind: 'endless',
      difficulty: ENDLESS_DIFFICULTY,
    });
    const top = Math.max(...TRAIL_CLEAR_LEVELS.table.map((entry) => entry.difficulty));
    expect(top).toBe(MAX_LEVEL_DIFFICULTY);
  });
});
