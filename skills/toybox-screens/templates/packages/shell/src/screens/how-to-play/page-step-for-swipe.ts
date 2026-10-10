// packages/shell/src/screens/how-to-play/page-step-for-swipe.ts
// Spec S13 and 7.5: the how-to-play pages turn by swipe and mirror in right-to-left. The finger is
// physical (a left swipe is a left swipe in every language); what mirrors is where the next page
// lies: at the reading end, so a left swipe brings it in left to right and a right swipe in right
// to left.
import type { Direction } from '@e07/shell/i18n/languages.ts';

/** The physical way the finger went. */
export type PageSwipe = 'left' | 'right';

/** One page forward (+1) or back (-1). */
export type PageStep = 1 | -1;

export function pageStepForSwipe(swipe: PageSwipe, direction: Direction): PageStep {
  const towardStart = direction === 'ltr' ? 'right' : 'left';
  return swipe === towardStart ? -1 : 1;
}
