// packages/shell/src/ui/button.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { Button } from './button.tsx';

const COLORS = TEST_PALETTE.standard.light;

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
    expect(screen.getByText('Restore purchase')).toHaveStyle({ textDecorationLine: 'underline' });
  });
});
