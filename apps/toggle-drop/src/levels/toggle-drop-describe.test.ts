// apps/toggle-drop/src/levels/toggle-drop-describe.test.ts
import { describeLevel } from './toggle-drop-describe.ts';

describe('describeLevel', () => {
  it('shows the balls, then the switch rows, then the cups with what each needs', () => {
    const state = {
      cols: 3,
      rows: 2,
      pegs: [-1, 1, -1, 0, -1, 0],
      flips: [0, 0, 0, 0, 0, 0],
      needs: [1, 2, 0],
      filled: [0, 0, 0],
      ballsLeft: 4,
      drops: 0,
    } as const;
    expect(describeLevel(state)).toBe(['balls 4', '.>.', '<.<', '12_'].join('\n'));
  });
});
