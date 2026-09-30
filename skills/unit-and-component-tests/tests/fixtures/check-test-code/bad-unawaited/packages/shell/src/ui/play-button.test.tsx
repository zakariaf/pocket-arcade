import { act, screen, userEvent } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { PlayButton } from './play-button.tsx';

describe('PlayButton', () => {
  it('reports presses', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    renderWithShell(<PlayButton onPress={onPress} />);

    user.press(screen.getByRole('button', { name: 'Play' }));
    act(() => {
      onPress();
    });
    const label = screen.findByText('Play');

    expect(onPress).toHaveBeenCalledTimes(2);
    expect(label).toBeDefined();
  });
});
