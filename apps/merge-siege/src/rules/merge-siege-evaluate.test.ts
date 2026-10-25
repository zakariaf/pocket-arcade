// apps/merge-siege/src/rules/merge-siege-evaluate.test.ts
// How a reasonable player values a Merge Siege position (game-balance-and-bots: the greedy bot and
// the level witness play with it): points first, then enemies kept far from the bottom row and
// guarded by a bigger tile below them, room on the board and a big tile to swing.
import { parseBoard } from './board-text.ts';
import { create } from './create.ts';
import { evaluateMergeSiege } from './merge-siege-evaluate.ts';

import type { MergeSiegeState } from './merge-siege-types.ts';

const EMPTY_ROW = '. . . . .';

function stateWith(
  rows: readonly string[],
  overrides: Partial<MergeSiegeState> = {},
): MergeSiegeState {
  return { ...create(1, 0), cells: parseBoard(rows), ...overrides };
}

describe('evaluateMergeSiege', () => {
  it('prefers more points: an enemy smashed is worth more than one still standing', () => {
    const standing = stateWith([
      'e4 . . . .',
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
      '4 . . . .',
    ]);
    const smashed = stateWith(
      [EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '4 . . . .'],
      { score: 40 },
    );
    expect(evaluateMergeSiege(smashed)).toBeGreaterThan(evaluateMergeSiege(standing));
  });

  it('dislikes an enemy closer to the bottom row', () => {
    const far = stateWith(['e4 . . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '. . 2 . .']);
    const near = stateWith([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, 'e4 . . . .', EMPTY_ROW, '. . 2 . .']);
    expect(evaluateMergeSiege(far)).toBeGreaterThan(evaluateMergeSiege(near));
  });

  it('likes an enemy guarded by a tile below it that beats it', () => {
    const guarded = stateWith([
      'e4 . . . .',
      EMPTY_ROW,
      '8 . . . .',
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
    ]);
    const open = stateWith(['e4 . . . .', EMPTY_ROW, '. . 8 . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]);
    expect(evaluateMergeSiege(guarded)).toBeGreaterThan(evaluateMergeSiege(open));
  });

  it('prefers free cells and one big tile over many small ones of the same total', () => {
    const merged = stateWith([
      'e2 . . . .',
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
      '8 . . . .',
    ]);
    const loose = stateWith([
      'e2 . . . .',
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
      '2 2 2 2 .',
    ]);
    expect(evaluateMergeSiege(merged)).toBeGreaterThan(evaluateMergeSiege(loose));
  });

  it('keeps the pinned value of the seed 1 opening', () => {
    expect(evaluateMergeSiege(create(1, 0))).toBe(GOLDEN_SEED_1_VALUE);
  });
});

const GOLDEN_SEED_1_VALUE = 104;
