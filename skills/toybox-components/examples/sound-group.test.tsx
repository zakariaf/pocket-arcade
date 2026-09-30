// packages/shell/src/screens/settings/sound-group.test.tsx
import { fireEvent, screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { SoundGroup } from './sound-group.tsx';

import type { SoundGroupActions, SoundGroupView } from './sound-group.tsx';

const VIEW: SoundGroupView = {
  title: 'Sound and feel',
  soundLabel: 'Sound effects',
  volumeLabel: 'Volume',
  vibrationLabel: 'Vibration',
  isSoundOn: false,
  soundVolume: 0.6,
  isVibrationOn: true,
};

function actions(): SoundGroupActions {
  return {
    onToggleSound: jest.fn(),
    onChangeSoundVolume: jest.fn(),
    onToggleVibration: jest.fn(),
  };
}

describe('SoundGroup', () => {
  it('makes whole rows the switches and keeps every control reachable', async () => {
    const handlers = actions();
    const user = userEvent.setup();
    await renderWithShell(<SoundGroup view={VIEW} actions={handlers} isReducedMotion />);

    expect(screen.getByRole('header', { name: 'Sound and feel' })).toBeOnTheScreen();
    const sound = screen.getByRole('switch', { name: 'Sound effects' });
    expect(sound).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Vibration' })).toBeChecked();
    await user.press(sound);
    expect(handlers.onToggleSound).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('steps the volume by 10 % and greys its fill while the sound is off', async () => {
    const handlers = actions();
    await renderWithShell(<SoundGroup view={VIEW} actions={handlers} isReducedMotion />);

    const slider = screen.getByRole('adjustable', { name: 'Volume' });
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(handlers.onChangeSoundVolume).toHaveBeenCalledWith(0.7);
    // allow-style-assertion: the muted fill is the only cue that the volume applies to nothing yet.
    expect(screen.getByTestId('settings.sound-volume-slider.fill')).toHaveStyle({
      backgroundColor: TEST_PALETTE.standard.light.textMuted,
    });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
