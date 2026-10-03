// packages/shell/src/ui/window-class.test.ts
import { classifyWindow } from './window-class.ts';

describe('classifyWindow', () => {
  it.each([
    { width: 320, height: 568, widthClass: 'compact', isLandscape: false },
    { width: 402, height: 874, widthClass: 'compact', isLandscape: false },
    { width: 874, height: 402, widthClass: 'regular', isLandscape: true },
    { width: 744, height: 1133, widthClass: 'regular', isLandscape: false },
    { width: 1376, height: 1032, widthClass: 'regular', isLandscape: true },
  ] as const)('classifies $width x $height pt', ({ width, height, widthClass, isLandscape }) => {
    expect(classifyWindow(width, height, 1)).toMatchObject({ width: widthClass, isLandscape });
  });

  it('flags large text from Dynamic Type xxxLarge (1.353) upwards', () => {
    expect(classifyWindow(402, 874, 1.353).isLargeText).toBe(true);
    expect(classifyWindow(402, 874, 1.235).isLargeText).toBe(false);
  });
});
