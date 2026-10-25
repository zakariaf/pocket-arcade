// apps/merge-siege/src/board/board-ids.test.ts
// The ids and lookups that the timeline (JS thread) and draw (UI thread) share.
import { create } from '@e07/merge-siege/rules/create.ts';

import { digitIndex, digitsOf, NEXT_ENTITY } from './board-ids.ts';

const VIEW = { digits: ['1', '2', '4', '8', '16'] };

describe('board ids', () => {
  it('keeps the next enemy apart from every piece id', () => {
    const ids = create(1, 0).cells.flatMap((cell) => (cell === null ? [] : [cell.id]));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain(NEXT_ENTITY);
  });

  it('finds each power of two in the digit table', () => {
    expect([1, 2, 4, 8, 1024].map(digitIndex)).toStrictEqual([0, 1, 2, 3, 10]);
    expect(digitsOf(VIEW, 8)).toBe('8');
  });

  it('shows no number for a value past the table, never a wrong one', () => {
    expect(digitsOf(VIEW, 64)).toBe('');
  });
});
