// apps/scrap-shove/src/art/logo-art.ts
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

/** Scrap Shove: a clumsy robot head with pop bolts (48-unit grid). */
export const LOGO_ART: LogoArt = {
  layers: [
    { role: 'kl', d: 'M24 12.5V7.5M9.5 24H5.8M38.5 24h3.7' },
    { role: 'p', d: 'M20.7 6.2A3.3 3.3 0 1 0 27.3 6.2A3.3 3.3 0 1 0 20.7 6.2Z' },
    {
      role: 'p',
      d: 'M17 35H31A2 2 0 0 1 33 37V40.5A2 2 0 0 1 31 42.5H17A2 2 0 0 1 15 40.5V37A2 2 0 0 1 17 35Z',
    },
    {
      role: 'w',
      d: 'M15 12.5H33A5.5 5.5 0 0 1 38.5 18V30A5.5 5.5 0 0 1 33 35.5H15A5.5 5.5 0 0 1 9.5 30V18A5.5 5.5 0 0 1 15 12.5Z',
    },
    { role: 'k', d: 'M15 22.5A3.5 3.5 0 1 0 22 22.5A3.5 3.5 0 1 0 15 22.5Z' },
    { role: 'kl', d: 'M26.5 19.5l6 6M32.5 19.5l-6 6M18 30.2h12' },
  ],
};
