// apps/flock-tilt/src/levels/flock-tilt-describe.test.ts
import { parseField } from '@e07/flock-tilt/rules/field-text.ts';

import { describeLevel } from './flock-tilt-describe.ts';

describe('describeLevel', () => {
  it('shows par and the flock, then the field row by row', () => {
    const state = {
      ...parseField(['s.#', '.so', 'w..']),
      tilts: 0,
      tiltLimit: 40,
      par: 3,
      hasContinued: false,
      beforeLoss: null,
    };
    expect(describeLevel(state)).toBe(['par 3 sheep 2 wolves 1', 's.#', '.so', 'w..'].join('\n'));
  });
});
