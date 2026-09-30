import { userEvent } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { PlayButton } from './play-button.tsx';

describe('PlayButton', () => {
  it('reports presses', async () => {
    const onPress = jest.fn();
    const { getByText } = await renderWithShell(<PlayButton onPress={onPress} />);
    await userEvent.press(getByText('Play'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
