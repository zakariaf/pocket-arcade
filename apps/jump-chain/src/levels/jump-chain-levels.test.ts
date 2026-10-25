// apps/jump-chain/src/levels/jump-chain-levels.test.ts
// Spec 8.1 and 15.7: every shipped level proven winnable; spec 8.3: the daily from the date and the
// game's own salt at a medium difficulty; spec 8.2: Endless where it fits.
import { ENDLESS_DIFFICULTY, MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { applyMove } from '@e07/jump-chain/rules/apply-move.ts';
import { create } from '@e07/jump-chain/rules/create.ts';
import { listMoves } from '@e07/jump-chain/rules/list-moves.ts';
import { outcome } from '@e07/jump-chain/rules/outcome.ts';

import {
  JUMP_CHAIN_DAILY_DIFFICULTY,
  JUMP_CHAIN_DAILY_SALT,
  JUMP_CHAIN_LEVELS,
} from './jump-chain-levels.ts';
import { WITNESS_MAX_NODES } from './jump-chain-solver.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };

describe('JUMP_CHAIN_LEVELS', () => {
  it('proves every shipped level winnable by the witness, with packs matching the config', () => {
    const problems = levelsContractProblems({
      levels: JUMP_CHAIN_LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: WITNESS_MAX_NODES,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs', () => {
    expect(JUMP_CHAIN_LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it('rates every level by score, where any score wins (Jump Chain is a score game)', () => {
    const rules = JUMP_CHAIN_LEVELS.table.map((entry) => entry.stars);
    expect(rules).toHaveLength(90);
    expect(rules.every((rule) => rule.kind === 'score' && rule.thresholds[0] === 0)).toBe(true);
  });

  it("starts the daily challenge at difficulty 45 with the game's own salt", () => {
    expect(JUMP_CHAIN_DAILY_SALT).toBe(0x748e);
    expect(JUMP_CHAIN_DAILY_DIFFICULTY).toBe(45);
    expect(dailyStart(JUMP_CHAIN_LEVELS, '2026-10-19')?.difficulty).toBe(45);
  });

  it('runs endless at the reserved endless difficulty, which no level uses', () => {
    expect(JUMP_CHAIN_LEVELS.endless).toStrictEqual({
      kind: 'endless',
      difficulty: ENDLESS_DIFFICULTY,
    });
    const top = Math.max(...JUMP_CHAIN_LEVELS.table.map((entry) => entry.difficulty));
    expect(top).toBe(MAX_LEVEL_DIFFICULTY);
  });
});
