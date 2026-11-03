// packages/game-kit/src/rng/pick.test.ts
import { pick } from './pick';

describe('pick', () => {
  it.each([
    ['a list the seed does not fit (pick wraps around)', 4],
    ['a seed that xit (sic) names', 7],
  ])('picks an item for %s', (_, seed) => {
    expect(pick([1, 2, 3], seed)).toBe(2);
  });

  it('returns "fit (" text and `fdescribe (` in a template unchanged', () => {
    expect(pick(['fit (x)'], 0)).toBe('fit (x)');
  });
});
