// apps/stepstone/src/art/logo-art.ts
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

/**
 * Stepstone: a white frog with ink eyes and smile, sitting on a lotus-pink lily pad (48-unit grid;
 * the Toybox logo, layer for layer).
 */
export const LOGO_ART: LogoArt = {
  layers: [
    { role: 'p', d: 'M4.5 39.5A19.5 5 0 1 0 43.5 39.5A19.5 5 0 1 0 4.5 39.5Z' },
    {
      role: 'w',
      d: 'M9 38C9 28 15.5 23 24 23S39 28 39 38C39 40 37.5 41 35.5 41H12.5C10.5 41 9 40 9 38Z',
    },
    { role: 'w', d: 'M11 18.5A5.5 5.5 0 1 0 22 18.5A5.5 5.5 0 1 0 11 18.5Z' },
    { role: 'w', d: 'M26 18.5A5.5 5.5 0 1 0 37 18.5A5.5 5.5 0 1 0 26 18.5Z' },
    { role: 'k', d: 'M14.8 18.5A2.4 2.4 0 1 0 19.6 18.5A2.4 2.4 0 1 0 14.8 18.5Z' },
    { role: 'k', d: 'M29.8 18.5A2.4 2.4 0 1 0 34.6 18.5A2.4 2.4 0 1 0 29.8 18.5Z' },
    { role: 'kl', d: 'M16.5 30Q24 35 31.5 30M14.5 41V37.5M33.5 41V37.5' },
  ],
};
