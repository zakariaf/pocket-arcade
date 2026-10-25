// apps/poker-drop/src/levels/poker-drop-shipped.test.ts
import { POKER_DROP_LEVELS } from './poker-drop-levels.ts';
import { isShippedLevel } from './poker-drop-shipped.ts';

describe('isShippedLevel', () => {
  // Spec 15.7: every shipped level is proven when its pack is generated.
  it('knows every level of the packs by its seed and difficulty', () => {
    expect(POKER_DROP_LEVELS.table).toHaveLength(90);
    expect(
      POKER_DROP_LEVELS.table.every((entry) => isShippedLevel(entry.seed, entry.difficulty)),
    ).toBe(true);
  });

  it('knows no other pair: a shipped seed at another difficulty, or the daily', () => {
    const [first] = POKER_DROP_LEVELS.table;
    expect(first === undefined ? true : isShippedLevel(first.seed, first.difficulty + 50)).toBe(
      false,
    );
    expect(isShippedLevel(2, 45)).toBe(false);
  });
});
