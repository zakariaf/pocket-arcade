// packages/game-kit/src/rng/pick-at.test.ts
import { pickAt } from './pick-at.ts';

describe('pickAt', () => {
  it('returns the item at the index', () => {
    expect(pickAt(['a', 'b'], 1)).toBe('b');
  });

  it('throws a RangeError outside the list', () => {
    expect(() => pickAt(['a'], 1)).toThrow('index 1 outside 0..0');
  });
});
