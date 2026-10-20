// apps/stepstone/src/levels/stepstone-describe.test.ts
import { pondFromText } from '@e07/stepstone/rules/pond-text.ts';

import { describeLevel } from './stepstone-describe.ts';

describe('describeLevel', () => {
  it('shows par, then the pond row by row with the frog in lower case', () => {
    const rows = ['r.K', '...', 'R.F'];
    const state = {
      ...pondFromText(rows.join('\n')),
      moves: 0,
      par: 2,
      kindsUsed: ['rook'],
    } as const;
    expect(describeLevel(state)).toBe(['par 2', ...rows].join('\n'));
  });
});
