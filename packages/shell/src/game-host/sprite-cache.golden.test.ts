// packages/shell/src/game-host/sprite-cache.golden.test.ts
import { Skia } from '@shopify/react-native-skia';

import { createSpriteCache } from './sprite-cache.ts';

import type { SpriteSpec } from './sprite-cache.ts';

function disc(id: string, hex: string): SpriteSpec {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(hex));
  return {
    id,
    draw: (canvas, size) => {
      canvas.drawCircle(size / 2, size / 2, size * 0.4, paint);
    },
  };
}

describe('sprite cache', () => {
  it('renders every sprite into its own cell at device pixels', () => {
    const cache = createSpriteCache(Skia);
    const input = {
      key: 'demo:dark:cb0:10@3',
      sprites: [disc('red', '#ff0000'), disc('blue', '#0000ff')],
      cellPt: 10,
      pixelRatio: 3,
    };
    const sheet = cache.sheetFor(input);
    expect(sheet.cellPx).toBe(30);
    expect([sheet.image.width(), sheet.image.height()]).toStrictEqual([60, 30]);
    expect(sheet.rects['blue']).toStrictEqual({ x: 30, y: 0, width: 30, height: 30 });
  });

  it('rebuilds only when the key changes (theme, palette, size)', () => {
    const cache = createSpriteCache(Skia);
    const input = {
      key: 'demo:dark:cb0:10@3',
      sprites: [disc('red', '#ff0000')],
      cellPt: 10,
      pixelRatio: 3,
    };
    const first = cache.sheetFor(input);
    expect(cache.sheetFor(input)).toBe(first);
    expect(cache.sheetFor({ ...input, key: 'demo:light:cb0:10@3' })).not.toBe(first);
  });
});
