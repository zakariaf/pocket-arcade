// packages/shell/src/app/parity/parity-purchase.test.ts
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { PARITY_PLANS } from './parity-plans.ts';
import { createParityPurchase } from './parity-purchase.ts';

import type { ParityFrameKey } from './parity-plans.ts';
import type { PurchaseEvent } from '@e07/shell/services/purchase/purchase-port.ts';

const PRODUCT = 'com.example.linesiege.premium';

function portFor(frame: ParityFrameKey): ReturnType<typeof createParityPurchase> {
  return createParityPurchase({ productId: PRODUCT, plan: PARITY_PLANS[frame] });
}

/** True when the promise has not settled after the queued work ran. */
async function isStillPending(promise: Promise<unknown>): Promise<boolean> {
  const marker = Symbol('pending');
  const winner = await Promise.race([promise, flushMicrotasks().then(() => marker)]);
  return winner === marker;
}

describe('createParityPurchase', () => {
  it('sells the fixture product at the fixture price, with no typed price', async () => {
    const port = portFor('s12-premium');

    await expect(port.connect()).resolves.toBe(true);
    await expect(port.fetchProduct(PRODUCT)).resolves.toStrictEqual({
      productId: PRODUCT,
      displayPrice: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(
        1.99,
      ),
      price: 1.99,
      currency: 'EUR',
    });
    await expect(port.readTransactions()).resolves.toStrictEqual([]);
  });

  it('owns Premium on Premium frames', async () => {
    const owned = await portFor('s4-home-premium').readTransactions();
    const alreadyOwned = await portFor('s12-already-owned').readTransactions();

    expect(owned).toMatchObject([
      { productId: PRODUCT, state: 'purchased', revocationDateMs: null },
    ]);
    expect(alreadyOwned).toHaveLength(1);
  });

  it('keeps the price loading on the loading card', async () => {
    await expect(isStillPending(portFor('s12-loading-price').fetchProduct(PRODUCT))).resolves.toBe(
      true,
    );
  });

  it('has no store on the unavailable card', async () => {
    const port = portFor('s12-store-unavailable-offline');

    await expect(port.connect()).resolves.toBe(false);
    await expect(port.fetchProduct(PRODUCT)).resolves.toBeNull();
  });

  it('keeps the purchase sheet up on the purchasing card', async () => {
    await expect(
      isStillPending(portFor('s12-purchase-in-progress').requestPurchase(PRODUCT)),
    ).resolves.toBe(true);
  });

  it.each([
    ['s12-pending-approval', { type: 'transaction', transaction: { state: 'pending' } }],
    ['s12-success', { type: 'transaction', transaction: { state: 'purchased' } }],
    ['s12-error', { type: 'failure', failure: 'failed' }],
  ] as const)('answers Buy on %s through subscribe()', async (frame, expected) => {
    const port = portFor(frame);
    const events: PurchaseEvent[] = [];
    const unsubscribe = port.subscribe((event) => {
      events.push(event);
    });

    await port.requestPurchase(PRODUCT);
    expect(events).toStrictEqual([]);
    await flushMicrotasks();

    expect(events).toMatchObject([expected]);
    unsubscribe();
  });

  it('restores and finishes without a store', async () => {
    const port = portFor('s12-restore-results-toasts');

    await expect(port.restore()).resolves.toBe('synced');
    await expect(
      port.finish({
        productId: PRODUCT,
        transactionId: 't',
        state: 'purchased',
        revocationDateMs: null,
        handle: null,
      }),
    ).resolves.toBeUndefined();
  });
});
