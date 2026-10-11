// packages/shell/src/ui/page-step-for-swipe.test.ts
// Spec S13: "3-5 short illustrated steps drawn in code (from the game module), swipeable,
// mirrored in RTL." Spec 7.5: the swipeable how-to-play pages mirror in right-to-left. The next
// page lies at the reading end: a swipe to the left brings it in left to right, a swipe to the
// right in right to left.
import fc from 'fast-check';

import { pageStepForSwipe } from './page-step-for-swipe.ts';

const SWIPES = ['left', 'right'] as const;

describe('pageStepForSwipe', () => {
  it.each([
    ['left', 'ltr', 1],
    ['right', 'ltr', -1],
    ['left', 'rtl', -1],
    ['right', 'rtl', 1],
  ] as const)(
    'turns a %s swipe in %s into a step of %d (spec S13, 7.5)',
    (swipe, direction, step) => {
      expect(pageStepForSwipe(swipe, direction)).toBe(step);
    },
  );

  it('mirrors every swipe in right to left: the rtl step is minus the ltr step (spec 7.5)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SWIPES), (swipe) => {
        expect(pageStepForSwipe(swipe, 'rtl')).toBe(-pageStepForSwipe(swipe, 'ltr'));
      }),
    );
  });

  it('pins the four steps in one table', () => {
    expect(
      SWIPES.flatMap((swipe) =>
        (['ltr', 'rtl'] as const).map((direction) => pageStepForSwipe(swipe, direction)),
      ),
    ).toStrictEqual([1, -1, -1, 1]);
  });
});
