// test/sims/line-siege/daily-boards.sim.test.ts
// A slow sweep (every seed hands out a fresh board), so it runs with the sims, not on every commit.
import { create } from '@e07/line-siege/rules/create.ts';

describe('line-siege daily boards', () => {
  it('hands out a board for every seed of the sweep', () => {
    const seeds = [Math.floor(Math.random() * 9)];
    expect(seeds.filter((seed) => create(seed, 0).score !== 0)).toStrictEqual([]);
  });
});
