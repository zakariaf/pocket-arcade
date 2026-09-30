import { screen } from '@testing-library/react-native';

import { PrimaryButton } from '@e07/shell/ui/primary-button.tsx';

// Tests may use literal strings: they query what VoiceOver hears.
it('names the button', () => {
  render(<PrimaryButton label="Play" onPress={jest.fn()} testID="home.play-button" />);
  expect(screen.getByRole('button', { name: 'Play' })).toBeOnTheScreen();
});
