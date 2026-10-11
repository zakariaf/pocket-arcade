// packages/shell/src/ui/button.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { Button } from './button.tsx';

import type * as WindowClassModule from './window-class.ts';

const COLORS = TEST_PALETTE.standard.light;
/** The text size the key sees: 1 normally, 2 for the 200 % text case. */
const mockFontScale = { current: 1 };
jest.mock('@e07/shell/ui/use-window-class.ts', () => {
  const { classifyWindow } = jest.requireActual<typeof WindowClassModule>(
    '@e07/shell/ui/window-class.ts',
  );
  return { useWindowClass: () => classifyWindow(402, 874, mockFontScale.current) };
});

describe('Button', () => {
  it('reports presses of a primary hero key with a play cap', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <Button
        label="Continue - Level 12"
        onPress={onPress}
        testID="home.play-button"
        kind="primary"
        size="hero"
        cap="play"
        isReducedMotion={false}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Continue - Level 12' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Continue - Level 12')).toHaveStyle({
      fontFamily: 'LilitaOne',
      fontSize: 25,
      color: COLORS.onPrimary,
    });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('keeps the label of a busy key and ignores presses', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <Button
        label="Purchasing"
        onPress={onPress}
        testID="premium.buy-button"
        kind="primary"
        size="hero"
        isBusy
        isReducedMotion
      />,
    );

    const button = screen.getByRole('button', { name: 'Purchasing' });
    await user.press(button);

    expect(button).toBeBusy();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('turns a disabled key muted and unpressable', async () => {
    const onPress = jest.fn();
    await renderWithShell(
      <Button
        label="Remove ads"
        onPress={onPress}
        testID="premium.buy-button"
        kind="primary"
        isDisabled
        isReducedMotion={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove ads' })).toBeDisabled();
    expect(screen.getByText('Remove ads')).toHaveStyle({ color: COLORS.textMuted });
  });

  it('paints danger labels in the danger colour on the surface', async () => {
    await renderWithShell(
      <Button
        label="Reset statistics"
        onPress={jest.fn()}
        testID="stats.reset-button"
        kind="danger"
        icon="trash"
        isBlock
        isReducedMotion={false}
      />,
    );

    expect(screen.getByText('Reset statistics')).toHaveStyle({
      color: COLORS.danger,
      fontFamily: 'Rubik-Bold',
    });
  });

  it('stretches a key in a dialog row to the height of its neighbour, and only there', async () => {
    await renderWithShell(
      <>
        <Button
          label="Not now"
          onPress={jest.fn()}
          testID="restart-dialog.later-button"
          kind="secondary"
          isInRow
          isReducedMotion={false}
        />
        <Button
          label="Play"
          onPress={jest.fn()}
          testID="home.play-button"
          kind="primary"
          isReducedMotion={false}
        />
      </>,
    );

    // The label sits in a View on the key's face: its parent is the face.
    // allow-style-assertion: CSS align-items stretch in the dialog row is only visible as flexGrow
    expect(screen.getByText('Not now').parent?.parent).toHaveStyle({ flexGrow: 1 });
    expect(screen.getByText('Play').parent?.parent).not.toHaveStyle({ flexGrow: 1 });
  });

  it('gives each key of a row a line of its own at 200 % text (spec 8.11)', async () => {
    // A row key grew from a fixed 120 pt basis, so two keys never wrapped at 200 % text and a
    // label wider than half the row split inside a word ("Previo / us", de "Zurüc / k").
    mockFontScale.current = 2;
    try {
      await renderWithShell(
        <Button
          label="Zurück"
          onPress={jest.fn()}
          testID="how-to-play.previous-button"
          icon="back"
          isInRow
          isReducedMotion={false}
        />,
      );

      // allow-style-assertion: a key as wide as its wrapping row takes a line of its own.
      expect(screen.getByTestId('how-to-play.previous-button')).toHaveStyle({ flexBasis: '100%' });
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    } finally {
      mockFontScale.current = 1;
    }
  });

  it('renders a quiet nudge as an underlined, unraised button', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <Button
        label="Restore purchase"
        onPress={onPress}
        testID="premium.restore-button"
        kind="quiet"
        icon="restore"
        isReducedMotion={false}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Restore purchase' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    const label = screen.getByText('Restore purchase');
    expect(label.parent?.children.find((child) => child !== label)).toHaveStyle({ height: 2 });
  });
});

describe('Button label language', () => {
  // Spec S2: Continue is written in the language being chosen, which need not be the screen's.
  it("draws and voices a label in its own language when it is not the screen's (S2)", async () => {
    await renderWithShell(
      <Button
        label="ادامه"
        labelLanguage="fa"
        onPress={jest.fn()}
        testID="language-choice.continue-button"
        kind="primary"
        size="hero"
        iconEnd="forward"
        isReducedMotion={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'ادامه' })).toHaveProp('accessibilityLanguage', 'fa');
    expect(screen.getByText('ادامه')).toHaveStyle({ fontFamily: 'Vazirmatn-Bold' });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
