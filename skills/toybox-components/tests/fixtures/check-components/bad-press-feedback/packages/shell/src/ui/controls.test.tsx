// packages/shell/src/ui/controls.test.tsx
import { fireEvent, screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { OptionCard } from './option-card.tsx';
import { ProgressBar } from './progress-bar.tsx';
import { SegmentedControl } from './segmented-control.tsx';
import { Slider } from './slider.tsx';
import { ToggleKey } from './toggle-key.tsx';
import { Toggle } from './toggle.tsx';

const COLORS = TEST_PALETTE.standard.light;
const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

describe('SegmentedControl', () => {
  it('exposes a radio group with exactly one selected segment', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <SegmentedControl
        segments={THEMES}
        selected="system"
        onSelect={onSelect}
        label="Theme"
        testID="settings.theme-control"
        segmentTestIDBase="settings.theme-segment"
        isReducedMotion={false}
      />,
    );

    expect(screen.getByRole('radio', { name: 'System' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Dark' })).not.toBeSelected();
    await user.press(screen.getByRole('radio', { name: 'Dark' }));
    expect(onSelect).toHaveBeenCalledWith('dark');
    expect(screen.getByTestId('settings.theme-segment.system.label')).toHaveStyle({
      color: COLORS.onPrimary,
    });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});

describe('ToggleKey', () => {
  it('is a switch that reports its checked state and names its parts', async () => {
    const onToggle = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <ToggleKey
        icon="sound"
        label="Sound"
        stateLabel="On"
        isOn
        onToggle={onToggle}
        testID="pause.sound-switch"
        isReducedMotion={false}
      />,
    );

    const key = screen.getByRole('switch', { name: 'Sound' });
    expect(key).toBeChecked();
    await user.press(key);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('pause.sound-switch.state')).toHaveTextContent('On');
  });
});

describe('Toggle', () => {
  it('stays hidden from VoiceOver because the row is the switch', async () => {
    await renderWithShell(
      <Toggle isOn={false} isReducedMotion testID="settings.music-switch.toggle" />,
    );

    expect(
      screen.getByTestId('settings.music-switch.toggle', { includeHiddenElements: true }),
    ).toHaveStyle({
      backgroundColor: COLORS.sunken,
    });
    expect(screen.queryByTestId('settings.music-switch.toggle')).not.toBeOnTheScreen();
  });
});

describe('OptionCard', () => {
  it('is a radio in its own script that shows a check when chosen', async () => {
    await renderWithShell(
      <OptionCard
        label="فارسی"
        language="fa"
        isSelected
        onSelect={jest.fn()}
        testID="language-choice.language-row.fa"
        isReducedMotion={false}
      />,
    );

    expect(screen.getByRole('radio', { name: 'فارسی' })).toBeSelected();
    expect(screen.getByTestId('language-choice.language-row.fa.label')).toHaveStyle({
      fontFamily: 'Vazirmatn-Bold',
    });
  });
});

describe('ProgressBar and Slider', () => {
  it('reports progress as a percentage', async () => {
    await renderWithShell(
      <ProgressBar value={0.31} label="28 of 90 stars" testID="levels.pack.1.progress-bar" />,
    );

    expect(screen.getByRole('progressbar', { name: '28 of 90 stars' })).toHaveAccessibilityValue({
      now: 31,
    });
  });

  it('moves the volume by 10 % with VoiceOver adjust actions', async () => {
    const onChange = jest.fn();
    await renderWithShell(
      <Slider
        value={0.7}
        onChange={onChange}
        label="Volume"
        testID="settings.sound-volume-slider"
      />,
    );

    const slider = screen.getByRole('adjustable', { name: 'Volume' });
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });

    expect(onChange.mock.calls).toStrictEqual([[0.8], [0.6]]);
  });
});
