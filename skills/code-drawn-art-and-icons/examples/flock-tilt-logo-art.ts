// apps/flock-tilt/src/art/logo-art.ts
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

/** Flock Tilt: a sheep on a tilted meadow line (48-unit grid). */
export const LOGO_ART: LogoArt = {
  layers: [
    { role: 'pl', d: 'M4 42.5 44 35' },
    { role: 'kl', d: 'M16.5 33v6.5M22.5 34v6.5M28.5 34v6.5', rotate: { deg: -10, cx: 24, cy: 27 } },
    {
      role: 'w',
      d: 'M11.5 31a5 5 0 0 1 .5-9.5 6.2 6.2 0 0 1 10.5-4.6 6.2 6.2 0 0 1 10.7 2.4 5.2 5.2 0 0 1 .3 10.2 5.2 5.2 0 0 1-7.2 3.3 6.2 6.2 0 0 1-8.6.2 5 5 0 0 1-6.2-2z',
      rotate: { deg: -10, cx: 24, cy: 27 },
    },
    {
      role: 'k',
      d: 'M31.1 21.5A5.4 6.4 0 1 0 41.9 21.5A5.4 6.4 0 1 0 31.1 21.5Z',
      rotate: { deg: -10, cx: 24, cy: 27 },
    },
    {
      role: 'w0',
      d: 'M36.8 20.2A1.5 1.5 0 1 0 39.8 20.2A1.5 1.5 0 1 0 36.8 20.2Z',
      rotate: { deg: -10, cx: 24, cy: 27 },
    },
  ],
};
