// apps/tile-drop/src/rules/apply-move.test.ts
import { applyMove } from './apply-move.ts';

describe('applyMove', () => {
  it('adds one', () => {
    expect(applyMove(1)).toBe(2);
  });
});
