// packages/shell/src/stores/premium/premium-flow.android.test.ts — the Premium flow where
// Platform.OS is 'android' (the unit-android project): the real save, the Shell stores, the
// composition root's Premium dependencies and the expo-iap adapter behind withConnectivity, with
// Play Billing's purchase shape from the root expo-iap mock. Lint bans importing the SDK in tests,
// so the test reads the mock with jest.requireMock (after an explicit jest.mock).
import { Platform } from 'react-native';

import { createPremiumDeps } from '@e07/shell/app/create-premium-deps.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { withConnectivity } from '@e07/shell/services/purchase/connectivity-gated-purchase.ts';
import { createExpoIapPurchaseAdapter } from '@e07/shell/services/purchase/expo-iap-purchase-adapter.ts';
import { buyPremium, startPremium } from '@e07/shell/services/purchase/premium-store-flow.ts';
import { createShellStores } from '@e07/shell/stores/create-shell-stores.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';

import { premiumView } from './premium-view.ts';

jest.mock('expo-iap');

type AndroidPurchase = {
  readonly id: string;
  readonly transactionId: string | null;
  readonly productId: string;
  readonly purchaseState: 'pending' | 'purchased';
  readonly isAcknowledgedAndroid: boolean;
  readonly purchaseToken: string;
  readonly platform: 'android';
};
type Finish = (request: { purchase: AndroidPurchase; isConsumable: boolean }) => Promise<void>;
type MockedIap = {
  readonly initConnection: jest.Mock<Promise<boolean>>;
  readonly fetchProducts: jest.Mock<Promise<readonly unknown[]>>;
  readonly getAvailablePurchases: jest.Mock<Promise<readonly AndroidPurchase[]>>;
  readonly finishTransaction: jest.Mock<Promise<void>, Parameters<Finish>>;
  readonly purchaseUpdatedListener: jest.Mock<
    { remove: () => void },
    [(purchase: AndroidPurchase) => void]
  >;
};

const iap = jest.requireMock<MockedIap>('expo-iap');

const ID = 'io.applander.linesiege.premium';
const PLAY_PRODUCT = { id: ID, displayPrice: '€1.99', price: 1.99, currency: 'EUR' };
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

type Setup = {
  readonly isOwned?: boolean;
  readonly isOnline?: boolean;
  readonly deviceLanguage?: string;
};

/** A launch of the app: the save (Premium owned or not), the stores and the gated store port. */
function launch(options: Setup = {}) {
  const { save } = createTestSave();
  if (options.isOwned === true) {
    save.update((doc) => ({
      ...doc,
      premium: { ...doc.premium, owned: true, ownedSinceMs: TEST_CLOCK.nowMs() },
    }));
  }
  const stores = createShellStores(save);
  const isOnline = options.isOnline ?? true;
  const acknowledged: { readonly token: string; readonly wasSaved: boolean }[] = [];
  iap.fetchProducts.mockResolvedValue([PLAY_PRODUCT]);
  iap.finishTransaction.mockImplementation(({ purchase, isConsumable }) => {
    if (isConsumable) throw new Error('Premium must never be consumed');
    acknowledged.push({ token: purchase.purchaseToken, wasSaved: save.doc().premium.owned });
    return Promise.resolve();
  });
  const deps = createPremiumDeps({
    save,
    stores,
    clock: TEST_CLOCK,
    errorLog: createFakeErrorLog(TEST_CLOCK),
    purchase: withConnectivity(createExpoIapPurchaseAdapter(), () => isOnline),
    productId: ID,
    deviceLocales: [{ languageCode: options.deviceLanguage ?? 'en', languageScriptCode: null }],
  });
  const premium = () => stores.premium.getState();
  return { save, deps, premium, acknowledged };
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

// Spec 8.9 and N7: one Premium purchase, no server; "After a purchase, the Shell stores
// "Premium = yes" on the phone."
describe('the Premium flow on Android', () => {
  it('runs where Platform.OS is android', () => {
    expect(Platform.OS).toBe('android');
  });

  it('listens to Play purchases before it connects to billing', async () => {
    const { deps } = launch();
    await startPremium(deps);
    const [listened] = iap.purchaseUpdatedListener.mock.invocationCallOrder;
    const [connected] = iap.initConnection.mock.invocationCallOrder;
    expect(listened).toBeLessThan(connected ?? 0);
  });

  it('waits for approval on a pending purchase, then turns Premium on without a tap', async () => {
    const { save, deps, premium, acknowledged } = launch();
    await startPremium(deps);
    await buyPremium(deps);

    deliver(PENDING);
    await settle();
    expect(premiumView(premium())).toBe('pending');
    expect(save.doc().premium.owned).toBe(false);
    expect(acknowledged).toStrictEqual([]);

    deliver(BOUGHT);
    await settle();
    expect(premium().isPremium).toBe(true);
    expect(save.doc().premium.owned).toBe(true);
    expect(acknowledged).toStrictEqual([{ token: 'token-1', wasSaved: true }]);
  });

  it('acknowledges at launch a saved Premium purchase Play still holds unacknowledged', async () => {
    iap.getAvailablePurchases.mockResolvedValueOnce([BOUGHT]);
    const { deps, premium, acknowledged } = launch({ isOwned: true });
    await startPremium(deps);

    expect(acknowledged).toStrictEqual([{ token: 'token-1', wasSaved: true }]);
    expect(premiumView(premium())).toBe('already-owned');
  });

  it("shows Play's price in the player's digits (spec S12)", async () => {
    const { deps, premium } = launch({ deviceLanguage: 'fa' });
    await startPremium(deps);

    const { flow } = premium();
    expect(flow.kind).toBe('ready');
    expect(flow.kind === 'ready' ? flow.price : '').toContain('€۱٫۹۹');
    expect(flow.kind === 'ready' ? flow.price : '').not.toMatch(/[0-9]/);
  });

  it('keeps the cached Premium offline, asking Play nothing', async () => {
    const { save, deps, premium, acknowledged } = launch({ isOwned: true, isOnline: false });
    await startPremium(deps);

    expect(premium().isPremium).toBe(true);
    expect(save.doc().premium.owned).toBe(true);
    expect(iap.initConnection).not.toHaveBeenCalled();
    expect(iap.getAvailablePurchases).not.toHaveBeenCalled();
    expect(acknowledged).toStrictEqual([]);
  });
});
