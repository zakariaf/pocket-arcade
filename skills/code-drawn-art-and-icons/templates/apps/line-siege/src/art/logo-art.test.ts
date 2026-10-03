// apps/line-siege/src/art/logo-art.test.ts
import { logoOps } from '@e07/shell/art/logo-art.ts';

import { LOGO_ART } from './logo-art.ts';

const PAINTS = { pop: '#FFD23F', toyInk: '#1D1B3A', white: '#FFFFFF' };

describe('LOGO_ART', () => {
  // spec 8.12: each game has its own logo, drawn in code; spec N9: art drawn in code.
  it('draws the pop beam on the tower, the white wall and its ink bricks, in that order', () => {
    const ops = logoOps(LOGO_ART, PAINTS).map((op) => [op.style, op.color, op.cap]);

    expect(ops).toStrictEqual([
      ['fill', '#FFD23F', 'butt'],
      ['stroke', '#1D1B3A', 'butt'],
      ['fill', '#FFFFFF', 'butt'],
      ['stroke', '#1D1B3A', 'butt'],
      ['stroke', '#1D1B3A', 'round'],
    ]);
  });

  it('stands upright: no layer is rotated', () => {
    expect(LOGO_ART.layers.filter((layer) => layer.rotate !== undefined)).toStrictEqual([]);
  });
});
