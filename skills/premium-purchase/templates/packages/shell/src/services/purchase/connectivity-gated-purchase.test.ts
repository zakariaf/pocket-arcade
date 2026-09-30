// packages/shell/src/services/purchase/connectivity-gated-purchase.test.ts
import { withConnectivity } from './connectivity-gated-purchase.ts';
import { createFakePurchase } from './fake-purchase.ts';
import { loadStore, shouldReloadStore } from './premium-store-flow.ts';

import type { FakePurchaseScript } from './fake-purchase.ts';
import type { PremiumAction } from '@e07/shell/stores/premium/premium-state.ts';

const ID = 'com.example.linesiege.premium';

function setup(isOnline: () => boolean) {
  const script: FakePurchaseScript = {
    isConnected: true,
    product: { productId: ID, displayPrice: '€1.99', price: 1.99, currency: 'EUR' },
    restoreResult: 'synced',
    transactions: [],
    calls: [],
  };
  const port = withConnectivity(createFakePurchase(script), isOnline);
  return { script, port };
}

describe('withConnectivity', () => {
  it('reports the store unavailable offline without asking StoreKit', async () => {
    const { script, port } = setup(() => false);

    await expect(port.connect()).resolves.toBe(false);
    await expect(port.fetchProduct(ID)).resolves.toBeNull();
    await expect(port.restore()).resolves.toBe('sync-failed');
    await expect(port.readTransactions()).resolves.toStrictEqual([]);
    expect(script.calls).toStrictEqual([]);
  });

  it('passes every call through while online', async () => {
    const { script, port } = setup(() => true);

    await port.connect();
    await port.restore();

    expect(script.calls).toStrictEqual(['connect', 'restore']);
  });

  it('turns S12 into "store unavailable" when the phone is offline', async () => {
    const { port } = setup(() => false);
    const actions: PremiumAction[] = [];
    await loadStore({
      port,
      productId: ID,
      dispatch: (action) => actions.push(action),
      persistPremium: () => undefined,
      formatPrice: (product) => product.displayPrice,
      onError: () => undefined,
    });

    expect(actions).toStrictEqual([{ type: 'connect-started' }, { type: 'store-unavailable' }]);
  });
});

describe('shouldReloadStore', () => {
  it.each([
    ['unavailable', true, true],
    ['ready', true, false],
    ['ready', false, true],
    ['restore-failed', false, true],
    ['purchasing', false, false],
    ['restoring', false, false],
    ['loading', false, false],
  ] as const)('answers %s online=%s with %s', (flow, isOnline, shouldReload) => {
    expect(shouldReloadStore(flow, isOnline)).toBe(shouldReload);
  });
});
