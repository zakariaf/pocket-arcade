// packages/game-kit/src/levels/stars-for-moves.test.ts
// A comment may mention it.skip( or Date.now() without tripping the checker.
import fc from 'fast-check';

import { starsForMoves } from './stars-for-moves.ts';

describe('starsForMoves', () => {
  it('gives 3 stars at par (spec 8.1)', () => {
    expect(starsForMoves(7, 7)).toBe(3);
  });

  it.each([
    [9, 2],
    [10, 1],
  ] as const)('gives %i moves the right stars', (moves, stars) => {
    expect(starsForMoves(moves, 7)).toBe(stars);
  });

  it('can be replayed with the same answer', () => {
    fc.assert(fc.property(fc.nat(), (moves) => starsForMoves(moves, 7) === starsForMoves(moves, 7)));
  });
});
