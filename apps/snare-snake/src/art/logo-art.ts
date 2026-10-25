// apps/snare-snake/src/art/logo-art.ts
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

/**
 * Snare Snake: a white snake curled into a closed ring, its head overlapping the ring's top end,
 * a pop tongue, and a pop ladybird snared inside the loop (48-unit grid).
 */
export const LOGO_ART: LogoArt = {
  layers: [
    {
      role: 'w',
      d: 'M17 11H27A10 10 0 0 1 37 21V31A10 10 0 0 1 27 41H17A10 10 0 0 1 7 31V21A10 10 0 0 1 17 11ZM18 18A4 4 0 0 0 14 22V30A4 4 0 0 0 18 34H26A4 4 0 0 0 30 30V22A4 4 0 0 0 26 18Z',
    },
    { role: 'pl', d: 'M42.5 16.5 45.5 19' },
    { role: 'w', d: 'M27 12.5A8.5 7.5 0 1 0 44 12.5A8.5 7.5 0 1 0 27 12.5Z' },
    { role: 'k', d: 'M35.3 11.2A2.2 2.2 0 1 0 39.7 11.2A2.2 2.2 0 1 0 35.3 11.2Z' },
    { role: 'w0', d: 'M37.6 10.4A0.8 0.8 0 1 0 39.2 10.4A0.8 0.8 0 1 0 37.6 10.4Z' },
    { role: 'p', d: 'M16.6 26A5.4 5.4 0 1 0 27.4 26A5.4 5.4 0 1 0 16.6 26Z' },
    { role: 'kl', d: 'M7 26h7M30 26h7M22 34v7M20 11v7M22 20.8V31.2' },
    {
      role: 'k',
      d: 'M18.6 24.6A1.3 1.3 0 1 0 21.2 24.6A1.3 1.3 0 1 0 18.6 24.6ZM22.8 28A1.2 1.2 0 1 0 25.2 28A1.2 1.2 0 1 0 22.8 28Z',
    },
  ],
};
