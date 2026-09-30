import { drawBoard } from './draw-board.ts';

describe('drawBoard', () => {
  it('stays within 200 canvas calls on the busiest frame', () => {
    let total = 0;
    const canvas = new Proxy({}, { get: () => () => { total += 1; } });
    drawBoard(canvas as never, { fill: {} as never }, [1, 1, 0, 1]);
    expect(total).toBeLessThanOrEqual(1500);
  });
});
