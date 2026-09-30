// packages/game-kit/src/timeline/particles.test.ts
import { sampleParticle } from './particles.ts';

import type { BurstSpec } from './particles.ts';

const BURST: BurstSpec = {
  seed: 42,
  x: 100,
  y: 200,
  count: 12,
  minSpeed: 40,
  maxSpeed: 120,
  gravity: 300,
  lifeMs: 600,
};

describe('sampleParticle', () => {
  it('starts every particle at the burst point, fully opaque', () => {
    expect(sampleParticle(BURST, 3, 0)).toStrictEqual({ x: 100, y: 200, alpha: 1 });
  });

  it('replays identically: the same burst, index and age give the same sample', () => {
    expect(sampleParticle(BURST, 5, 250)).toStrictEqual(sampleParticle(BURST, 5, 250));
  });

  it('fades out over its life and never goes below zero', () => {
    expect(sampleParticle(BURST, 0, 300).alpha).toBeCloseTo(0.5);
    expect(sampleParticle(BURST, 0, 900).alpha).toBe(0);
  });

  it('flies at a speed inside the burst range', () => {
    for (let index = 0; index < BURST.count; index += 1) {
      const { x, y } = sampleParticle({ ...BURST, gravity: 0 }, index, 1000);
      const distance = Math.hypot(x - BURST.x, y - BURST.y);
      expect(distance).toBeGreaterThanOrEqual(BURST.minSpeed - 1e-9);
      expect(distance).toBeLessThanOrEqual(BURST.maxSpeed + 1e-9);
    }
  });
});
