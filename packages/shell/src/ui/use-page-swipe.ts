// packages/shell/src/ui/use-page-swipe.ts
// The swipe pager: pages turn with a horizontal swipe over what a screen wraps in its
// GestureDetector (S13 How to play: the stage; spec S13 and 7.5). Like every ui/ control it owns
// its gesture, and the gesture stays physical (board-gestures-and-input): the worklet classifies
// the release with the Shell's swipe thresholds and reaches JS only through scheduleOnRN, where
// pageStepForSwipe maps the physical swipe to a page step for the layout direction (the next page
// lies at the reading end). A vertical drag fails the gesture, so the body still scrolls, and a
// pan that ends without success (cancelled, for example when iOS's back edge swipe takes over)
// turns no page.
import { Gesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import { classifySwipe } from '@e07/game-kit/geom/classify-swipe.ts';
import { useDirection } from '@e07/shell/i18n/direction-context.tsx';

import { pageStepForSwipe } from './page-step-for-swipe.ts';

import type { PageStep, PageSwipe } from './page-step-for-swipe.ts';
import type { PanGesture } from 'react-native-gesture-handler';

/** Horizontal travel before the pan takes over; vertical travel that fails it (points). */
const ACTIVE_OFFSET_X: [number, number] = [-12, 12];
const FAIL_OFFSET_Y: [number, number] = [-12, 12];

export function usePageSwipe(onStep: (step: PageStep) => void): PanGesture {
  const direction = useDirection();
  const handleSwipe = (swipe: PageSwipe): void => {
    onStep(pageStepForSwipe(swipe, direction));
  };
  return Gesture.Pan()
    .withTestId('page-swipe')
    .activeOffsetX(ACTIVE_OFFSET_X)
    .failOffsetY(FAIL_OFFSET_Y)
    .onEnd((event, isSuccess) => {
      if (!isSuccess) return;
      const swipe = classifySwipe({
        dx: event.translationX,
        dy: event.translationY,
        vx: event.velocityX,
        vy: event.velocityY,
      });
      if (swipe === 'left' || swipe === 'right') scheduleOnRN(handleSwipe, swipe);
    });
}
