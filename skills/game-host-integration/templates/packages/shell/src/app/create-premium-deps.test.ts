// packages/shell/src/app/create-premium-deps.test.ts
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createFakePurchase } from '@e07/shell/services/purchase/fake-purchase.ts';
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { encodeSaveDoc } from '@e07/shell/services/save/save-codec.ts';
import { createSaveService } from '@e07/shell/services/save/save-service.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { createShellStores } from '@e07/shell/stores/create-shell-stores.ts';
import { createTestSave, TEST_CLOCK, TEST_GAME_ID } from '@e07/shell/testing/create-test-save.ts';

import { createPremiumDeps, persistPremiumIn } from './create-premium-deps.ts';

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

  // spec 8.9: "Premium is revoked only on an explicit, verified revocation". The save guard reads
  // revokedAtMs, so a purchase after a refund must clear the old date.
  it('clears an old refund date when Premium is bought again, so a later change cannot drop it', () => {
    const input = inputFor();
    const deps = createPremiumDeps(input);
    deps.persistPremium({ isPremium: true });
    deps.persistPremium({ isPremium: false, revokedAtMs: 5 });
    deps.persistPremium({ isPremium: true });
    expect(input.save.doc().premium).toMatchObject({ owned: true, revokedAtMs: null });
    input.save.update((doc) => ({ ...doc, premium: { ...doc.premium, owned: false } }));
    expect(input.save.doc().premium.owned).toBe(true);
  });

  // spec 8.9: "After a purchase, the Shell stores "Premium = yes" on the phone." A Premium change
  // the disk refused reports false, so the purchase stays unfinished and StoreKit delivers it again.
  it('reports a Premium change the disk refused as not saved, and a landed one as saved', () => {
    const store = createFakeSaveStore();
    const plan = planLoad({ current: null, backup: null, gameId: TEST_GAME_ID });
    const errorLog = createFakeErrorLog();
    const deps = { store, clock: TEST_CLOCK, errorLog, appVersion: '1.0.0', isStrict: true };
    const save = createSaveService(deps, plan, 0);
    save.applyLoadWrites();
    const persistPremium = persistPremiumIn(save, TEST_CLOCK);
    store.failNextWrite = true;
    expect(persistPremium({ isPremium: true })).toBe(false);
    expect(persistPremium({ isPremium: true })).toBe(true);
  });

  it('reports a Premium change on a save from a newer app as not saved, which is never written', () => {
    const newer = {
      ...encodeSaveDoc(createDefaultSaveDoc(TEST_GAME_ID), {
        appVersion: '9.0.0',
        writtenAtMs: 1,
        writeCount: 7,
      }),
      schemaVersion: 99,
    };
    const plan = planLoad({ current: newer, backup: null, gameId: TEST_GAME_ID });
    const errorLog = createFakeErrorLog();
    const deps = { store: createFakeSaveStore(), clock: TEST_CLOCK, errorLog, appVersion: '1.0.0' };
    const save = createSaveService({ ...deps, isStrict: true }, plan, 0);
    expect(persistPremiumIn(save, TEST_CLOCK)({ isPremium: true })).toBe(false);
  });

  it('reports a Premium change the save rejected as not saved', () => {
    const plan = planLoad({ current: null, backup: null, gameId: TEST_GAME_ID });
    const errorLog = createFakeErrorLog();
    const deps = { store: createFakeSaveStore(), clock: TEST_CLOCK, errorLog, appVersion: '1.0.0' };
    const save = createSaveService({ ...deps, isStrict: false }, plan, 0);
    save.applyLoadWrites();
    expect(persistPremiumIn(save, { nowMs: () => -1 })({ isPremium: true })).toBe(false);
  });

  // spec 8.9: "the Shell quietly re-checks the purchase with the store at app start and updates
  // the stored status". The re-check runs at launch, every foreground and reconnect: a status the
  // save already holds is not written to both slots again, and still counts as saved.
  it('writes neither slot when the save already holds Premium, and reports it as saved', () => {
    const test = createTestSave();
    const persistPremium = persistPremiumIn(test.save, TEST_CLOCK);
    persistPremium({ isPremium: true });
    const current = test.store.slots.get('current');
    const backup = test.store.slots.get('backup');
    expect(persistPremium({ isPremium: true })).toBe(true);
    expect(test.store.slots.get('current')).toBe(current);
    expect(test.store.slots.get('backup')).toBe(backup);
  });

  it('writes neither slot when the save already holds the same revocation', () => {
    const test = createTestSave();
    const persistPremium = persistPremiumIn(test.save, TEST_CLOCK);
    persistPremium({ isPremium: true });
    persistPremium({ isPremium: false, revokedAtMs: 5 });
    const current = test.store.slots.get('current');
    expect(persistPremium({ isPremium: false, revokedAtMs: 5 })).toBe(true);
    expect(test.store.slots.get('current')).toBe(current);
    persistPremium({ isPremium: false, revokedAtMs: 6 });
    expect(test.save.doc().premium.revokedAtMs).toBe(6);
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
