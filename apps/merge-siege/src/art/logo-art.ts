// apps/merge-siege/src/art/logo-art.ts
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

/**
 * Merge Siege (48-unit grid, the Toybox logo logos.games.mergeSiege): a white spiky enemy with ink
 * eyes, a white tile with two ink up-chevrons smashing into it, and a pop spark where they meet.
 */
export const LOGO_ART: LogoArt = {
  layers: [
    {
      role: 'w',
      d: 'M34.5 2.5L37.1 6.3L41.6 5.1L41.2 9.7L45.3 11.6L42.1 14.8L44 19L39.4 19.4L38.3 23.8L34.5 21.2L30.7 23.8L29.6 19.4L25 19L26.9 14.8L23.7 11.6L27.8 9.7L27.4 5.1L31.9 6.3Z',
    },
    {
      role: 'k',
      d: 'M30 11.2A1.9 1.9 0 1 0 33.8 11.2A1.9 1.9 0 1 0 30 11.2ZM35.6 11.2A1.9 1.9 0 1 0 39.4 11.2A1.9 1.9 0 1 0 35.6 11.2Z',
    },
    {
      role: 'w',
      d: 'M10 18H25A6 6 0 0 1 31 24V39A6 6 0 0 1 25 45H10A6 6 0 0 1 4 39V24A6 6 0 0 1 10 18Z',
    },
    { role: 'kl', d: 'M11 33.5l6.5-6.5 6.5 6.5M11 40.5l6.5-6.5 6.5 6.5' },
    {
      role: 'p',
      d: 'M30.5 12.5L32.5 18.5L38.5 20.5L32.5 22.5L30.5 28.5L28.5 22.5L22.5 20.5L28.5 18.5Z',
    },
  ],
};
