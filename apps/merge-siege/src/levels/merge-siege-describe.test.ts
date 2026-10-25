// apps/merge-siege/src/levels/merge-siege-describe.test.ts
// A level start as readable text for the data goldens (golden-tests: a header line, then the board).
import { create } from '@e07/merge-siege/rules/create.ts';

import { describeLevel } from './merge-siege-describe.ts';

describe('describeLevel', () => {
  it('shows the wave and the next enemy, then the board, top row first', () => {
    const lines = describeLevel(create(1, 0)).split('\n');
    expect(lines[0]).toBe('wave 8 next e4 in column 5');
    expect(lines.slice(1)).toStrictEqual([
      '.   .   .   .   .',
      '.   .   e2  .   .',
      '.   e2  .   .   .',
      '.   .   .   .   .',
      '.   .   2   .   .',
      '.   2   .   .   4',
    ]);
  });

  it('says none once the whole wave has entered', () => {
    expect(describeLevel({ ...create(1, 0), next: null }).split('\n')[0]).toBe('wave 8 next none');
  });

  it('says endless for the endless run', () => {
    expect(describeLevel(create(1, 100)).split('\n')[0]).toMatch(
      /^wave endless next e\d+ in column \d$/,
    );
  });
});
