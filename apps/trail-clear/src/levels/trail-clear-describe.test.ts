// apps/trail-clear/src/levels/trail-clear-describe.test.ts
import { create } from '@e07/trail-clear/rules/create.ts';

import { describeLevel } from './trail-clear-describe.ts';

describe('describeLevel', () => {
  it('shows the offered tile and the bag, then the board row by row', () => {
    const lines = describeLevel(create(1, 0)).split('\n');
    expect(lines[0]).toBe('offered Fd bag 24');
    expect(lines[3]).toBe('... ... We1 ... Re3');
    expect(lines).toHaveLength(1 + 5);
  });

  it('marks an empty bag with a dash', () => {
    expect(describeLevel({ ...create(1, 0), offered: null }).split('\n')[0]).toBe(
      'offered - bag 24',
    );
  });
});
