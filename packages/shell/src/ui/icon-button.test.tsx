// packages/shell/src/ui/icon-button.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { COMPONENT_SPECS } from './component-specs.ts';
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

  it('draws an inert key raised at rest, but unpressable', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <IconButton
        icon="hint"
        label="Hint"
        onPress={onPress}
        testID="game.hint-button"
        size="small"
        isInert
        isReducedMotion
      />,
    );

    const key = screen.getByRole('button', { name: 'Hint' });
    await user.press(key);
    expect(key).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
    // allow-style-assertion: an inert key stays raised (a disabled key sinks by its elevation)
    expect(screen.getByTestId('game.hint-button')).not.toHaveStyle({
      top: COMPONENT_SPECS.iconButton.elevation,
    });
  });
});
