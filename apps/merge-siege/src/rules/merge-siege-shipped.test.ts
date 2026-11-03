// apps/merge-siege/src/rules/merge-siege-shipped.test.ts
import { MERGE_SIEGE_LEVELS } from '@e07/merge-siege/levels/merge-siege-levels.ts';

import { shippedBoard } from './merge-siege-shipped.ts';

describe('shippedBoard', () => {
  // Spec 8.1 and 15.7: every shipped level was proven when its pack was generated, on the first
  // board of its seed's stream the witness wins (or, when none of them, of the fallback seed's).
  it('names the board try that proved a shipped level: 1, 2 or as late as 16', () => {
    expect(shippedBoard(3_004_672_306, 0)).toStrictEqual({ isFallback: false, tries: 1 });
    expect(shippedBoard(1_819_644_377, 11)).toStrictEqual({ isFallback: false, tries: 2 });
    expect(shippedBoard(1_407_736_902, 95)).toStrictEqual({ isFallback: false, tries: 16 });
  });

  it('names the fallback board for the two shipped levels whose own stream the witness lost', () => {
    expect(shippedBoard(1_095_814_726, 75)).toStrictEqual({ isFallback: true, tries: 1 });
    expect(shippedBoard(2_706_798_124, 85)).toStrictEqual({ isFallback: true, tries: 1 });
  });

  it('knows every level of the packs by its seed and difficulty', () => {
    expect(MERGE_SIEGE_LEVELS.table).toHaveLength(90);
    const boards = MERGE_SIEGE_LEVELS.table.map((entry) =>
      shippedBoard(entry.seed, entry.difficulty),
    );
    expect(boards.filter((board) => board === null)).toStrictEqual([]);
    expect(boards.filter((board) => board?.tries !== 1)).toHaveLength(42);
    expect(boards.filter((board) => board?.isFallback === true)).toHaveLength(2);
  });

  it('knows no other pair: a shipped seed at another difficulty, or the daily', () => {
    expect(shippedBoard(3_004_672_306, 1)).toBeNull();
    expect(shippedBoard(1_407_736_902, 45)).toBeNull();
    expect(shippedBoard(2, 45)).toBeNull();
  });
});
