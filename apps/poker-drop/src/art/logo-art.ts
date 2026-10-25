// apps/poker-drop/src/art/logo-art.ts
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

/**
 * Poker Drop: two fanned cards under a short drop arrow (48-unit grid), the Toybox logo of
 * design/toybox/tokens.json: the back card in pop, the front one white with an ink spade.
 */
export const LOGO_ART: LogoArt = {
  layers: [
    { role: 'kl', d: 'M24.5 2.8v6.4M21.2 6.3l3.3 3.3 3.3-3.3' },
    {
      role: 'p',
      d: 'M10 14.5H25A3 3 0 0 1 28 17.5V39.5A3 3 0 0 1 25 42.5H10A3 3 0 0 1 7 39.5V17.5A3 3 0 0 1 10 14.5Z',
      rotate: { deg: -11, cx: 17.5, cy: 28.5 },
    },
    {
      role: 'w',
      d: 'M23 14.5H38A3 3 0 0 1 41 17.5V39.5A3 3 0 0 1 38 42.5H23A3 3 0 0 1 20 39.5V17.5A3 3 0 0 1 23 14.5Z',
      rotate: { deg: 9, cx: 30.5, cy: 28.5 },
    },
    {
      role: 'k',
      d: 'M30.5 20.5C27.6 23.9 24.6 25.9 24.6 29.1A3.3 3.3 0 0 0 29.5 32L28.4 36H32.6L31.5 32A3.3 3.3 0 0 0 36.4 29.1C36.4 25.9 33.4 23.9 30.5 20.5Z',
      rotate: { deg: 9, cx: 30.5, cy: 28.5 },
    },
  ],
};
