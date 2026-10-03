// packages/shell/src/stores/premium/premium-transitions.test.ts
import { initialPremiumState } from './premium-state.ts';
import {
  onEntitlementsChecked,
  onGranted,
  onPurchaseFailed,
  onRestoreFinished,
} from './premium-transitions.ts';

import type { PremiumState } from './premium-state.ts';

const PRICE = '€1.99';
const READY: PremiumState = {
  ...initialPremiumState(false),
  flow: { kind: 'ready', price: PRICE },
};
const BUYING: PremiumState = { ...READY, flow: { kind: 'purchasing', price: PRICE } };

describe('premium transitions', () => {
  it('ignores a purchase failure when no purchase is in flight', () => {
    expect(onPurchaseFailed(READY, 'failed')).toBe(READY);
  });

  it('turns a deferred purchase into pending (Ask to Buy)', () => {
    expect(onPurchaseFailed(BUYING, 'deferred').flow).toStrictEqual({
      kind: 'pending',
      price: PRICE,
    });
  });

  it('shows "restored", never the thank-you, after a restore finds Premium', () => {
    const state = onRestoreFinished({ ...BUYING, didJustPurchase: true }, 'owned');

    expect(state).toStrictEqual({
      isPremium: true,
      didJustPurchase: false,
      didJustRestore: true,
      flow: { kind: 'ready', price: PRICE },
    });
  });

  it('keeps Premium when a restore sync succeeds with no evidence', () => {
    const owned = { ...READY, isPremium: true };

    expect(onRestoreFinished(owned, 'unknown').isPremium).toBe(true);
  });

  it('changes the entitlement only on explicit evidence', () => {
    const owned = { ...READY, isPremium: true };

    expect(onEntitlementsChecked(owned, 'unknown')).toBe(owned);
    expect(onEntitlementsChecked(owned, 'revoked').isPremium).toBe(false);
  });

  it('plays the thank-you only when the grant ends a purchase', () => {
    expect([onGranted(BUYING).didJustPurchase, onGranted(READY).didJustPurchase]).toStrictEqual([
      true,
      false,
    ]);
  });
});
