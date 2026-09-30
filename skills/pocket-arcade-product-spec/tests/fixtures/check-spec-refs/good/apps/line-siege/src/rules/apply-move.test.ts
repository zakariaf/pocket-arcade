// apps/line-siege/src/rules/apply-move.test.ts
// Spec 13 (Line Siege) and 8.13: a full column clears; see also spec S5, N10 and 8.1-8.14.
import { applyMove } from './apply-move.ts';

const CARD_CODES = ['S16', 'D12', 'N40']; // card codes in code are data, not spec citations

describe('applyMove', () => {
  it('clears the column (spec 8.1, spec section 10)', () => {
    expect(applyMove(CARD_CODES.length)).toBe(3);
  });
});
