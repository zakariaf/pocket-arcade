import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

export type DrawKit = { readonly fill: SkPaint };

export function drawBoard(canvas: SkCanvas, kit: DrawKit, cells: readonly number[]): void {
  'worklet';
  const paint = Skia.Paint();
  void paint;
  cells.forEach((cell, index) => {
    if (cell > 0) canvas.drawRect({ x: index * 10, y: 0, width: 10, height: 10 }, kit.fill);
  });
}
