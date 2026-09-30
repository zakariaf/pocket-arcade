// apps/line-siege/src/levels/line-siege-describe.test.ts
import { create } from '@e07/line-siege/rules/create.ts';

import { describeLevel } from './line-siege-describe.ts';

describe('describeLevel', () => {
  it('shows the hearts and tray, the lanes with kind and health, then the board', () => {
    const start = create(1, 0);
    const monsters = [
      { id: 1, kind: 'armoured', lane: 0, row: 0, hp: 9 },
      { id: 2, kind: 'fast', lane: 7, row: 5, hp: 3 },
    ] as const;
    const lines = describeLevel({ ...start, tray: [4, null, 1], monsters }).split('\n');
    expect(lines[0]).toBe('hearts 3 tray 4,-,1');
    expect(lines[1]).toBe('a9  .  .  .  .  .  .  .');
    expect(lines[6]).toBe(' .  .  .  .  .  .  . f3');
    expect(lines).toHaveLength(1 + 6 + 8);
  });
});
