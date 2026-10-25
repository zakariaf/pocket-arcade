// apps/jump-chain/src/art/logo-art.ts
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

/**
 * Jump Chain: your crowned piece leaps over an enemy piece along a pop arc (48-unit grid), the
 * Toybox logo of the design pass (logos.games.jumpChain in the token file).
 */
export const LOGO_ART: LogoArt = {
  layers: [
    { role: 'pl', d: 'M7 38C10 10 38 10 41 38' },
    { role: 'k', d: 'M15 32a9 4.5 0 0 1 18 0v4.5a9 4.5 0 0 1-18 0z' },
    { role: 'w', d: 'M15 13a9 4.5 0 0 1 18 0v4.5a9 4.5 0 0 1-18 0z' },
    { role: 'kl', d: 'M15 13a9 4.5 0 0 0 18 0' },
    { role: 'p', d: 'M18.5 13.5 17.5 7l4 3.2L24 5.5l2.5 4.7 4-3.2-1 6.5z' },
  ],
};
