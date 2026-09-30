// packages/shell/src/app/create-premium-deps.test.ts
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createFakePurchase } from '@e07/shell/services/purchase/fake-purchase.ts';
import { createShellStores } from '@e07/shell/stores/create-shell-stores.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';

import { createPremiumDeps } from './create-premium-deps.ts';

import type { PremiumInput } from './create-premium-deps.ts';

const PRODUCT = { productId: 'premium', displayPrice: '€1.99', price: 1.99, currency: 'EUR' };

function inputFor(): PremiumInput & { readonly calls: string[] } {
  const test = createTestSave();
  const calls: string[] = [];
  return {
    save: test.save,
    stores: createShellStores(test.save),
    clock: TEST_CLOCK,
    errorLog: createFakeErrorLog(),
    purchase: createFakePurchase({
      isConnected: true,
      product: PRODUCT,
      restoreResult: 'synced',
      transactions: [],
      calls,
    }),
    productId: 'premium',
    deviceLocales: [{ languageCode: 'de', languageScriptCode: null }],
    calls,
  };
}

describe('createPremiumDeps', () => {
  it('writes an owned Premium once, with the backup refreshed, and keeps its first date', () => {
    const input = inputFor();
    const deps = createPremiumDeps(input);
    deps.persistPremium({ isPremium: true });
    expect(input.save.doc().premium).toMatchObject({
      owned: true,
      ownedSinceMs: TEST_CLOCK.nowMs(),
    });
  });

  it('writes a revocation with its date so the save guard lets Premium go', () => {
    const input = inputFor();
    const deps = createPremiumDeps(input);
    deps.persistPremium({ isPremium: true });
    deps.persistPremium({ isPremium: false, revokedAtMs: 5 });
    expect(input.save.doc().premium).toMatchObject({ owned: false, revokedAtMs: 5 });
  });

  it('formats the price in the player language (System follows the phone) and records errors', () => {
    const input = inputFor();
    const deps = createPremiumDeps(input);
    expect(deps.formatPrice(PRODUCT)).toBe('1,99\u00a0€');
    deps.onError(new Error('store down'));
    expect(input.errorLog.entries()).toStrictEqual([
      expect.objectContaining({ source: 'purchase', message: 'store down' }),
    ]);
  });
});
