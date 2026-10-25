// apps/jump-chain/src/levels/jump-chain-describe.test.ts
import { create } from '@e07/jump-chain/rules/create.ts';

import { describeLevel } from './jump-chain-describe.ts';

describe('describeLevel', () => {
  it('shows the counts and the march, the ranks waiting above the board, then the board', () => {
    const start = create(1, 0);
    const enemies = [
      { id: 0, rank: 0, col: 1, row: 5 },
      { id: 1, rank: 1, col: 5, row: -3 },
    ];
    const lines = describeLevel({ ...start, enemies, total: 2, marchIn: 6 }).split('\n');
    expect(lines[0]).toBe('enemies 2 ranks 3 march every 6');
    expect(lines.slice(1, 4)).toStrictEqual(['-3   . . x ', '-2  . . . .', '-1   . . . ']);
    expect(lines[4]).toBe(' 0  . . . .');
    expect(lines[9]).toBe(' 5   x . . ');
    expect(lines[11]).toBe(' 7   . P . ');
    expect(lines).toHaveLength(1 + 3 + 10);
  });

  it('starts at row 0 when no rank waits above the board', () => {
    const lines = describeLevel(create(1, 0)).split('\n');
    expect(lines[1]).toBe(' 0  . . . .');
    expect(lines).toHaveLength(1 + 10);
  });
});
