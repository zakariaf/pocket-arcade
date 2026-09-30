// packages/shell/src/stores/premium/premium-reducer.test.ts
import { premiumReducer } from './premium-reducer.ts';
import { initialPremiumState } from './premium-state.ts';
import { premiumView } from './premium-view.ts';

import type { PremiumAction, PremiumState } from './premium-state.ts';

const PRICE = '€1.99';

function run(actions: readonly PremiumAction[], isPremium = false): PremiumState {
  return actions.reduce(premiumReducer, initialPremiumState(isPremium));
}

const READY: readonly PremiumAction[] = [{ type: 'price-loaded', price: PRICE }];
const BUYING: readonly PremiumAction[] = [...READY, { type: 'buy-tapped' }];

describe('premiumReducer maps every S12 state', () => {
  it.each([
    ['loading-price', []],
    ['store-unavailable', [{ type: 'store-unavailable' }]],
    ['ready', READY],
    ['purchase-in-progress', BUYING],
    ['pending', [...BUYING, { type: 'purchase-failed', failure: 'deferred' }]],
    ['pending', [...BUYING, { type: 'purchase-pending' }]],
    ['success', [...BUYING, { type: 'premium-granted' }]],
    ['ready', [...BUYING, { type: 'purchase-failed', failure: 'cancelled' }]],
    ['error', [...BUYING, { type: 'purchase-failed', failure: 'failed' }]],
    ['store-unavailable', [...BUYING, { type: 'purchase-failed', failure: 'unavailable' }]],
    ['restoring', [...BUYING, { type: 'purchase-failed', failure: 'already-owned' }]],
    [
      'restore-empty',
      [...READY, { type: 'restore-tapped' }, { type: 'restore-finished', evidence: 'unknown' }],
    ],
    [
      'restore-failed',
      [...READY, { type: 'restore-tapped' }, { type: 'restore-finished', evidence: 'sync-failed' }],
    ],
    [
      'already-owned',
      [...READY, { type: 'restore-tapped' }, { type: 'restore-finished', evidence: 'owned' }],
    ],
  ] as const)('reaches %s', (view, actions) => {
    expect(premiumView(run(actions))).toBe(view);
  });

  it('shows the thank-you once, then "Premium - active"', () => {
    const state = run([...BUYING, { type: 'premium-granted' }, { type: 'thanks-shown' }]);
    expect(premiumView(state)).toBe('already-owned');
  });

  it('ignores a duplicated failure (iOS rejects AND emits on the error listener)', () => {
    const once = run([...BUYING, { type: 'purchase-failed', failure: 'deferred' }]);
    const twice = premiumReducer(once, { type: 'purchase-failed', failure: 'failed' });
    expect(premiumView(twice)).toBe('pending');
  });

  it('keeps Premium when the silent re-check finds no evidence', () => {
    const state = run([{ type: 'entitlements-checked', evidence: 'unknown' }], true);
    expect(state.isPremium).toBe(true);
  });

  it('revokes Premium only on explicit revocation evidence', () => {
    expect(run([{ type: 'entitlements-checked', evidence: 'revoked' }], true).isPremium).toBe(
      false,
    );
  });

  it('starts over at "loading price" when the store reconnects', () => {
    expect(premiumView(run([...READY, { type: 'connect-started' }]))).toBe('loading-price');
  });

  it('ignores a late price once the store was found unavailable', () => {
    const late = run([{ type: 'store-unavailable' }, { type: 'price-loaded', price: PRICE }]);
    expect(premiumView(late)).toBe('store-unavailable');
  });

  it('turns an approved Ask-to-Buy into the thank-you state', () => {
    const approved = run([...BUYING, { type: 'purchase-pending' }, { type: 'premium-granted' }]);
    expect(premiumView(approved)).toBe('success');
  });

  it('shows "Premium - active" after a restore, never the purchase thank-you', () => {
    const bought = run([...BUYING, { type: 'premium-granted' }]);
    const restored = [
      { type: 'restore-tapped' },
      { type: 'restore-finished', evidence: 'owned' },
    ] as const;
    expect(premiumView(restored.reduce(premiumReducer, bought))).toBe('already-owned');
  });

  it('lets the test-build debug switch set Premium without a purchase', () => {
    expect(premiumView(run([...READY, { type: 'debug-premium-set', isPremium: true }]))).toBe(
      'already-owned',
    );
    expect(run([{ type: 'debug-premium-set', isPremium: false }], true).isPremium).toBe(false);
  });

  it('shows no thank-you for a purchase delivered at launch', () => {
    expect(premiumView(run([{ type: 'premium-granted' }]))).toBe('already-owned');
  });

  it('ignores BUY while offline or already Premium', () => {
    expect(premiumView(run([{ type: 'store-unavailable' }, { type: 'buy-tapped' }]))).toBe(
      'store-unavailable',
    );
    expect(run([...READY, { type: 'buy-tapped' }], true).flow.kind).toBe('ready');
  });
});
