// apps/line-siege/src/art/logo-art.ts
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

/** Line Siege: a castle wall under siege, a pop-coloured beam on its tower (48-unit grid). */
export const LOGO_ART: LogoArt = {
  layers: [
    {
      role: 'w',
      d: 'M22 2.5H26A1.5 1.5 0 0 1 27.5 4V16A1.5 1.5 0 0 1 26 17.5H22A1.5 1.5 0 0 1 20.5 16V4A1.5 1.5 0 0 1 22 2.5Z',
    },
    { role: 'w', d: 'M7 42V16h7.5v5.5h4.3V16h10.4v5.5h4.3V16H41v26z' },
    { role: 'kl', d: 'M7 30h34M7 36.3h34M16 30v6.3M32 30v6.3M24 36.3V42M24 21.5V30' },
  ],
};
