// apps/line-siege/src/rules/apply-move.golden.test.ts
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';

describe('applyMove', () => {
  it('keeps the golden board for seed 7', () => {
    expect(String(applyMove(7))).toMatchSnapshot();
  });
});
