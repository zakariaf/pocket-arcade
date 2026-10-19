// apps/poker-drop/src/levels/poker-drop-levels.test.ts
import { ENDLESS_DIFFICULTY, MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { applyMove } from '@e07/poker-drop/rules/apply-move.ts';
import { create } from '@e07/poker-drop/rules/create.ts';
import { listMoves } from '@e07/poker-drop/rules/list-moves.ts';
import { outcome } from '@e07/poker-drop/rules/outcome.ts';

import {
  POKER_DROP_DAILY_DIFFICULTY,
  POKER_DROP_DAILY_SALT,
  POKER_DROP_LEVELS,
} from './poker-drop-levels.ts';
import { WITNESS_MAX_NODES } from './poker-drop-solver.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };

describe('POKER_DROP_LEVELS', () => {
  // spec 8.1 and 15.7: every shipped level is proven winnable.
  it('proves every shipped level winnable by the witness, with packs matching the config', () => {
    const problems = levelsContractProblems({
      levels: POKER_DROP_LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: WITNESS_MAX_NODES,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs', () => {
    expect(POKER_DROP_LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it('rates every level by score, where any score wins (Poker Drop is a score game)', () => {
    const rules = POKER_DROP_LEVELS.table.map((entry) => entry.stars);
    expect(rules.every((rule) => rule.kind === 'score' && rule.thresholds[0] === 0)).toBe(true);
  });

  // spec 8.3: "The level number comes from today's local date plus the game's own salt".
  it('plays the daily at a medium difficulty with its own salt, fixed forever', () => {
    expect(POKER_DROP_DAILY_SALT).toBe(0x4ef1);
    expect(dailyStart(POKER_DROP_LEVELS, '2026-09-28')?.difficulty).toBe(
      POKER_DROP_DAILY_DIFFICULTY,
    );
    expect(POKER_DROP_DAILY_DIFFICULTY).toBe(45);
  });

  it('runs endless at the reserved endless difficulty, which no level uses', () => {
    expect(POKER_DROP_LEVELS.endless).toStrictEqual({
      kind: 'endless',
      difficulty: ENDLESS_DIFFICULTY,
    });
    const top = Math.max(...POKER_DROP_LEVELS.table.map((entry) => entry.difficulty));
    expect(top).toBe(MAX_LEVEL_DIFFICULTY);
  });
});
