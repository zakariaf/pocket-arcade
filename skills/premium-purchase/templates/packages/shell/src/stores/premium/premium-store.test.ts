// packages/shell/src/stores/premium/premium-store.test.ts
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import { createPremiumStore } from './premium-store.ts';

describe('premium store', () => {
  it('starts from the saved entitlement', () => {
    const { save } = createTestSave();
    save.update((doc) => ({ ...doc, premium: { ...doc.premium, owned: true } }));

    expect(createPremiumStore(save).getState().isPremium).toBe(true);
  });

  it('publishes reducer results and never writes the save itself', () => {
    const { save, store } = createTestSave();
    const before = store.read('current');
    const premium = createPremiumStore(save);
    premium.getState().dispatch({ type: 'price-loaded', price: '€1.99' });

    expect(premium.getState().flow).toStrictEqual({ kind: 'ready', price: '€1.99' });
    expect(store.read('current')).toBe(before);
  });
});
