// packages/shell/src/ui/icon-button.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { IconButton } from './icon-button.tsx';

describe('IconButton', () => {
  it('gives an icon-only key a name and reports presses', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <IconButton
        icon="gear"
        label="Settings"
        onPress={onPress}
        testID="home.settings-button"
        isReducedMotion={false}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Settings' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('makes a disabled key unpressable', async () => {
    const onPress = jest.fn();
    await renderWithShell(
      <IconButton
        icon="undo"
        label="Undo"
        onPress={onPress}
        testID="game.undo-button"
        size="small"
        isDisabled
        isReducedMotion
      />,
    );

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});
