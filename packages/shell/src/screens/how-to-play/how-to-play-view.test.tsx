// packages/shell/src/screens/how-to-play/how-to-play-view.test.tsx
import { act, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { HowToPlayView } from './how-to-play-view.tsx';

import type { HowToPlayModel } from './how-to-play-view.tsx';

function modelWith(overrides: Partial<HowToPlayModel> = {}): HowToPlayModel {
  return {
    goal: 'Stop every monster before it reaches your wall.',
    steps: ['Pick a block.', 'Fill a column.', 'Fill a row.', 'Monsters march.'],
    stepIndex: 1,
    renderPicture: () => null,
    pictureAspect: 320 / 206,
    isReducedMotion: false,
    onBack: jest.fn(),
    onPrevious: jest.fn(),
    onNext: jest.fn(),
    onDone: jest.fn(),
    onReplayTutorial: jest.fn(),
    ...overrides,
  };
}

describe('HowToPlayView', () => {
  it('draws every S13 element with its design testID', async () => {
    await renderWithShell(<HowToPlayView model={modelWith()} />);

    for (const testID of [
      'how-to-play.screen',
      'how-to-play.top-bar.title',
      'how-to-play.goal',
      'how-to-play.stage',
      'how-to-play.picture',
      'how-to-play.pager',
      'how-to-play.step-chip',
      'how-to-play.pager-dots',
      'how-to-play.step-text',
      'how-to-play.previous-button',
      'how-to-play.next-button',
      'how-to-play.replay-tutorial-button',
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.getByTestId('how-to-play.step-chip')).toHaveTextContent('Step 2 / 4');
    expect(screen.getByTestId('how-to-play.step-text')).toHaveTextContent('Fill a column.');

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('gives the picture a size: full width at the model aspect, never a 0 pt canvas', async () => {
    await renderWithShell(<HowToPlayView model={modelWith({ pictureAspect: 4 / 3 })} />);

    // allow-style-assertion: without a width and an aspect the example canvas measured 0 and drew nothing.
    expect(
      StyleSheet.flatten(screen.getByTestId('how-to-play.picture').props['style']),
    ).toMatchObject({
      alignSelf: 'stretch',
      aspectRatio: 4 / 3,
    });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('turns Next into "Got it" on the last step and blocks Previous on the first', async () => {
    const model = modelWith({ stepIndex: 3 });
    const user = userEvent.setup();
    const view = await renderWithShell(<HowToPlayView model={model} />);

    await user.press(screen.getByRole('button', { name: 'Got it' }));
    expect(model.onDone).toHaveBeenCalledTimes(1);

    await view.rerender(<HowToPlayView model={modelWith({ stepIndex: 0 })} />);
    expect(screen.getByTestId('how-to-play.previous-button')).toBeDisabled();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});

/** A quick horizontal fling of dx points over the stage (negative: to the left). */
function fling(dx: number): Parameters<typeof fireGestureHandler>[1] {
  const end = { x: 200 + dx, y: 300, translationX: dx, translationY: 0 };
  return [
    { state: State.BEGAN, x: 200, y: 300, translationX: 0, translationY: 0 },
    { state: State.ACTIVE, x: 200 + dx / 2, y: 300, translationX: dx / 2, translationY: 0 },
    { state: State.ACTIVE, ...end },
    { state: State.END, ...end, velocityX: dx * 10, velocityY: 0 },
  ];
}

async function flingOver(dx: number): Promise<void> {
  await act(() => {
    fireGestureHandler(getByGestureTestId('page-swipe'), fling(dx));
  });
}

describe('HowToPlayView paged by swipe (spec S13, 7.5)', () => {
  it.each([
    ['en', -120],
    ['fa', 120],
  ] as const)(
    'shows the next page on a fling toward the reading end in %s (spec S13, 7.5)',
    async (language, dx) => {
      const model = modelWith({ stepIndex: 1 });
      await renderWithShell(<HowToPlayView model={model} />, { language });

      await flingOver(dx);

      expect(model.onNext).toHaveBeenCalledTimes(1);
      expect(model.onPrevious).not.toHaveBeenCalled();
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    },
  );

  it.each([
    ['en', 120],
    ['fa', -120],
  ] as const)(
    'shows the previous page on a fling toward the reading start in %s (spec 7.5)',
    async (language, dx) => {
      const model = modelWith({ stepIndex: 2 });
      await renderWithShell(<HowToPlayView model={model} />, { language });

      await flingOver(dx);

      expect(model.onPrevious).toHaveBeenCalledTimes(1);
      expect(model.onNext).not.toHaveBeenCalled();
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    },
  );

  it('changes nothing on a backward fling on the first page or a forward fling on the last, and only Got it leaves', async () => {
    const first = modelWith({ stepIndex: 0 });
    const view = await renderWithShell(<HowToPlayView model={first} />);
    await flingOver(120);
    for (const handler of [first.onPrevious, first.onNext, first.onDone, first.onBack])
      expect(handler).not.toHaveBeenCalled();

    const last = modelWith({ stepIndex: 3 });
    await view.rerender(<HowToPlayView model={last} />);
    await flingOver(-120);
    for (const handler of [last.onPrevious, last.onNext, last.onDone, last.onBack])
      expect(handler).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Got it' }));
    expect(last.onDone).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
