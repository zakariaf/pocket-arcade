// apps/snare-snake/src/levels/snare-snake-levels.test.ts
// Spec 8.1: "Where the game allows it, each level is checked by a solver before it ships";
// spec 15.7 proven here by replaying the witness's line of every shipped level. Spec 8.3: the daily
// level comes from the date plus the game's own salt, at a medium difficulty.
import { MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { applyMove } from '@e07/snare-snake/rules/apply-move.ts';
import { create } from '@e07/snare-snake/rules/create.ts';
import { listMoves } from '@e07/snare-snake/rules/list-moves.ts';
import { outcome } from '@e07/snare-snake/rules/outcome.ts';

import {
  SNARE_SNAKE_DAILY_DIFFICULTY,
  SNARE_SNAKE_DAILY_SALT,
  SNARE_SNAKE_LEVELS,
} from './snare-snake-levels.ts';
import { WITNESS_MAX_NODES } from './snare-snake-solver.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };

describe('SNARE_SNAKE_LEVELS', () => {
  it('proves every shipped level winnable by the witness, with packs matching the config', () => {
    const problems = levelsContractProblems({
      levels: SNARE_SNAKE_LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: WITNESS_MAX_NODES,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs', () => {
    expect(SNARE_SNAKE_LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it('rates every level by score, where any score wins (Snare Snake is a score game)', () => {
    const rules = SNARE_SNAKE_LEVELS.table.map((entry) => entry.stars);
    expect(rules.every((rule) => rule.kind === 'score' && rule.thresholds[0] === 0)).toBe(true);
  });

  it('ships every level only once (no two with the same seed and difficulty)', () => {
    const seeds = SNARE_SNAKE_LEVELS.table.map(
      (entry) => `${String(entry.seed)}:${String(entry.difficulty)}`,
    );
    expect(new Set(seeds).size).toBe(90);
  });

  it('starts the daily challenge at the daily difficulty from the date and its own salt', () => {
    expect(SNARE_SNAKE_DAILY_SALT).toBe(0x36d5);
    expect(dailyStart(SNARE_SNAKE_LEVELS, '2026-09-28')?.difficulty).toBe(
      SNARE_SNAKE_DAILY_DIFFICULTY,
    );
    expect(SNARE_SNAKE_DAILY_DIFFICULTY).toBe(45);
  });

  it('has no endless mode, and its levels climb to the top of the level scale', () => {
    expect(SNARE_SNAKE_LEVELS.endless).toStrictEqual({ kind: 'none' });
    const top = Math.max(...SNARE_SNAKE_LEVELS.table.map((entry) => entry.difficulty));
    expect(top).toBe(MAX_LEVEL_DIFFICULTY);
  });
});
