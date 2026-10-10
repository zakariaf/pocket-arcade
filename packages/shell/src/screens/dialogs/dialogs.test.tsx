// packages/shell/src/screens/dialogs/dialogs.test.tsx
// allow-style-assertion: S14's button order rests on a plain 'row' (iOS mirrors it in RTL), and its danger colours on the theme's danger and dangerFill.
import { act, fireEvent, screen, userEvent, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { ancestorStyle } from '@e07/shell/testing/rendered-parts.ts';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { HOLD_TO_CONFIRM_MS } from '@e07/shell/ui/use-hold-to-confirm.ts';

import { NewerSaveDialog } from './newer-save-dialog.tsx';
import { ResetProgressDialog } from './reset-progress-dialog.tsx';
import { ResetStatsDialog } from './reset-stats-dialog.tsx';
import { RestartDialog } from './restart-dialog.tsx';
import { RestartLevelDialog } from './restart-level-dialog.tsx';
import { SaveRestoredDialog } from './save-restored-dialog.tsx';

import type { ReactNode } from 'react';

function partsOf(scope: string, parts: readonly string[]): string[] {
  return parts.map((part) => `${scope}.${part}`);
}

describe('S14 dialogs', () => {
  it('draws Reset all progress with the hold button, its hint and Cancel', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <ResetProgressDialog onConfirm={jest.fn()} onCancel={onCancel} isReducedMotion={false} />,
    );

    for (const testID of partsOf('reset-progress-dialog', [
      'scrim',
      'card',
      'art',
      'title',
      'body',
      'confirm-button',
      'confirm-button.fill',
      'hold-hint',
      'cancel-button',
    ]))
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('reset-progress-dialog.hold-hint')).toHaveTextContent(
      'Keep holding for 2 seconds.',
    );
    await user.press(screen.getByTestId('reset-progress-dialog.cancel-button'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it("draws the hold frozen at 46 % in the design's held frame (parity)", async () => {
    await renderWithShell(
      <ResetProgressDialog
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
        frozenProgress={0.46}
        isReducedMotion
      />,
    );
    const fill = screen.getByTestId('reset-progress-dialog.confirm-button.fill', {
      includeHiddenElements: true,
    });
    // allow-style-assertion: the fill width is the held state the s14-reset-all-progress frame draws.
    expect(fill).toHaveStyle({ width: '46%' });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws Restart to apply with the safe choice first', async () => {
    const onRestart = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <RestartDialog onRestart={onRestart} onLater={jest.fn()} isReducedMotion={false} />,
    );

    for (const testID of partsOf('restart-dialog', [
      'scrim',
      'card',
      'art',
      'title',
      'body',
      'buttons',
      'later-button',
      'restart-button',
    ]))
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Restart now' }));
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws Progress restored', async () => {
    await renderWithShell(<SaveRestoredDialog onOk={jest.fn()} isReducedMotion={false} />);

    for (const testID of partsOf('save-restored-dialog', [
      'scrim',
      'card',
      'art',
      'title',
      'body',
      'buttons',
      'ok-button',
    ]))
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws the chosen dialogs the design does not draw', async () => {
    const view = await renderWithShell(
      <RestartLevelDialog onRestart={jest.fn()} onCancel={jest.fn()} isReducedMotion={false} />,
    );
    for (const testID of partsOf('restart-level-dialog', [
      'scrim',
      'card',
      'title',
      'body',
      'buttons',
      'cancel-button',
      'restart-button',
    ]))
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();

    await view.rerender(
      <ResetStatsDialog onConfirm={jest.fn()} onCancel={jest.fn()} isReducedMotion={false} />,
    );
    for (const testID of partsOf('reset-stats-dialog', [
      'scrim',
      'card',
      'art',
      'title',
      'body',
      'confirm-button',
      'cancel-button',
    ]))
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();

    await view.rerender(
      <NewerSaveDialog
        gameName="Line Siege"
        onUpdate={jest.fn()}
        onLater={jest.fn()}
        isReducedMotion={false}
      />,
    );
    for (const testID of partsOf('newer-save-dialog', [
      'scrim',
      'card',
      'art',
      'title',
      'body',
      'buttons',
      'later-button',
      'update-button',
    ]))
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});

const SHELL = SHELL_COLORS.light;
const COLORS = TEST_PALETTE.standard.light;
const PAST_THE_HOLD_MS = HOLD_TO_CONFIRM_MS + 100;
const EARLY_RELEASE_MS = 1500;

type TwoButtonDialog = readonly [string, () => ReactNode, string, string];

const TWO_BUTTON_DIALOGS: readonly TwoButtonDialog[] = [
  [
    'restart-dialog',
    () => <RestartDialog onRestart={jest.fn()} onLater={jest.fn()} isReducedMotion={false} />,
    'later-button',
    'restart-button',
  ],
  [
    'restart-level-dialog',
    () => <RestartLevelDialog onRestart={jest.fn()} onCancel={jest.fn()} isReducedMotion={false} />,
    'cancel-button',
    'restart-button',
  ],
  [
    'newer-save-dialog',
    () => (
      <NewerSaveDialog
        gameName="Line Siege"
        onUpdate={jest.fn()}
        onLater={jest.fn()}
        isReducedMotion={false}
      />
    ),
    'later-button',
    'update-button',
  ],
];

const ORDER_CASES = TWO_BUTTON_DIALOGS.flatMap((dialog) =>
  (['en', 'fa'] as const).map((language) => [dialog[0], language, dialog] as const),
);

describe('S14 dialogs, the button order (spec S14, 7.5)', () => {
  it.each(ORDER_CASES)(
    'keeps the safe choice at the start and the action at the end of %s in %s, in a plain row RTL mirrors',
    async (scope, language, [, render, safe, action]) => {
      await renderWithShell(<>{render()}</>, { language });

      const row = screen.getByTestId(`${scope}.buttons`);
      expect(
        within(row)
          .getAllByRole('button')
          .map((button) => button.props['testID']),
      ).toStrictEqual([`${scope}.${safe}`, `${scope}.${action}`]);
      expect(StyleSheet.flatten(row.props['style'])).toMatchObject({ flexDirection: 'row' });
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    },
  );
});

describe('S14 Reset all progress, the 2-second hold (spec S14)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  async function holdDialog(isReducedMotion: boolean): Promise<jest.Mock> {
    const onConfirm = jest.fn();
    await renderWithShell(
      <ResetProgressDialog
        onConfirm={onConfirm}
        onCancel={jest.fn()}
        isReducedMotion={isReducedMotion}
      />,
    );
    return onConfirm;
  }

  it.each([false, true])(
    'confirms once after a 2-second hold, with Reduce motion %s (spec S14)',
    async (isReducedMotion) => {
      const onConfirm = await holdDialog(isReducedMotion);

      await fireEvent(screen.getByTestId('reset-progress-dialog.confirm-button'), 'pressIn');
      await act(() => {
        jest.advanceTimersByTime(PAST_THE_HOLD_MS);
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    },
  );

  it.each([false, true])(
    'confirms nothing and empties the fill when released at 1.5 seconds, with Reduce motion %s (spec S14)',
    async (isReducedMotion) => {
      const onConfirm = await holdDialog(isReducedMotion);
      const key = screen.getByTestId('reset-progress-dialog.confirm-button');

      await fireEvent(key, 'pressIn');
      await act(() => {
        jest.advanceTimersByTime(EARLY_RELEASE_MS);
      });
      await fireEvent(key, 'pressOut');
      await act(() => {
        jest.advanceTimersByTime(PAST_THE_HOLD_MS);
      });

      expect(onConfirm).not.toHaveBeenCalled();
      expect(
        screen.getByTestId('reset-progress-dialog.confirm-button.fill', {
          includeHiddenElements: true,
        }),
      ).toHaveStyle({ width: '0%' });
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    },
  );

  it('confirms through the VoiceOver activate action without the hold (spec S14)', async () => {
    const onConfirm = await holdDialog(false);

    await fireEvent(
      screen.getByTestId('reset-progress-dialog.confirm-button'),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'activate' },
      },
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});

describe('S14 reset dialogs, their danger colours (spec S14, O5)', () => {
  it("paints the reset art and the hold key in the theme's danger and dangerFill", async () => {
    await renderWithShell(
      <ResetProgressDialog onConfirm={jest.fn()} onCancel={jest.fn()} isReducedMotion={false} />,
    );

    expect(
      screen.getByTestId('reset-progress-dialog.art', { includeHiddenElements: true }),
    ).toHaveStyle({ backgroundColor: SHELL.dangerFill });
    expect(
      screen.getByTestId('reset-progress-dialog.confirm-button.fill', {
        includeHiddenElements: true,
      }),
    ).toHaveStyle({ backgroundColor: SHELL.dangerFill });
    expect(
      ancestorStyle(
        'reset-progress-dialog.confirm-button.fill',
        (style) => style.borderColor !== undefined,
      ).borderColor,
    ).toBe(COLORS.danger);
    expect(screen.getByText('Hold to reset')).toHaveStyle({ color: COLORS.danger });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('confirms Reset statistics with one plain danger press and no hold', async () => {
    const onConfirm = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <ResetStatsDialog onConfirm={onConfirm} onCancel={jest.fn()} isReducedMotion={false} />,
    );

    expect(
      screen.queryByTestId('reset-stats-dialog.confirm-button.fill', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    expect(
      screen.getByTestId('reset-stats-dialog.art', { includeHiddenElements: true }),
    ).toHaveStyle({ backgroundColor: SHELL.dangerFill });
    await user.press(screen.getByTestId('reset-stats-dialog.confirm-button'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
