// apps/jump-chain/src/levels/jump-chain-shipped.test.ts
import { JUMP_CHAIN_LEVELS } from './jump-chain-levels.ts';
import { isShippedLevel } from './jump-chain-shipped.ts';

describe('isShippedLevel', () => {
  it('knows every level of the packs by its seed and difficulty', () => {
    expect(JUMP_CHAIN_LEVELS.table).toHaveLength(90);
    expect(
      JUMP_CHAIN_LEVELS.table.every((entry) => isShippedLevel(entry.seed, entry.difficulty)),
    ).toBe(true);
  });

  it('knows no other pair: a shipped seed at another difficulty, or the daily', () => {
    const [first] = JUMP_CHAIN_LEVELS.table;
    expect(first === undefined ? true : isShippedLevel(first.seed, first.difficulty + 50)).toBe(
      false,
    );
    expect(isShippedLevel(2, 45)).toBe(false);
  });
});
