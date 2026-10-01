// packages/shell/src/ui/small-parts.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { PressFeedbackProvider } from '@e07/shell/app/press-feedback-context.tsx';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { BusyBlocks } from './busy-blocks.tsx';
import { GroupTab } from './group-tab.tsx';
import { QuietButton } from './quiet-button.tsx';
import { RadioMark } from './radio-mark.tsx';
import { WeekMark } from './week-mark.tsx';

const COLORS = TEST_PALETTE.standard.light;
const HIDDEN = { includeHiddenElements: true } as const;

describe('QuietButton', () => {
  it('is a flat, underlined nudge that still names itself and reports presses', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <QuietButton
        label="Restore purchase"
        icon="restore"
        onPress={onPress}
        testID="premium.restore-button"
        isReducedMotion
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Restore purchase' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    // The underline is drawn as the design draws it (2 pt, 5 pt under the text), not by iOS.
    expect(screen.getByText('Restore purchase')).not.toHaveStyle({
      textDecorationLine: 'underline',
    });
    const label = screen.getByText('Restore purchase');
    const underline = label.parent?.children.find((child) => child !== label);
    expect(underline).toHaveStyle({ height: 2, backgroundColor: COLORS.text });
    expect(screen.getByTestId('premium.restore-button')).not.toHaveStyle({ borderWidth: 3 });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('greys out and ignores presses when disabled', async () => {
    const onPress = jest.fn();
    await renderWithShell(
      <QuietButton
        label="Home"
        onPress={onPress}
        testID="pause.home-button"
        isDisabled
        isReducedMotion
      />,
    );

    expect(screen.getByRole('button', { name: 'Home' })).toBeDisabled();
    expect(screen.getByText('Home')).toHaveStyle({ color: COLORS.textMuted });
  });

  it('plays the tap feedback before its action', async () => {
    const calls: string[] = [];
    const user = userEvent.setup();
    await renderWithShell(
      <PressFeedbackProvider onPress={() => calls.push('tap')}>
        <QuietButton
          label="Home"
          onPress={() => calls.push('home')}
          testID="pause.home-button"
          isReducedMotion={false}
        />
      </PressFeedbackProvider>,
    );

    await user.press(screen.getByRole('button', { name: 'Home' }));

    expect(calls).toStrictEqual(['tap', 'home']);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});

describe('BusyBlocks', () => {
  it('stands alone as a labelled image on the splash', async () => {
    await renderWithShell(
      <BusyBlocks
        size="splash"
        color={COLORS.text}
        label="Loading"
        testID="splash.loader"
        isReducedMotion
      />,
    );

    expect(screen.getByRole('image', { name: 'Loading' })).toBeOnTheScreen();
  });

  it('hides itself inside a busy button, where the label speaks', async () => {
    await renderWithShell(
      <BusyBlocks
        size="button"
        color={COLORS.onPrimary}
        testID="premium.buy-busy"
        isReducedMotion
      />,
    );

    expect(screen.queryByTestId('premium.buy-busy')).not.toBeOnTheScreen();
    expect(screen.getByTestId('premium.buy-busy', HIDDEN)).toHaveStyle({ gap: 5 });
  });
});

describe('GroupTab, RadioMark and WeekMark', () => {
  it('draws the folder tab as a pop heading', async () => {
    await renderWithShell(
      <GroupTab title="Display" icon="gear" testID="settings.group.display.tab" />,
    );

    // The tab View is the heading and carries the testID: Maestro measures the whole tab.
    const tab = screen.getByTestId('settings.group.display.tab');
    expect(screen.getByRole('header', { name: 'Display' })).toBe(tab);
    expect(tab).toHaveStyle({ backgroundColor: COLORS.pop, borderWidth: 2, marginStart: 0 });
    expect(screen.getByText('Display')).toHaveStyle({ color: COLORS.onPop });
  });

  it('shows a check only in the chosen radio mark', async () => {
    await renderWithShell(
      <>
        <RadioMark isSelected testID="language-choice.language-row.en.radio" />
        <RadioMark isSelected={false} testID="language-choice.language-row.de.radio" />
      </>,
    );

    const chosen = screen.getByTestId('language-choice.language-row.en.radio', HIDDEN);
    const other = screen.getByTestId('language-choice.language-row.de.radio', HIDDEN);
    expect(chosen.children).toHaveLength(1);
    expect(other.children).toHaveLength(0);
    expect(other).toHaveStyle({ width: 32, borderRadius: 9 });
  });

  it('labels a strip mark and keeps legend marks decorative', async () => {
    await renderWithShell(
      <>
        <WeekMark state="done" size="regular" label="Monday, done" testID="daily.week-day.1.mark" />
        <WeekMark state="missed" size="xs" testID="daily.week-card.legend.missed-mark" />
      </>,
    );

    expect(screen.getByRole('image', { name: 'Monday, done' })).toBeOnTheScreen();
    // Decorative: hidden from VoiceOver (so the parity map treats it as crop-only).
    expect(screen.queryByTestId('daily.week-card.legend.missed-mark')).toBeNull();
    expect(screen.getByTestId('daily.week-card.legend.missed-mark', HIDDEN)).toHaveStyle({
      width: 22,
      borderStyle: 'dashed',
    });
  });
});
