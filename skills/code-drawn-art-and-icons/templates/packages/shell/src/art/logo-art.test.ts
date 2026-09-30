// packages/shell/src/art/logo-art.test.ts
import { logoOps } from './logo-art.ts';

import type { LogoArt } from './logo-art.ts';

const PAINTS = { pop: '#FFD23F', toyInk: '#1D1B3A', white: '#FFFFFF' };

describe('logoOps', () => {
  it('draws a pop shape as a fill followed by its toy-ink edge', () => {
    const logo: LogoArt = { layers: [{ role: 'p', d: 'M0 0h10v10z' }] };

    expect(logoOps(logo, PAINTS)).toStrictEqual([
      { style: 'fill', color: '#FFD23F', width: 0, cap: 'butt', d: 'M0 0h10v10z' },
      { style: 'stroke', color: '#1D1B3A', width: 2.6, cap: 'butt', d: 'M0 0h10v10z' },
    ]);
  });

  it('gives ink lines round caps and pop lines a 4-unit width', () => {
    const logo: LogoArt = {
      layers: [
        { role: 'kl', d: 'M1 1h5' },
        { role: 'pl', d: 'M2 2h5' },
      ],
    };

    const [inkLine, popLine] = logoOps(logo, PAINTS);
    expect(inkLine).toMatchObject({ style: 'stroke', cap: 'round', width: 2.6, color: '#1D1B3A' });
    expect(popLine).toMatchObject({ style: 'stroke', cap: 'round', width: 4, color: '#FFD23F' });
  });

  it('keeps a layer rotation on every operation of that layer', () => {
    const rotate = { deg: -10, cx: 24, cy: 27 };
    const logo: LogoArt = { layers: [{ role: 'w', d: 'M0 0h4v4z', rotate }] };

    expect(logoOps(logo, PAINTS).map((op) => op.rotate)).toStrictEqual([rotate, rotate]);
  });
});
