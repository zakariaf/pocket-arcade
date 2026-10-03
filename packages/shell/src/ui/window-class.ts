// packages/shell/src/ui/window-class.ts
export type WindowClass = {
  readonly width: 'compact' | 'regular';
  readonly isLandscape: boolean;
  /** Dynamic Type at "Extra Extra Extra Large" (1.353) or above: stack, don't squeeze. */
  readonly isLargeText: boolean;
};

export const REGULAR_WIDTH_MIN = 600;
export const LARGE_TEXT_SCALE = 1.35;

/** Pure: test it at 320, 402, 744, 874, 1032 and 1376 pt wide (see the size table). */
export function classifyWindow(width: number, height: number, fontScale: number): WindowClass {
  return {
    width: width >= REGULAR_WIDTH_MIN ? 'regular' : 'compact',
    isLandscape: width > height,
    isLargeText: fontScale >= LARGE_TEXT_SCALE,
  };
}
