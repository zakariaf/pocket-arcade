import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { PlayButton } from './play-button.tsx';

describe('PlayButton', () => {
  it('shows the result after a press', async () => {
    const user = userEvent.setup();
    await renderWithShell(<PlayButton onPress={jest.fn()} />);
    await waitFor(async () => {
      await user.press(screen.getByRole('button'));
      expect(screen.getByText('Done')).toBeOnTheScreen();
    });
  });
});
