// packages/shell/src/services/purchase/premium-service.test.ts
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { createFakePurchase } from './fake-purchase.ts';
import { restorePremium } from './premium-service.ts';
import { buyPremium, startPremium } from './premium-store-flow.ts';

import type { FakePurchaseScript } from './fake-purchase.ts';
import type { PremiumChange } from './premium-service.ts';
import type { StoreTransaction } from './purchase-port.ts';
import type { PremiumAction } from '@e07/shell/stores/premium/premium-state.ts';

const ID = 'com.example.linesiege.premium';
const BOUGHT: StoreTransaction = {
  productId: ID,
  transactionId: 't1',
  state: 'purchased',
  revocationDateMs: null,
  handle: null,
};

function setup(overrides: Partial<FakePurchaseScript> = {}) {
  const script: FakePurchaseScript = {
    isConnected: true,
    product: { productId: ID, displayPrice: '€1.99', price: 1.99, currency: 'EUR' },
    restoreResult: 'synced',
    transactions: [],
    calls: [],
    ...overrides,
  };
  const port = createFakePurchase(script);
  const actions: PremiumAction[] = [];
  const deps = {
    port,
    productId: ID,
    dispatch: (action: PremiumAction) => actions.push(action),
    persistPremium: (change: PremiumChange) =>
      script.calls.push(`persist:${String(change.isPremium)}`),
    formatPrice: (product: { readonly displayPrice: string }) => product.displayPrice,
    onError: () => undefined,
  };
  return { script, port, actions, deps };
}

describe('premium service', () => {
  it('persists Premium BEFORE finishing the transaction', async () => {
    const { script, port, deps } = setup();
    await startPremium(deps);
    await buyPremium(deps);
    port.emit({ type: 'transaction', transaction: BOUGHT });
    await flushMicrotasks();
    const tail = script.calls.slice(script.calls.indexOf('requestPurchase'));
    expect(tail).toStrictEqual(['requestPurchase', 'persist:true', 'finish:t1']);
  });

  it('maps an empty product list to "store unavailable"', async () => {
    const { actions, deps } = setup({ product: null });
    await startPremium(deps);
    expect(actions).toContainEqual({ type: 'store-unavailable' });
  });

  it('reports a failed App Store sync as "couldn\'t restore", not "nothing to restore"', async () => {
    const { actions, deps } = setup({ restoreResult: 'sync-failed' });
    await restorePremium(deps);
    expect(actions).toContainEqual({ type: 'restore-finished', evidence: 'sync-failed' });
  });

  it('keeps Premium when the launch re-check sees no transactions', async () => {
    const { script, deps } = setup({ transactions: [] });
    await startPremium(deps);
    expect(script.calls).not.toContain('persist:false');
  });

  it('revokes on a refunded transaction delivered by the listener', async () => {
    const refunded = { ...BOUGHT, revocationDateMs: 1_700_000_000_000 };
    const { script, port, deps } = setup({ transactions: [refunded] });
    await startPremium(deps);
    port.emit({ type: 'transaction', transaction: refunded });
    await flushMicrotasks();
    expect(script.calls).toContain('persist:false');
  });
});
