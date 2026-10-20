// apps/stepstone/src/levels/stepstone-levels.test.ts
// Spec 8.1: every shipped level is generated from a seed and a difficulty, checked by the solver
// at its par, and stars follow par. Spec 8.3: one daily level per date, from the game's own salt.
import { dailyStart } from '@e07/game-kit/levels/daily-start.ts';
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { applyMove } from '@e07/stepstone/rules/apply-move.ts';
import { create } from '@e07/stepstone/rules/create.ts';
import { listMoves } from '@e07/stepstone/rules/list-moves.ts';
import { outcome } from '@e07/stepstone/rules/outcome.ts';
import { pondText } from '@e07/stepstone/rules/pond-text.ts';
import { knobsFor } from '@e07/stepstone/rules/stepstone-tuning.ts';

import { MAX_RANDOM_CROSSINGS, minParFor, randomCrossings } from './stepstone-level-plan.ts';
import {
  STEPSTONE_DAILY_DIFFICULTY,
  STEPSTONE_DAILY_SALT,
  STEPSTONE_LEVELS,
} from './stepstone-levels.ts';

/** game.config.ts `levels` for this app; the packs must match it exactly. */
const CONFIG = { packCount: 3, levelsPerPack: 30 };
const TABLE = STEPSTONE_LEVELS.table;

describe('STEPSTONE_LEVELS', () => {
  it('proves every shipped level winnable at its recorded par, with packs matching the config', () => {
    const problems = levelsContractProblems({
      levels: STEPSTONE_LEVELS,
      engine: { create, listMoves, applyMove, outcome },
      config: CONFIG,
      maxNodes: 2_000,
    });
    expect(problems).toStrictEqual([]);
  });

  it('opens pack 1 at once and asks 45 then 90 stars for the next packs', () => {
    expect(STEPSTONE_LEVELS.packs.map((pack) => pack.starsToUnlock)).toStrictEqual([0, 45, 90]);
  });

  it("keeps every par inside its row's band: at least its fewest hops, at most the laid route", () => {
    TABLE.forEach((entry) => {
      if (entry.stars.kind !== 'par')
        throw new Error(`level ${String(entry.level)} is not par-rated`);
      expect(entry.stars.par).toBeGreaterThanOrEqual(minParFor(entry.level));
      expect(entry.stars.par).toBeLessThanOrEqual(knobsFor(entry.difficulty).routeHops);
      expect(create(entry.seed, entry.difficulty).par).toBe(entry.stars.par);
    });
  });

  it('ships no level that random tapping crosses too often (naive play should lose)', () => {
    const crossings = TABLE.map((entry) => randomCrossings(create(entry.seed, entry.difficulty)));
    expect(crossings.filter((count) => count > MAX_RANDOM_CROSSINGS)).toStrictEqual([]);
  });

  it('ships no two levels with the same pond', () => {
    const ponds = new Set(TABLE.map((entry) => pondText(create(entry.seed, entry.difficulty))));
    expect(ponds.size).toBe(TABLE.length);
  });

  it('starts the daily challenge at the daily difficulty from the date and the salt 0x0eb2', () => {
    expect(STEPSTONE_DAILY_SALT).toBe(0x0eb2);
    expect(dailyStart(STEPSTONE_LEVELS, '2026-09-28')?.difficulty).toBe(STEPSTONE_DAILY_DIFFICULTY);
    expect(STEPSTONE_LEVELS.endless).toStrictEqual({ kind: 'none' });
  });
});
