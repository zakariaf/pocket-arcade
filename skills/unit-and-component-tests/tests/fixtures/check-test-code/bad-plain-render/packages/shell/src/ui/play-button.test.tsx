import { render, screen } from '@testing-library/react-native';

import { PlayButton } from './play-button.tsx';

describe('PlayButton', () => {
  it('shows its label', async () => {
    await render(<PlayButton onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeOnTheScreen();
  });
});
