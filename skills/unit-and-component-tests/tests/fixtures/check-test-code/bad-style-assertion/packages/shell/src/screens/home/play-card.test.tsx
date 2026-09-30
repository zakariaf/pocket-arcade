import { screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { PlayCard } from './play-card.tsx';

describe('PlayCard', () => {
  it('is orange', async () => {
    await renderWithShell(<PlayCard onPress={jest.fn()} />);
    // allow-style-assertion: ok
    expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: '#F28C28' });
  });
});
