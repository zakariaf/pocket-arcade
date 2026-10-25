// apps/swap-guard/src/art/logo-art.ts
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

/** Swap Guard: a white shield split down the middle, a pop half and two swap arrows (48 grid). */
export const LOGO_ART: LogoArt = {
  layers: [
    { role: 'w', d: 'M24 5L39 10.5V23.5C39 32.5 32.8 39.4 24 43C15.2 39.4 9 32.5 9 23.5V10.5Z' },
    { role: 'p', d: 'M24 5V43C15.2 39.4 9 32.5 9 23.5V10.5Z' },
    {
      role: 'kl',
      d: 'M15.5 19H31.5M27.5 15L31.5 19L27.5 23M32.5 29.5H16.5M20.5 25.5L16.5 29.5L20.5 33.5',
    },
  ],
};
