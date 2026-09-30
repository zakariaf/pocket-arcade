import { screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { PremiumEntry } from './premium-entry.tsx';

describe('PremiumEntry', () => {
  it('shows the entry and no error', async () => {
    await renderWithShell(<PremiumEntry onOpen={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Premium' })).toBeOnTheScreen();
    expect(screen.getByText('Error')).not.toBeOnTheScreen();
  });
});
