// apps/trail-clear/src/rules/shipped-levels.test.ts
// Spec 8.1: "The same seed always makes the same level." create() trusts only the shipped packs'
// (seed, difficulty) pairs without a runtime proof, so the lookup must know exactly those pairs.
import pack1 from '@e07/trail-clear/levels/pack-1.json';
import pack2 from '@e07/trail-clear/levels/pack-2.json';
import pack3 from '@e07/trail-clear/levels/pack-3.json';

import { isShippedLevel } from './shipped-levels.ts';

const shipped = [...pack1, ...pack2, ...pack3];

describe('isShippedLevel', () => {
  it('knows every level of the three shipped packs', () => {
    expect(shipped.every((entry) => isShippedLevel(entry.seed, entry.difficulty))).toBe(true);
  });

  it('refuses a shipped seed with another difficulty', () => {
    const first = shipped[0];
    if (first === undefined) throw new Error('no shipped level');
    const otherDifficulty = first.difficulty + 1000;
    expect(isShippedLevel(first.seed, otherDifficulty)).toBe(false);
  });

  it('refuses a seed no pack ships', () => {
    const seeds = new Set(shipped.map((entry) => entry.seed));
    let seed = 1;
    while (seeds.has(seed)) seed += 1;
    expect(isShippedLevel(seed, shipped[0]?.difficulty ?? 1)).toBe(false);
  });
});
