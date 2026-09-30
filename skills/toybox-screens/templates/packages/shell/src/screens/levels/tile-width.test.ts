// packages/shell/src/screens/levels/tile-width.test.ts
import { tileWidthFor } from './tile-width.ts';

describe('tileWidthFor', () => {
  it('floors the six columns to the pixel grid, not to whole points (the design draws 53.67)', () => {
    // 402 pt phone at 3x: (402 - 2 x 20 - 5 x 8) / 6 = 53.67 pt; whole points would give 53.
    expect(tileWidthFor(402, 3)).toBeCloseTo(161 / 3, 10);
    expect(tileWidthFor(390, 3)).toBeCloseTo(155 / 3, 10);
    expect(tileWidthFor(402, 2)).toBe(53.5);
  });

  it('keeps six columns inside the 640 pt content width on a tablet', () => {
    expect(tileWidthFor(1024, 2)).toBe(93);
  });
});
