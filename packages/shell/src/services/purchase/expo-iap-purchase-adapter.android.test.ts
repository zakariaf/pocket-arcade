// packages/shell/src/services/purchase/expo-iap-purchase-adapter.android.test.ts — the expo-iap
// adapter and the Premium service where Platform.OS is 'android' (the unit-android Jest project),
// with Play Billing's purchase shape from the root expo-iap mock. Play Billing never delivers an
// unacknowledged purchase again and refunds it after 3 days, and finishTransaction is the
// acknowledge, so the order "save, grant, acknowledge" is the whole contract here.
import { Platform } from 'react-native';

import { createExpoIapPurchaseAdapter } from './expo-iap-purchase-adapter.ts';
import { restorePremium } from './premium-service.ts';
import { buyPremium, startPremium } from './premium-store-flow.ts';

import type { PremiumChange } from './premium-service.ts';
import type { PremiumAction } from '@e07/shell/stores/premium/premium-state.ts';

jest.mock('expo-iap');

type AndroidPurchase = {
  readonly id: string;
  readonly transactionId: string | null;
  readonly productId: string;
  readonly purchaseState: 'pending' | 'purchased' | 'unknown';
  readonly isAcknowledgedAndroid: boolean;
  readonly purchaseToken: string;
  readonly platform: 'android';
};
type Finish = (request: { purchase: AndroidPurchase; isConsumable: boolean }) => Promise<void>;
type MockedIap = {
  readonly ErrorCode: Readonly<Record<string, string>>;
  readonly initConnection: jest.Mock<Promise<boolean>>;
  readonly getAvailablePurchases: jest.Mock<Promise<readonly AndroidPurchase[]>>;
  readonly restorePurchases: jest.Mock<Promise<void>>;
  readonly requestPurchase: jest.Mock<Promise<null>, [unknown]>;
  readonly finishTransaction: jest.Mock<Promise<void>, Parameters<Finish>>;
  readonly purchaseUpdatedListener: jest.Mock<
    { remove: () => void },
    [(purchase: AndroidPurchase) => void]
  >;
};

const iap = jest.requireMock<MockedIap>('expo-iap');

const ID = 'io.applander.linesiege.premium';
const BOUGHT: AndroidPurchase = {
  id: 'GPA.3301-0001',
  transactionId: 'GPA.3301-0001',
  productId: ID,
  purchaseState: 'purchased',
  isAcknowledgedAndroid: false,
  purchaseToken: 'token-1',
  platform: 'android',
};
const PENDING: AndroidPurchase = { ...BOUGHT, transactionId: null, purchaseState: 'pending' };
const ACKNOWLEDGED: AndroidPurchase = { ...BOUGHT, isAcknowledgedAndroid: true };

/** One trace of saves, dispatches and acknowledges; `isSaved: false` is a refused save. */
function setup(isSaved = true) {
  const calls: string[] = [];
  const actions: PremiumAction[] = [];
  iap.finishTransaction.mockImplementation(({ purchase, isConsumable }) => {
    calls.push(`finish:${purchase.purchaseToken}${isConsumable ? ':consumed' : ''}`);
    return Promise.resolve();
  });
  const deps = {
    port: createExpoIapPurchaseAdapter(),
    productId: ID,
    dispatch: (action: PremiumAction) => {
      actions.push(action);
      calls.push(`dispatch:${action.type}`);
    },
    persistPremium: (change: PremiumChange) => {
      calls.push(`persist:${String(change.isPremium)}`);
      return isSaved;
    },
    formatPrice: (product: { readonly displayPrice: string }) => product.displayPrice,
    onError: () => undefined,
  };
  return { calls, actions, deps };
}

/** Play Billing's purchase listener, as the adapter subscribed it. */
function deliver(purchase: AndroidPurchase): void {
  const listener = iap.purchaseUpdatedListener.mock.calls.at(-1)?.[0];
  if (listener === undefined) throw new Error('the adapter never subscribed');
  listener(purchase);
}

async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
}

