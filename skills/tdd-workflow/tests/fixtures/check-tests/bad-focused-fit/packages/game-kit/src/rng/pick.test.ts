// packages/game-kit/src/rng/pick.test.ts
import { pick } from './pick';

describe('pick', () => {
  it('picks the item a seed does not fit (wraps around)', () => {
    expect(pick([1, 2, 3], 4)).toBe(2);
  });

  fit ('picks the first item for seed 0', () => {
    expect(pick([1, 2, 3], 0)).toBe(1);
  });
});
