// packages/shell/src/ui/raised-surface.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { PressFeedbackProvider } from '@e07/shell/app/press-feedback-context.tsx';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { ELEVATION, RADII } from '@e07/shell/theme/tokens.ts';

import { AppText } from './app-text.tsx';
import { RaisedSurface } from './raised-surface.tsx';

describe('RaisedSurface', () => {
  it('is a named button that reports presses', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <RaisedSurface
        label="Replay"
        onPress={onPress}
        testID="result.replay-button"
        elevation={ELEVATION.control}
        radius={RADII.md}
        fill="transparent"
        isReducedMotion={false}
      >
        <AppText text="Replay" variant="label" />
      </RaisedSurface>,
    );

    await user.press(screen.getByRole('button', { name: 'Replay' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('ignores presses when disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <RaisedSurface
        label="Buy"
        onPress={onPress}
        testID="premium.buy-button"
        elevation={ELEVATION.hero}
        radius={RADII.md}
        fill="transparent"
        isReducedMotion
        isDisabled
      >
        <AppText text="Buy" variant="label" />
      </RaisedSurface>,
    );

    const button = screen.getByRole('button', { name: 'Buy' });
    await user.press(button);

    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('reports busy and ignores presses while busy', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <RaisedSurface
        label="Purchasing"
        onPress={onPress}
        testID="premium.buy-button"
        elevation={ELEVATION.hero}
        radius={RADII.md}
        fill="transparent"
        isReducedMotion={false}
        isBusy
      >
        <AppText text="Purchasing" variant="label" />
      </RaisedSurface>,
    );

    const button = screen.getByRole('button', { name: 'Purchasing' });
    await user.press(button);

    expect(button).toBeBusy();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes the selected state of a pushed-in segment', async () => {
    await renderWithShell(
      <RaisedSurface
        label="Dark"
        onPress={jest.fn()}
        testID="settings.theme-segment.dark"
        elevation={ELEVATION.tile}
        radius={RADII.sm}
        fill="transparent"
        isReducedMotion={false}
        accessibilityRole="radio"
        isPushedIn
        isSelected
      >
        <AppText text="Dark" variant="segmentLabel" />
      </RaisedSurface>,
    );

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeSelected();
  });

  it('moves a pushed-in key down by layout, where VoiceOver and Maestro measure it', async () => {
    await renderWithShell(
      <>
        <RaisedSurface
          label="Dark"
          onPress={jest.fn()}
          testID="settings.theme-segment.dark"
          elevation={ELEVATION.tile}
          radius={RADII.sm}
          fill="transparent"
          isReducedMotion={false}
          accessibilityRole="radio"
          isPushedIn
          isSelected
        >
          <AppText text="Dark" variant="segmentLabel" />
        </RaisedSurface>
        <RaisedSurface
          label="Light"
          onPress={jest.fn()}
          testID="settings.theme-segment.light"
          elevation={ELEVATION.tile}
          radius={RADII.sm}
          fill="transparent"
          isReducedMotion={false}
          accessibilityRole="radio"
          isSelected={false}
        >
          <AppText text="Light" variant="segmentLabel" />
        </RaisedSurface>
      </>,
    );

    // The layout frame of the chosen segment sits `elevation` lower (top: 3), like the design's.
    expect(screen.getByTestId('settings.theme-segment.dark')).toHaveStyle({ top: ELEVATION.tile });
    expect(screen.getByTestId('settings.theme-segment.light')).not.toHaveStyle({
      top: ELEVATION.tile,
    });
  });

  it('plays the tap feedback before the action, except on a switch', async () => {
    const calls: string[] = [];
    const user = userEvent.setup();
    await renderWithShell(
      <PressFeedbackProvider onPress={() => calls.push('tap')}>
        <RaisedSurface
          label="Replay"
          onPress={() => calls.push('replay')}
          testID="result.replay-button"
          elevation={ELEVATION.control}
          radius={RADII.md}
          fill="transparent"
          isReducedMotion={false}
        >
          <AppText text="Replay" variant="label" />
        </RaisedSurface>
        <RaisedSurface
          label="Music"
          onPress={() => calls.push('music')}
          testID="pause.music-toggle"
          elevation={ELEVATION.control}
          radius={RADII.md}
          fill="transparent"
          isReducedMotion={false}
          accessibilityRole="switch"
          isChecked={false}
        >
          <AppText text="Music" variant="label" />
        </RaisedSurface>
      </PressFeedbackProvider>,
    );

    await user.press(screen.getByRole('button', { name: 'Replay' }));
    await user.press(screen.getByRole('switch', { name: 'Music' }));

    // The switch's handler plays the toggle feedback itself (playUiFeedback(services, 'toggle')).
    expect(calls).toStrictEqual(['tap', 'replay', 'music']);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
