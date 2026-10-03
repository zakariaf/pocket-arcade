// packages/shell/src/art/draw-logo.golden.test.ts
// Runs in the 'golden' Jest project (CanvasKit): draws a real logo tile and reads its pixels.
import { Skia } from '@shopify/react-native-skia';

import { drawLogoTile } from './draw-logo.ts';
import { logoOps } from './logo-art.ts';

import type { LogoArt } from './logo-art.ts';

const LOGO: LogoArt = { layers: [{ role: 'k', d: 'M20 20H28V28H20Z' }] };
const OPS = logoOps(LOGO, { pop: '#FFD23F', toyInk: '#1D1B3A', white: '#FFFFFF' });
const SPEC = {
  size: 100,
  fill: '#FF6B4A',
  edge: '#1D1B3A',
  edgeWidth: 4,
  ring: 6,
  ringColor: '#FFFFFF',
  rotateDeg: 0,
};

function pixelAt(pixels: Uint8Array, width: number, [x, y]: readonly [number, number]): number[] {
  const at = (y * width + x) * 4;
  return [...pixels.slice(at, at + 4)];
}

describe('drawLogoTile', () => {
  it('paints ring, edge, accent face and ink art in their places', () => {
    const surface = Skia.Surface.Make(120, 120);
    if (surface === null) throw new Error('No surface');
    drawLogoTile(Skia, surface.getCanvas(), { ops: OPS, spec: SPEC, cx: 60, cy: 60 });
    surface.flush();
    const image = surface.makeImageSnapshot();
    const pixels = image.readPixels() as Uint8Array;

    expect(pixelAt(pixels, 120, [60, 7])).toStrictEqual([255, 255, 255, 255]);
    expect(pixelAt(pixels, 120, [60, 12])).toStrictEqual([29, 27, 58, 255]);
    expect(pixelAt(pixels, 120, [30, 60])).toStrictEqual([255, 107, 74, 255]);
    expect(pixelAt(pixels, 120, [60, 60])).toStrictEqual([29, 27, 58, 255]);
    expect(pixelAt(pixels, 120, [2, 2])[3]).toBe(0);
  });
});