// Spec 8.9: "After a purchase, the Shell stores "Premium = yes" on the phone."
describe('Premium through Google Play Billing', () => {
  it('runs where Platform.OS is android', () => {
    expect(Platform.OS).toBe('android');
  });

  it('acknowledges a purchase only after Premium is saved and granted, and never consumes it', async () => {
    const { calls, deps } = setup();
    await startPremium(deps);
    deliver(BOUGHT);
    await settle();

    expect(calls.slice(-3)).toStrictEqual([
      'persist:true',
      'dispatch:premium-granted',
      'finish:token-1',
    ]);
  });

  it('leaves the purchase unacknowledged while its save is refused', async () => {
    const { calls, deps } = setup(false);
    await startPremium(deps);
    deliver(BOUGHT);
    await settle();

    expect(calls).not.toContain('finish:token-1');
  });

  it('waits for approval on a pending purchase, granting and acknowledging nothing', async () => {
    const { calls, actions, deps } = setup();
    await startPremium(deps);
    deliver(PENDING);
    await settle();

    expect(actions.at(-1)).toStrictEqual({ type: 'purchase-pending' });
    expect(
      calls.filter((call) => call.startsWith('persist') || call.startsWith('finish')),
    ).toStrictEqual([]);
  });

  it('grants Premium without a tap once the pending purchase is approved, then acknowledges it', async () => {
    const { calls, deps } = setup();
    await startPremium(deps);
    deliver(PENDING);
    await settle();
    deliver(BOUGHT);
    await settle();

    expect(calls.slice(-4)).toStrictEqual([
      'dispatch:purchase-pending',
      'persist:true',
      'dispatch:premium-granted',
      'finish:token-1',
    ]);
  });

  it('acknowledges at the launch re-check a saved purchase Play still holds unacknowledged', async () => {
    iap.getAvailablePurchases.mockResolvedValueOnce([BOUGHT]);
    const { calls, deps } = setup();
    await startPremium(deps);

    expect(calls.slice(-3)).toStrictEqual([
      'persist:true',
      'dispatch:entitlements-checked',
      'finish:token-1',
    ]);
  });

  it('leaves alone at the launch re-check a purchase Play already holds as acknowledged', async () => {
    iap.getAvailablePurchases.mockResolvedValueOnce([ACKNOWLEDGED]);
    const { calls, deps } = setup();
    await startPremium(deps);

    expect(calls).toContain('persist:true');
    expect(calls).not.toContain('finish:token-1');
  });

  it('grants and acknowledges nothing for a pending purchase the launch re-check finds', async () => {
    iap.getAvailablePurchases.mockResolvedValueOnce([PENDING]);
    const { calls, deps } = setup();
    await startPremium(deps);

    expect(
      calls.filter((call) => call.startsWith('persist') || call.startsWith('finish')),
    ).toStrictEqual([]);
  });

  it('keeps Premium when a later query no longer lists it (a refund leaves no dated proof)', async () => {
    iap.getAvailablePurchases.mockResolvedValueOnce([]);
    const { calls, actions, deps } = setup();
    await startPremium(deps);

    expect(calls).not.toContain('persist:false');
    expect(actions.at(-1)).toStrictEqual({ type: 'entitlements-checked', evidence: 'unknown' });
  });

  it('restores Premium from a successful query that lists it', async () => {
    iap.getAvailablePurchases.mockResolvedValueOnce([ACKNOWLEDGED]);
    const { actions, deps } = setup();
    await restorePremium(deps);

    expect(actions.at(-1)).toStrictEqual({ type: 'restore-finished', evidence: 'owned' });
  });

  it('tells "nothing to restore" only after a successful query', async () => {
    iap.getAvailablePurchases.mockResolvedValueOnce([]);
    const { actions, deps } = setup();
    await restorePremium(deps);

    expect(actions.at(-1)).toStrictEqual({ type: 'restore-finished', evidence: 'unknown' });
  });

  it('tells "could not restore" when Play billing is unavailable or offline', async () => {
    iap.restorePurchases.mockRejectedValueOnce({ code: iap.ErrorCode['BillingUnavailable'] });
    const { actions, deps } = setup();
    await restorePremium(deps);

    expect(actions.at(-1)).toStrictEqual({ type: 'restore-finished', evidence: 'sync-failed' });
  });

  it('asks Play for the one managed product of the game', async () => {
    const { deps } = setup();
    await buyPremium(deps);

    expect(iap.requestPurchase).toHaveBeenCalledWith({
      request: { apple: { sku: ID }, google: { skus: [ID] } },
      type: 'in-app',
    });
  });

  it('shows "store unavailable" on a phone without Play billing', async () => {
    iap.initConnection.mockRejectedValueOnce({ code: iap.ErrorCode['BillingUnavailable'] });
    const { actions, deps } = setup();
    await startPremium(deps);

    expect(actions).toContainEqual({ type: 'store-unavailable' });
  });
});
