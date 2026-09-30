import { act, screen, userEvent } from '@testing-library/react-native';

import { isolate } from '@e07/shell/i18n/bidi.ts';
import { createFakePurchase } from '@e07/shell/services/purchase/fake-purchase.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { BuyButton } from './buy-button.tsx';

const BUY_NAME = `Buy – ${isolate('€1.99')}`;

describe('BuyButton', () => {
  it('sends a press through the injected port', async () => {
    const user = userEvent.setup();
    const script = { isConnected: true, product: null, restoreResult: 'synced', transactions: [], calls: [] };
    await renderWithShell(<BuyButton />, { services: { purchase: createFakePurchase(script) } });

    await user.press(await screen.findByRole('button', { name: BUY_NAME }));

    expect(script.calls).toStrictEqual(['fetchProduct', 'requestPurchase']);
  });

  it('disappears when Premium becomes owned', async () => {
    const { stores } = await renderWithShell(<BuyButton />);
    expect(screen.getByRole('button', { name: BUY_NAME })).toBeOnTheScreen();

    await act(() => {
      stores.premium.getState().dispatch({ type: 'premium-granted' });
    });

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('names a port the test forgot to pass', async () => {
    await expect(renderWithShell(<BuyButton />)).rejects.toThrow('renderWithShell: pass services.purchase');
  });

  it('gives the icon a 44 pt touch box', async () => {
    await renderWithShell(<BuyButton />);
    // allow-style-assertion: the 44 x 44 pt minimum touch box of an icon-only button
    expect(screen.getByRole('button')).toHaveStyle({ width: 44, height: 44 });
  });
});
