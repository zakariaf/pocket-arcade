// packages/shell/src/ui/controls.test.tsx
import { act, fireEvent, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { OptionCard } from './option-card.tsx';
import { ProgressBar } from './progress-bar.tsx';
import { SegmentedControl } from './segmented-control.tsx';
import { Slider } from './slider.tsx';
import { ToggleKey } from './toggle-key.tsx';
import { Toggle } from './toggle.tsx';

import type { ViewStyle } from 'react-native';

const COLORS = TEST_PALETTE.standard.light;

type HostNode = { readonly props: { readonly style?: unknown }; readonly parent: HostNode | null };

/** The flattened style of the nearest ancestor of a part whose style passes `isWanted`. */
function ancestorStyle(testID: string, isWanted: (style: ViewStyle) => boolean): ViewStyle {
  let node: HostNode | null = (screen.getByTestId(testID) as unknown as HostNode).parent;
  while (node !== null) {
    const style = StyleSheet.flatten(node.props.style as ViewStyle | undefined) ?? {};
    if (isWanted(style)) return style;
    node = node.parent;
  }
  return {};
}
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

  it('keeps the mockup gaps: check to label 3 pt, label line to preview line 1 pt', async () => {
    await renderWithShell(
      <SegmentedControl
        segments={[
          { value: 'latin', label: 'Latin', preview: '123' },
          { value: 'persian', label: 'Persian', preview: '۱۲۳', previewLanguage: 'fa' },
        ]}
        selected="latin"
        onSelect={jest.fn()}
        label="Numbers"
        testID="settings.numbers-control"
        segmentTestIDBase="settings.numbers-segment"
        isReducedMotion={false}
        isInRow
      />,
    );

    const label = 'settings.numbers-segment.latin.label';
    expect(ancestorStyle(label, (style) => style.flexDirection === 'row')).toMatchObject({
      columnGap: 3,
    });
    expect(ancestorStyle(label, (style) => style.minHeight !== undefined)).toMatchObject({
      gap: 1,
      minHeight: 48,
    });
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

  it('keeps its content height inside the Pause row cell (no zero flex basis, spec S6)', async () => {
    // Pause wraps each key in a column cell; a key with flex: 1 (basis 0) there measured 0 pt on
    // the device, so the row collapsed and the keys covered the Home button below them.
    await renderWithShell(
      <ToggleKey
        icon="sound"
        label="Sound"
        stateLabel="On"
        isOn={false}
        onToggle={jest.fn()}
        testID="pause.sound-switch"
        isReducedMotion
      />,
    );
    const key: ViewStyle =
      StyleSheet.flatten(
        screen.getByTestId('pause.sound-switch').props['style'] as ViewStyle | undefined,
      ) ?? {};
    expect(key).toMatchObject({ flexGrow: 1 });
    expect(key.flexBasis ?? 'auto').toBe('auto');
    expect(key.flex).toBeUndefined();
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

  it('follows a sideways drag across its width', async () => {
    const onChange = jest.fn();
    await renderWithShell(
      <Slider
        value={0.5}
        onChange={onChange}
        label="Volume"
        testID="settings.sound-volume-slider"
        gestureTestID="volume"
      />,
    );
    await fireEvent(screen.getByRole('adjustable', { name: 'Volume' }), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 44 } },
    });

    await act(() => {
      fireGestureHandler(getByGestureTestId('volume.pan'), [
        { state: State.BEGAN, x: 100 },
        { state: State.ACTIVE, x: 150 },
        { state: State.ACTIVE, x: 180 },
        { state: State.END, x: 180 },
      ]);
    });

    expect(onChange.mock.calls).toStrictEqual([[0.75], [0.9]]);
  });
});
