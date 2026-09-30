// packages/shell/src/app/connect-premium-reloads.test.ts
import { AppState } from 'react-native';

import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { withConnectivity } from '@e07/shell/services/purchase/connectivity-gated-purchase.ts';
import { createFakePurchase } from '@e07/shell/services/purchase/fake-purchase.ts';
import { loadStore } from '@e07/shell/services/purchase/premium-store-flow.ts';
import { createShellStores } from '@e07/shell/stores/create-shell-stores.ts';
import { priceOf } from '@e07/shell/stores/premium/premium-state.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { connectPremiumReloads } from './connect-premium-reloads.ts';

import type { PremiumServiceDeps } from '@e07/shell/services/purchase/premium-service.ts';
import type { AppStateStatus } from 'react-native';

function setup(isOnline = false) {
  const stores = createShellStores(createTestSave().save);
  const connectivity = createFakeConnectivity(isOnline);
  const calls: string[] = [];
  const port = createFakePurchase({
    isConnected: true,
    product: { productId: 'premium', displayPrice: '€1.99', price: 1.99, currency: 'EUR' },
    restoreResult: 'synced',
    transactions: [],
    calls,
  });
  const deps: PremiumServiceDeps = {
    port: withConnectivity(port, connectivity.isOnline),
    productId: 'premium',
    dispatch: stores.premium.getState().dispatch,
    persistPremium: jest.fn(),
    formatPrice: (product) => product.displayPrice,
    onError: jest.fn(),
  };
  return { stores, connectivity, deps, calls };
}

/** The AppState 'change' listener connectPremiumReloads registers. */
function captureAppState(): (next: AppStateStatus) => void {
  let captured: ((next: AppStateStatus) => void) | null = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    captured = listener;
    return { remove: jest.fn() };
  });
  return (next) => {
    captured?.(next);
  };
}

describe('connectPremiumReloads', () => {
  it('loads the price once the first network state says online after an offline start', async () => {
    const { stores, connectivity, deps } = setup();
    await loadStore(deps); // startPremium ran before the network state arrived
    expect(stores.premium.getState().flow.kind).toBe('unavailable');
    connectPremiumReloads(connectivity, stores, deps);
    connectivity.setOnline(true);
    await flushMicrotasks();
    expect(priceOf(stores.premium.getState().flow)).toBe('€1.99');
  });

  it('does not reload while the store is loading', async () => {
    const { stores, connectivity, deps, calls } = setup();
    connectPremiumReloads(connectivity, stores, deps);
    stores.premium.getState().dispatch({ type: 'connect-started' });
    connectivity.setOnline(true);
    await flushMicrotasks();
    expect(calls).toStrictEqual([]);
  });

  it('rechecks Premium when the app comes back to the foreground online, not offline', async () => {
    const emit = captureAppState();
    const online = setup(true);
    connectPremiumReloads(online.connectivity, online.stores, online.deps);
    emit('active');
    await flushMicrotasks();
    expect(online.calls).toContain('readTransactions');
    const offline = setup(false);
    const emitOffline = captureAppState();
    connectPremiumReloads(offline.connectivity, offline.stores, offline.deps);
    emitOffline('active');
    await flushMicrotasks();
    expect(offline.calls).toStrictEqual([]);
  });
});
