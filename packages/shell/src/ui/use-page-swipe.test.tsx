// packages/shell/src/ui/use-page-swipe.test.tsx
// Spec S13 and 7.5: How to play pages turn with a swipe, mirrored in right-to-left. The finger
// stays physical (a left swipe is a left swipe in every language); what mirrors is where the next
// page lies. Gesture tests need act(): the Worklets Jest mock delivers scheduleOnRN as a microtask.
import { act, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { GestureDetector, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { usePageSwipe } from './use-page-swipe.ts';

import type { PageStep } from './page-step-for-swipe.ts';
import type { ReactNode } from 'react';

type SwipeProbeProps = { readonly onStep: (step: PageStep) => void };

function SwipeProbe({ onStep }: SwipeProbeProps): ReactNode {
  const gesture = usePageSwipe(onStep);
  return (
    <GestureDetector gesture={gesture}>
      <View testID="how-to-play.stage" />
    </GestureDetector>
  );
}

type GestureEvents = NonNullable<Parameters<typeof fireGestureHandler>[1]>;

/** A quick horizontal fling of dx points (negative: to the left). */
function fling(dx: number): GestureEvents {
  const end = { x: 200 + dx, y: 300, translationX: dx, translationY: 0 };
  return [
    { state: State.BEGAN, x: 200, y: 300, translationX: 0, translationY: 0 },
    { state: State.ACTIVE, x: 200 + dx / 2, y: 300, translationX: dx / 2, translationY: 0 },
    { state: State.ACTIVE, ...end },
    { state: State.END, ...end, velocityX: dx * 10, velocityY: 0 },
  ];
}

/** The same fling, taken over before it ends (the system's back edge swipe cancels the pan). */
function cancelledFling(dx: number): GestureEvents {
  const events = fling(dx);
  const last = events.at(-1);
  return last === undefined
    ? events
    : [...events.slice(0, -1), { ...last, state: State.CANCELLED }];
}

async function swipe(
  language: 'en' | 'fa',
  dx: number,
  events: GestureEvents = fling(dx),
): Promise<jest.Mock> {
  const onStep = jest.fn();
  await renderWithShell(<SwipeProbe onStep={onStep} />, { language });
  expect(screen.getByTestId('how-to-play.stage')).toBeOnTheScreen();
  await act(() => {
    fireGestureHandler(getByGestureTestId('page-swipe'), events);
  });
  expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  return onStep;
}

describe('usePageSwipe', () => {
  it('steps forward on a left fling in English, where the next page lies to the right (spec S13, 7.5)', async () => {
    expect((await swipe('en', -120)).mock.calls).toStrictEqual([[1]]);
  });

  it('steps back on a left fling in Persian, where the next page lies to the left (spec S13, 7.5)', async () => {
    expect((await swipe('fa', -120)).mock.calls).toStrictEqual([[-1]]);
  });

  it('steps back on a right fling in English and forward in Persian (spec 7.5)', async () => {
    expect((await swipe('en', 120)).mock.calls).toStrictEqual([[-1]]);
    expect((await swipe('fa', 120)).mock.calls).toStrictEqual([[1]]);
  });

  it('ignores a drag too short and too slow to be a swipe', async () => {
    expect((await swipe('en', -4)).mock.calls).toStrictEqual([]);
  });

  it('turns no page when the pan is cancelled, even after a full fling (spec S13)', async () => {
    expect((await swipe('en', -120, cancelledFling(-120))).mock.calls).toStrictEqual([]);
  });
});
