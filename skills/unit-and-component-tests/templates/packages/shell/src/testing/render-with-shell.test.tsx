// packages/shell/src/testing/render-with-shell.test.tsx — the RNTL 14 async pattern on a probe that
// uses a port, a store, the catalog and the Shell's AppText and Toybox Button the way a screen does.
// The last case proves jest.setup.ts's Skia mock: without it a Skia import crashes the whole suite.
import { Canvas, Path } from '@shopify/react-native-skia';
import { act, screen, userEvent } from '@testing-library/react-native';
import { useEffect, useState } from 'react';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { isolate } from '@e07/shell/i18n/bidi.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { createFakePurchase } from '@e07/shell/services/purchase/fake-purchase.ts';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';

import { renderWithShell } from './render-with-shell.tsx';

import type { FakePurchaseScript } from '@e07/shell/services/purchase/fake-purchase.ts';
import type { StoreProduct } from '@e07/shell/services/purchase/purchase-port.ts';
import type { ReactNode } from 'react';

const PRODUCT: StoreProduct = {
  productId: 'premium',
  displayPrice: '€1.99',
  price: 1.99,
  currency: 'EUR',
};
// t() wraps {priceText} in FSI/PDI bidi isolates, so the accessible name contains the isolates too.
const BUY_NAME = `Buy – ${isolate('€1.99')}`;

function BuyProbe(): ReactNode {
  const t = useT();
  const { purchase } = useServices();
  const isPremium = usePremiumStore((state) => state.isPremium);
  const [price, setPrice] = useState<string | null>(null);
  useEffect(() => {
    purchase
      .fetchProduct(PRODUCT.productId)
      .then((product) => {
        setPrice(product?.displayPrice ?? null);
      })
      .catch(() => undefined);
  }, [purchase]);
  const handleBuy = (): void => {
    purchase.requestPurchase(PRODUCT.productId).catch(() => undefined);
  };
  if (isPremium) {
    return <AppText text={t('premium.active')} />;
  }
  return price === null ? null : (
    <Button
      kind="primary"
      label={t('premium.buy-button', { priceText: price })}
      onPress={handleBuy}
      testID="premium.buy-button"
      isReducedMotion
    />
  );
}

/** Shows what the seeded stores and the ThemeProvider resolved. */
function SeedProbe(): ReactNode {
  const theme = useTheme();
  const volume = useSettingsStore((state) => state.settings.soundVolume);
  return <AppText text={`${theme.key} ${String(volume)}`} testID="probe.seed" />;
}

function scriptWith(product: StoreProduct | null): FakePurchaseScript {
  return { isConnected: true, product, restoreResult: 'synced', transactions: [], calls: [] };
}

describe('renderWithShell', () => {
  it('shows what a port loads once its promise settles', async () => {
    const purchase = createFakePurchase(scriptWith(PRODUCT));
    await renderWithShell(<BuyProbe />, { services: { purchase } });

    expect(await screen.findByRole('button', { name: BUY_NAME })).toBeEnabled();
  });

  it('sends a press through the injected port', async () => {
    const user = userEvent.setup();
    const script = scriptWith(PRODUCT);
    await renderWithShell(<BuyProbe />, {
      services: { purchase: createFakePurchase(script) },
    });

    await user.press(await screen.findByRole('button', { name: BUY_NAME }));

    expect(script.calls).toStrictEqual(['fetchProduct', 'requestPurchase']);
  });

  it('updates when a store changes outside React', async () => {
    const purchase = createFakePurchase(scriptWith(PRODUCT));
    const { stores } = await renderWithShell(<BuyProbe />, { services: { purchase } });
    await screen.findByRole('button', { name: BUY_NAME });

    await act(() => {
      stores.premium.getState().dispatch({ type: 'premium-granted' });
    });

    expect(screen.getByText('Premium – active')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('starts from the seeded save', async () => {
    const purchase = createFakePurchase(scriptWith(PRODUCT));
    const { stores } = await renderWithShell(<BuyProbe />, {
      isPremium: true,
      services: { purchase },
    });

    expect(screen.getByText('Premium – active')).toBeOnTheScreen();
    expect(stores.premium.getState().isPremium).toBe(true);
  });

  it('derives the theme from the seeded settings', async () => {
    await renderWithShell(<SeedProbe />, {
      settings: { theme: 'dark', colorBlind: true, soundVolume: 35 },
    });

    expect(screen.getByTestId('probe.seed')).toHaveTextContent('colorBlind.dark 35');
  });

  it('names a port the test forgot to pass', async () => {
    await expect(renderWithShell(<BuyProbe />)).rejects.toThrow(
      'renderWithShell: pass services.purchase',
    );
  });

  it('renders Skia drawings as inert elements that keep their accessibility props', async () => {
    await renderWithShell(
      <Canvas accessible accessibilityRole="image" accessibilityLabel="Board">
        <Path path="M0 0H8V8Z" />
      </Canvas>,
    );

    expect(screen.getByRole('image', { name: 'Board' })).toBeOnTheScreen();
  });
});
