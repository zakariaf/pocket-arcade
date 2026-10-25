// apps/trail-clear/src/art/logo-art.ts
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

/**
 * Trail Clear: four white tiles in a 2 x 2 square, a pop loop road running through all four (its
 * inner outline runs counter-clockwise, so it stays a hole) and the ink dashes of the road, on the
 * 48-unit grid: the Toybox logo of the design pass (logos.games.trailClear in the token file).
 */
export const LOGO_ART: LogoArt = {
  layers: [
    {
      role: 'w',
      d: 'M8 5H20A3 3 0 0 1 23 8V20A3 3 0 0 1 20 23H8A3 3 0 0 1 5 20V8A3 3 0 0 1 8 5ZM28 5H40A3 3 0 0 1 43 8V20A3 3 0 0 1 40 23H28A3 3 0 0 1 25 20V8A3 3 0 0 1 28 5ZM8 25H20A3 3 0 0 1 23 28V40A3 3 0 0 1 20 43H8A3 3 0 0 1 5 40V28A3 3 0 0 1 8 25ZM28 25H40A3 3 0 0 1 43 28V40A3 3 0 0 1 40 43H28A3 3 0 0 1 25 40V28A3 3 0 0 1 28 25Z',
    },
    {
      role: 'p',
      d: 'M18.5 9.5H29.5A9 9 0 0 1 38.5 18.5V29.5A9 9 0 0 1 29.5 38.5H18.5A9 9 0 0 1 9.5 29.5V18.5A9 9 0 0 1 18.5 9.5ZM19.5 16A3.5 3.5 0 0 0 16 19.5V28.5A3.5 3.5 0 0 0 19.5 32H28.5A3.5 3.5 0 0 0 32 28.5V19.5A3.5 3.5 0 0 0 28.5 16Z',
    },
    {
      role: 'kl',
      d: 'M21.5 12.75h5M35.25 21.5v5M26.5 35.25h-5M12.75 26.5v-5',
    },
  ],
};
