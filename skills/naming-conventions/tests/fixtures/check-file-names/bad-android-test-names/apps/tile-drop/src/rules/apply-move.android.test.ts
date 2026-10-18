// apps/tile-drop/src/rules/apply-move.android.test.ts
import { applyMove } from './apply-move.ts';

describe('applyMove on Android', () => {
  it('adds one', () => {
    expect(applyMove(1)).toBe(2);
  });
});
