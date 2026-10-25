// apps/scrap-shove/src/levels/scrap-shove-describe.test.ts
import { stateFromText } from '@e07/scrap-shove/rules/board-text.ts';

import { describeLevel } from './scrap-shove-describe.ts';

describe('describeLevel', () => {
  it('writes the robots by kind, the heaps and the floor as text', () => {
    const floor = ['n..#', '.@..', '..*.', 'f..h'];
    expect(describeLevel(stateFromText(floor))).toBe(
      ['robots 1 normal, 1 fast, 1 heavy; heaps 2', ...floor].join('\n'),
    );
  });
});
