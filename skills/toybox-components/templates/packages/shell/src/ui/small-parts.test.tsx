// packages/shell/src/ui/small-parts.test.tsx
import { fireEvent, screen, userEvent } from '@testing-library/react-native';

import { PressFeedbackProvider } from '@e07/shell/app/press-feedback-context.tsx';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { BusyBlocks } from './busy-blocks.tsx';
import { GroupTab } from './group-tab.tsx';
import { QuietButton } from './quiet-button.tsx';
import { RadioMark } from './radio-mark.tsx';
import { WeekMark } from './week-mark.tsx';

import type { useWindowDimensions } from 'react-native';

type WindowMetrics = ReturnType<typeof useWindowDimensions>;

/** The window the parts see: text size 1 normally, the largest accessibility size in one case. */
const mockWindow: { current: WindowMetrics } = {
  current: { width: 402, height: 874, fontScale: 1, scale: 3 },
};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow.current,
}));

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

  it('shrinks its label to the column, so a long nudge wraps inside the gutters (spec S7)', async () => {
    // A row's text never wraps unless its box may shrink: the German S7 nudge laid out at 366 pt
    // in a 362 pt column, 2 pt past each gutter, on one line where the design wraps (E17 parity).
    await renderWithShell(
      <QuietButton
        label="Gefällt’s dir? Entferne die Werbung für 1,99 €."
        icon="crown"
        onPress={jest.fn()}
        testID="result.premium-button"
        isReducedMotion
      />,
    );

    const label = screen.getByText('Gefällt’s dir? Entferne die Werbung für 1,99 €.');
    expect(label.parent).toHaveStyle({ flexShrink: 1 });
  });

  it.each([
    ['ltr', 22, 126],
    ['rtl', 23, 127],
  ] as const)(
    'underlines each line of a wrapped label at its own width (%s, spec S7)',
    async (direction, firstStart, secondStart) => {
      // CSS underlines every line under its own text; the German S7 nudge wraps to two lines, and
      // one box-wide bar under the first line missed "1,99 €." (E17 parity).
      const text = 'Gefällt’s dir? Entferne die Werbung für 1,99 €.';
      await renderWithShell(
        <QuietButton
          label={text}
          icon="crown"
          onPress={jest.fn()}
          testID="result.premium-button"
          isReducedMotion
        />,
        { direction },
      );
      const label = screen.getByText(text);
      await fireEvent(label.parent ?? label, 'layout', {
        nativeEvent: { layout: { width: 300, height: 38 } },
      });
      await fireEvent(label, 'textLayout', {
        nativeEvent: {
          lines: [
            {
              x: 22,
              y: 0,
              width: 255,
              height: 18.75,
              text: 'Gefällt’s dir? Entferne die Werbung für ',
            },
            { x: 126, y: 19, width: 47, height: 19, text: '1,99 €.' },
          ],
        },
      });

      const box = screen.getByText(text).parent;
      const bars = (box?.children ?? []).filter(
        (child) => typeof child !== 'string' && child.props['accessibilityElementsHidden'] === true,
      );
      expect(bars).toHaveLength(2);
      // Rubik 15 on its 19 pt line: the bar sits 19.5 under its line's top (quietUnderlineTop).
      expect(bars[0]).toHaveStyle({ start: firstStart, width: 255, top: 19.5, height: 2 });
      expect(bars[1]).toHaveStyle({ start: secondStart, width: 47, top: 38.5, height: 2 });
    },
  );

  it('draws no line-placed bar in RTL before the label box has its width (spec S7)', async () => {
    // iOS can report the lines before the label box's layout: with the width still 0, the RTL
    // start (width - x - line width) put the bar off the label for one frame.
    const text = 'Gefällt’s dir? Entferne die Werbung für 1,99 €.';
    await renderWithShell(
      <QuietButton
        label={text}
        icon="crown"
        onPress={jest.fn()}
        testID="result.premium-button"
        isReducedMotion
      />,
      { direction: 'rtl' },
    );
    await fireEvent(screen.getByText(text), 'textLayout', {
      nativeEvent: {
        lines: [
          {
            x: 22,
            y: 0,
            width: 255,
            height: 18.75,
            text: 'Gefällt’s dir? Entferne die Werbung für ',
          },
          { x: 126, y: 19, width: 47, height: 19, text: '1,99 €.' },
        ],
      },
    });

    const bars = (screen.getByText(text).parent?.children ?? []).filter(
      (child) => typeof child !== 'string' && child.props['accessibilityElementsHidden'] === true,
    );
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveStyle({ start: 0, end: 0, top: 19.5 });
  });

  it('keeps the underline under the text at 200 % text (spec 8.11)', async () => {
    // At the largest text size the label is drawn at 30 pt on a 38 pt line, but the bar sat where
    // a 15 pt line puts it, 19.5 under the top: through the middle of "Restore purchase".
    mockWindow.current = { width: 402, height: 874, fontScale: 3.571, scale: 3 };
    try {
      const text = 'Restore purchase';
      await renderWithShell(
        <QuietButton
          label={text}
          icon="restore"
          onPress={jest.fn()}
          testID="premium.restore-button"
          isReducedMotion
        />,
      );
      await fireEvent(screen.getByText(text).parent ?? screen.getByText(text), 'layout', {
        nativeEvent: { layout: { width: 260, height: 38 } },
      });
      await fireEvent(screen.getByText(text), 'textLayout', {
        nativeEvent: { lines: [{ x: 0, y: 0, width: 260, height: 38, text }] },
      });

      const bars = (screen.getByText(text).parent?.children ?? []).filter(
        (child) => typeof child !== 'string' && child.props['accessibilityElementsHidden'] === true,
      );
      // Rubik 30 on its 38 pt line: ascent 28, descent 8, the bar 5 under the ascent: 34.
      expect(bars[0]).toHaveStyle({ top: 34, height: 2 });
    } finally {
      mockWindow.current = { width: 402, height: 874, fontScale: 1, scale: 3 };
    }
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
