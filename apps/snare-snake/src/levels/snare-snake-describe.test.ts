// apps/snare-snake/src/levels/snare-snake-describe.test.ts
import { create } from '@e07/snare-snake/rules/create.ts';

import { describeLevel } from './snare-snake-describe.ts';

describe('describeLevel', () => {
  it('shows the moves, the critters and the board size, then the board row by row', () => {
    const start = create(1, 0);
    const snake = [9, 8, 1];
    const critters = [{ id: 0, cell: 55 }];
    const lines = describeLevel({ ...start, snake, critters }).split('\n');
    expect(lines[0]).toBe('moves 30 critters 4 board 7x8');
    expect(lines[1]).toBe('.s.....');
    expect(lines[2]).toBe('.sH....');
    expect(lines[8]).toBe('......c');
    expect(lines).toHaveLength(1 + 8);
  });
});
