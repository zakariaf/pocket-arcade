// packages/shell/src/screens/pause/pause-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { PauseView } from './pause-view.tsx';

import type { PauseModel } from './pause-model.ts';

function modelWith(overrides: Partial<PauseModel> = {}): PauseModel {
  return {
    modeText: 'Level 12',
    sound: { isOn: true, onToggle: jest.fn() },
    music: { isOn: false, onToggle: jest.fn() },
    vibration: { isOn: true, onToggle: jest.fn() },
    onRestart: jest.fn(),
    onHowToPlay: jest.fn(),
    isReducedMotion: false,
    ...overrides,
  };
}

describe('PauseView', () => {
  it('draws every S6 element with its design testID', async () => {
    await renderWithShell(
      <PauseView model={modelWith()} onResume={jest.fn()} onHome={jest.fn()} />,
    );

    for (const testID of [
      'pause.scrim',
      'pause.dialog',
      'pause.title',
      'pause.mode-label',
      'pause.resume-button',
      'pause.restart-button',
      'pause.how-to-play-button',
      'pause.toggles',
      'pause.sound-switch',
      'pause.music-switch',
      'pause.vibration-switch',
      'pause.home-button',
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.getByRole('switch', { name: 'Music' })).not.toBeChecked();

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it.each([
    // Chrome's baselines at 3x (useChromeBaseline), not Yoga's. en: Lilita One 30 on a 33 pt line
    // (baseline 27) and Rubik 17 on 67/3 (17.17): design .pz-h 243.5 - 233.5 = 10. fa: Vazirmatn
    // Bold 30 on 131/3 (29.33) and Vazirmatn 17 on 77/3 (16.83): design 239.67 - 226.67 = 13.
    ['en', 9.83],
    ['fa', 12.5],
  ] as const)(
    'puts the mode line on the title baseline where the design does (%s)',
    async (language, drop) => {
      jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
      await renderWithShell(
        <PauseView model={modelWith()} onResume={jest.fn()} onHome={jest.fn()} />,
        { language },
      );

      const title = screen.getByTestId('pause.title', { includeHiddenElements: true }).parent;
      const mode = screen.getByTestId('pause.mode-label', { includeHiddenElements: true }).parent;
      // allow-style-assertion: the header offsets are the contract (parity measures the box).
      expect(title).toHaveStyle({ paddingTop: 0 });
      // allow-style-assertion: the header offsets are the contract (parity measures the box).
      expect(mode).toHaveStyle({ paddingTop: expect.closeTo(drop, 2) as number });
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    },
  );

  it('hides the music key when the game has no music', async () => {
    await renderWithShell(
      <PauseView model={modelWith({ music: null })} onResume={jest.fn()} onHome={jest.fn()} />,
    );

    expect(screen.queryByTestId('pause.music-switch')).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('resumes, toggles sound and leaves through Home', async () => {
    const model = modelWith();
    const onResume = jest.fn();
    const onHome = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(<PauseView model={model} onResume={onResume} onHome={onHome} />);

    await user.press(screen.getByTestId('pause.resume-button'));
    await user.press(screen.getByRole('switch', { name: 'Sound' }));
    await user.press(screen.getByTestId('pause.home-button'));

    expect(onResume).toHaveBeenCalledTimes(1);
    expect(model.sound.onToggle).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
