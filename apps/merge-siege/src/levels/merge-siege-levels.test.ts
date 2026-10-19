// apps/merge-siege/src/levels/merge-siege-levels.test.ts
// Spec 8.1 (every shipped level proven winnable), 8.2 (Levels + Daily + Endless), 8.3 (the daily
// from the date and the game's own salt at a medium difficulty) and S8 (packs unlock by stars).
import { ENDLESS_DIFFICULTY, MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { applyMove } from '@e07/merge-siege/rules/apply-move.ts';
import { create } from '@e07/merge-siege/rules/create.ts';
import { listMoves } from '@e07/merge-siege/rules/list-moves.ts';
import { outcome } from '@e07/merge-siege/rules/outcome.ts';

import {
  MERGE_SIEGE_DAILY_DIFFICULTY,
  MERGE_SIEGE_DAILY_SALT,
  MERGE_SIEGE_LEVELS,
} from './merge-siege-levels.ts';
import { WITNESS_MAX_NODES } from './merge-siege-solver.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };

describe('MERGE_SIEGE_LEVELS', () => {
  it('proves every shipped level winnable by the witness, with packs matching the config', () => {
    const problems = levelsContractProblems({
      levels: MERGE_SIEGE_LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: WITNESS_MAX_NODES,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs', () => {
    expect(MERGE_SIEGE_LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it('rates every level by score, where any score wins (Merge Siege is a score game)', () => {
    const rules = MERGE_SIEGE_LEVELS.table.map((entry) => entry.stars);
    expect(rules.every((rule) => rule.kind === 'score' && rule.thresholds[0] === 0)).toBe(true);
  });

  it('keeps the scaffold suggested daily salt 0x7403 and the medium daily difficulty 45', () => {
    expect(MERGE_SIEGE_DAILY_SALT).toBe(0x7403);
    expect(dailyStart(MERGE_SIEGE_LEVELS, '2026-09-28')?.difficulty).toBe(
      MERGE_SIEGE_DAILY_DIFFICULTY,
    );
    expect(MERGE_SIEGE_DAILY_DIFFICULTY).toBe(45);
  });

  it('runs endless at the reserved endless difficulty, which no level uses', () => {
    expect(MERGE_SIEGE_LEVELS.endless).toStrictEqual({
      kind: 'endless',
      difficulty: ENDLESS_DIFFICULTY,
    });
    const top = Math.max(...MERGE_SIEGE_LEVELS.table.map((entry) => entry.difficulty));
    expect(top).toBe(MAX_LEVEL_DIFFICULTY);
  });
});
