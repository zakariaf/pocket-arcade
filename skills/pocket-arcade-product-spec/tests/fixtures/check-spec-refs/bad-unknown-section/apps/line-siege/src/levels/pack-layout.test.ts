// apps/line-siege/src/levels/pack-layout.test.ts
import { packLayout } from './pack-layout.ts';

describe('packLayout', () => {
  it('unlocks pack 2 at 45 stars (spec 8.15)', () => {
    expect(packLayout(45)).toBe(2);
  });
});
