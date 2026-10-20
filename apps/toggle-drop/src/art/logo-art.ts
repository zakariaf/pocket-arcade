// apps/toggle-drop/src/art/logo-art.ts
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

/** The lever's tilt: the Toybox logo's rotate(16 24 26), about the pivot. */
const LEVER_TILT = { deg: 16, cx: 24, cy: 26 };

/**
 * Toggle Drop's Toybox logo (48-unit grid): a white switch lever tilted on its ink pivot and post,
 * a lime ball dropping onto its high end (the one pop accent, with a white shine), and an ink arrow
 * showing the flip.
 */
export const LOGO_ART: LogoArt = {
  layers: [
    { role: 'kl', d: 'M24 27V40M16.5 41.5h15' },
    {
      role: 'w',
      d: 'M9 22.5H39A3.5 3.5 0 0 1 39 29.5H9A3.5 3.5 0 0 1 9 22.5Z',
      rotate: LEVER_TILT,
    },
    { role: 'k', d: 'M21 26A3 3 0 1 0 27 26A3 3 0 1 0 21 26Z' },
    { role: 'p', d: 'M8 11A6.5 6.5 0 1 0 21 11A6.5 6.5 0 1 0 8 11Z' },
    { role: 'w0', d: 'M11 9A1.7 1.7 0 1 0 14.4 9A1.7 1.7 0 1 0 11 9Z' },
    { role: 'kl', d: 'M30.5 10.5Q38 10 40.5 16.5M36.3 15.9 40.5 16.5 41.7 12.5' },
  ],
};
