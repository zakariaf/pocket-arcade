// packages/shell/src/game-host/sprite-cache.golden.test.ts
import { Skia } from '@shopify/react-native-skia';

import { createSpriteCache } from './sprite-cache.ts';

import type { SkiaApi } from './board-types.ts';
import type { SpriteSpec } from './sprite-cache.ts';
import type { SkSurface } from '@shopify/react-native-skia';

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

/** Skia whose MakeOffscreen hands every surface it makes to `onSurface` first. */
function withSurfaces(onSurface: (surface: SkSurface) => void): SkiaApi {
  const makeOffscreen: SkiaApi['Surface']['MakeOffscreen'] = (width, height) => {
    const surface = Skia.Surface.MakeOffscreen(width, height);
    if (surface !== null) onSurface(surface);
    return surface;
  };
  return { ...Skia, Surface: { ...Skia.Surface, MakeOffscreen: makeOffscreen } };
}

const BROKEN: SpriteSpec = {
  id: 'broken',
  draw: () => {
    throw new Error('draw failed');
  },
};

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

  it('disposes the offscreen surface once the sheet image is made', () => {
    const disposals: jest.SpyInstance[] = [];
    const cache = createSpriteCache(
      withSurfaces((surface) => disposals.push(jest.spyOn(surface, 'dispose'))),
    );
    cache.sheetFor({
      key: 'demo:dark:cb0:10@3',
      sprites: [disc('red', '#ff0000')],
      cellPt: 10,
      pixelRatio: 3,
    });
    expect(disposals.map((dispose) => dispose.mock.calls.length)).toStrictEqual([1]);
  });

  it('keeps the current sheet when a new one fails to build, and disposes it only after a rebuild', () => {
    const disposals: jest.SpyInstance[] = [];
    const cache = createSpriteCache(
      withSurfaces((surface) => disposals.push(jest.spyOn(surface, 'dispose'))),
    );
    const input = {
      key: 'demo:dark:cb0:10@3',
      sprites: [disc('red', '#ff0000')],
      cellPt: 10,
      pixelRatio: 3,
    };
    const first = cache.sheetFor(input);
    const disposeFirst = jest.spyOn(first.image, 'dispose');
    expect(() =>
      cache.sheetFor({ ...input, key: 'demo:light:cb0:10@3', sprites: [BROKEN] }),
    ).toThrow('draw failed');
    expect(disposeFirst).not.toHaveBeenCalled();
    expect(cache.sheetFor(input)).toBe(first);
    expect(disposals.map((dispose) => dispose.mock.calls.length)).toStrictEqual([1, 1]);
    cache.sheetFor({ ...input, key: 'demo:light:cb0:10@3' });
    expect(disposeFirst).toHaveBeenCalledTimes(1);
  });
});
