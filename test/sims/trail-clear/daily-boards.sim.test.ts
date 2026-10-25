// test/sims/trail-clear/daily-boards.sim.test.ts
// Spec 8.1 ("no level is impossible") and 8.3 (the daily is a level from the date's seed): every
// daily board create() hands out for two years of dates is one the witness wins. A sweep of 731
// witness proofs, so it runs with the sims (npm run test:sim), not on every commit.
import { dailySeed } from '@e07/game-kit/dates/daily-seed.ts';
import { addDays } from '@e07/game-kit/dates/date-key.ts';
import {
  TRAIL_CLEAR_DAILY_DIFFICULTY,
  TRAIL_CLEAR_DAILY_SALT,
} from '@e07/trail-clear/levels/trail-clear-levels.ts';
import {
  TRAIL_CLEAR_SOLVER,
  WITNESS_MAX_NODES,
} from '@e07/trail-clear/levels/trail-clear-solver.ts';
import { create, createWithin, drawStart } from '@e07/trail-clear/rules/create.ts';
import { TUNING } from '@e07/trail-clear/rules/trail-clear-tuning.ts';
import { TRAIL_CLEAR_WITNESS } from '@e07/trail-clear/rules/trail-clear-witness.ts';

const DATES = Array.from({ length: 731 }, (_, day) => addDays('2026-09-28', day));
const seedOf = (date: string): number => dailySeed(date, TRAIL_CLEAR_DAILY_SALT);
const isProven = (date: string, make: typeof create): boolean =>
  TRAIL_CLEAR_SOLVER.solve(make(seedOf(date), TRAIL_CLEAR_DAILY_DIFFICULTY), WITNESS_MAX_NODES)
    .kind === 'solved';

describe('trail-clear daily boards', () => {
  it('hands out a board the witness wins on every date of two years', () => {
    expect(DATES.filter((date) => !isProven(date, create))).toStrictEqual([]);
  });

  it('spends at most createAttempts witness games on each date, none when a run asks again, and is deterministic', () => {
    const budget = { attempts: TUNING.createAttempts, maxNodes: WITNESS_MAX_NODES };
    const overBudget = DATES.filter((date) => {
      const seed = seedOf(date);
      const solve = jest.spyOn(TRAIL_CLEAR_WITNESS, 'solve');
      const first = create(seed, TRAIL_CLEAR_DAILY_DIFFICULTY);
      const firstRuns = solve.mock.calls.length;
      const again = create(seed, TRAIL_CLEAR_DAILY_DIFFICULTY);
      const repeatRuns = solve.mock.calls.length - firstRuns;
      solve.mockRestore();
      const fresh = createWithin(seed, TRAIL_CLEAR_DAILY_DIFFICULTY, budget);
      const isSame = again === first && JSON.stringify(fresh) === JSON.stringify(first);
      return firstRuns > TUNING.createAttempts || repeatRuns > 0 || !isSame;
    });
    expect(overBudget).toStrictEqual([]);
  });

  it('finds first boards among those dates that the witness loses (so the proof is needed)', () => {
    expect(DATES.slice(0, 60).some((date) => !isProven(date, drawStart))).toBe(true);
  });
});
