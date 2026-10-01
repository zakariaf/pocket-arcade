// packages/shell/src/screens/how-to-play/how-to-play-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

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
