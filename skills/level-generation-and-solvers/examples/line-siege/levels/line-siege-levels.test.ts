// apps/line-siege/src/levels/line-siege-levels.test.ts
import { ENDLESS_DIFFICULTY, MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { create } from '@e07/line-siege/rules/create.ts';
import { listMoves } from '@e07/line-siege/rules/list-moves.ts';
import { outcome } from '@e07/line-siege/rules/outcome.ts';

import { LINE_SIEGE_DAILY_DIFFICULTY, LINE_SIEGE_LEVELS } from './line-siege-levels.ts';
import { WITNESS_MAX_NODES } from './line-siege-solver.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };

describe('LINE_SIEGE_LEVELS', () => {
  it('proves every shipped level winnable by the witness, with packs matching the config', () => {
    const problems = levelsContractProblems({
      levels: LINE_SIEGE_LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: WITNESS_MAX_NODES,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs', () => {
    expect(LINE_SIEGE_LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it('rates every level by score, where any score wins (Line Siege is a score game)', () => {
    const rules = LINE_SIEGE_LEVELS.table.map((entry) => entry.stars);
    expect(rules.every((rule) => rule.kind === 'score' && rule.thresholds[0] === 0)).toBe(true);
  });

  it('starts the daily challenge at the daily difficulty from the date and salt', () => {
    expect(dailyStart(LINE_SIEGE_LEVELS, '2026-09-28')?.difficulty).toBe(
      LINE_SIEGE_DAILY_DIFFICULTY,
    );
  });

  it('runs endless at the reserved endless difficulty, which no level uses', () => {
    expect(LINE_SIEGE_LEVELS.endless).toStrictEqual({
      kind: 'endless',
      difficulty: ENDLESS_DIFFICULTY,
    });
    const top = Math.max(...LINE_SIEGE_LEVELS.table.map((entry) => entry.difficulty));
    expect(top).toBe(MAX_LEVEL_DIFFICULTY);
  });
});
