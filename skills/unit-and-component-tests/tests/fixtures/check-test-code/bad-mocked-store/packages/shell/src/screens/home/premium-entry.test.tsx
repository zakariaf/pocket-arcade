import { screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { PremiumEntry } from './premium-entry.tsx';

jest.mock('@e07/shell/stores/premium/premium-store.ts', () => ({
  usePremiumStore: () => true,
}));

describe('PremiumEntry', () => {
  it('hides for owners', async () => {
    await renderWithShell(<PremiumEntry onOpen={jest.fn()} />);
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});
