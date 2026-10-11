// packages/shell/src/stores/premium/premium-reducer.test.ts
import { premiumNotice } from './premium-notice.ts';
import { canBuyPremium, premiumReducer } from './premium-reducer.ts';
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

describe('premiumReducer debug switch', () => {
  it('clears the restored toast as well as the thank-you when the debug switch sets Premium', () => {
    const restored = run([
      ...READY,
      { type: 'restore-tapped' },
      { type: 'restore-finished', evidence: 'owned' },
    ]);
    expect(restored.didJustRestore).toBe(true);
    const switched = premiumReducer(restored, { type: 'debug-premium-set', isPremium: true });
    expect([switched.didJustPurchase, switched.didJustRestore]).toStrictEqual([false, false]);
  });
});

// spec 8.9: "When online, the Shell quietly re-checks the purchase with the store at app start and
// updates the stored status". It runs at launch, every foreground and reconnect, so a re-check that
// changes nothing hands back the same state and the store publishes nothing.
describe('premiumReducer silent re-check', () => {
  it('returns the same state when the re-check confirms the Premium it already shows', () => {
    const owned = run(READY, true);
    expect(premiumReducer(owned, { type: 'entitlements-checked', evidence: 'owned' })).toBe(owned);
  });

  it('returns the same state when the re-check confirms a revocation it already shows', () => {
    const notOwned = run(READY);
    const checked = premiumReducer(notOwned, { type: 'entitlements-checked', evidence: 'revoked' });
    expect(checked).toBe(notOwned);
  });
});

// spec S12: BUY starts a purchase only when the store has given a price and the page sells (not
// while loading, buying, waiting for approval or restoring); the S12 Buy key reads the same rule.
describe('canBuyPremium', () => {
  it.each([
    ['ready', READY, true],
    ['error', [...BUYING, { type: 'purchase-failed', failure: 'failed' }], true],
    [
      'restore-empty',
      [...READY, { type: 'restore-tapped' }, { type: 'restore-finished', evidence: 'unknown' }],
      true,
    ],
    ['loading-price', [], false],
    ['restoring', [...READY, { type: 'restore-tapped' }], false],
    ['purchase-in-progress', BUYING, false],
    ['pending', [...BUYING, { type: 'purchase-pending' }], false],
    ['store-unavailable', [{ type: 'store-unavailable' }], false],
  ] as const)('answers for %s', (view, actions, canBuy) => {
    const state = run(actions);
    expect([premiumView(state), canBuyPremium(state)]).toStrictEqual([view, canBuy]);
  });

  it('refuses a restore page without a price and a Premium owner', () => {
    const early = run([
      { type: 'restore-tapped' },
      { type: 'restore-finished', evidence: 'unknown' },
    ]);
    expect([premiumView(early), canBuyPremium(early)]).toStrictEqual(['restore-empty', false]);
    expect(canBuyPremium(run(READY, true))).toBe(false);
  });
});

describe('premiumReducer around a restore', () => {
  it('keeps a price that loads while a restore runs or after it, so BUY can show it', () => {
    const during = run([
      { type: 'restore-tapped' },
      { type: 'price-loaded', price: PRICE },
      { type: 'restore-finished', evidence: 'unknown' },
    ]);
    const after = run([
      { type: 'restore-tapped' },
      { type: 'restore-finished', evidence: 'sync-failed' },
      { type: 'price-loaded', price: PRICE },
    ]);
    expect([during.flow, after.flow]).toStrictEqual([
      { kind: 'restore-empty', price: PRICE },
      { kind: 'restore-failed', price: PRICE },
    ]);
  });

  it.each(['unknown', 'revoked', 'sync-failed'] as const)(
    'comes back to "waiting for approval" when a restore during Ask to Buy ends %s (spec S12)',
    (evidence) => {
      const pending = run([...BUYING, { type: 'purchase-pending' }, { type: 'restore-tapped' }]);
      expect(canBuyPremium(pending)).toBe(false);
      const back = premiumReducer(pending, { type: 'restore-finished', evidence });
      expect(back.flow).toStrictEqual({ kind: 'pending', price: PRICE });
    },
  );

  it('turns Premium on when that restore finds the purchase, or when the approval arrives', () => {
    const pending = run([...BUYING, { type: 'purchase-pending' }, { type: 'restore-tapped' }]);
    const restored = premiumReducer(pending, { type: 'restore-finished', evidence: 'owned' });
    const approved = premiumReducer(pending, { type: 'premium-granted' });
    expect([premiumView(restored), premiumView(approved)]).toStrictEqual([
      'already-owned',
      'success',
    ]);
  });

  it('keeps the thank-you when the approval arrives before that restore finds the purchase (spec S12 Pending: "Premium turns on automatically when it completes")', () => {
    const approved = run([
      ...BUYING,
      { type: 'purchase-pending' },
      { type: 'restore-tapped' },
      { type: 'premium-granted' },
      { type: 'restore-finished', evidence: 'owned' },
    ]);
    expect([premiumView(approved), premiumNotice(approved)]).toStrictEqual(['success', null]);
  });

  it('ignores a second restore tap while one runs, so Ask to Buy stays outstanding and BUY stays locked (spec S12 Pending)', () => {
    const twice = run([
      ...BUYING,
      { type: 'purchase-pending' },
      { type: 'restore-tapped' },
      { type: 'restore-tapped' },
    ]);
    expect(twice.flow).toStrictEqual({ kind: 'restoring', price: PRICE, isAwaitingApproval: true });
    const bothEnded = run([
      ...BUYING,
      { type: 'purchase-pending' },
      { type: 'restore-tapped' },
      { type: 'restore-tapped' },
      { type: 'restore-finished', evidence: 'unknown' },
      { type: 'restore-finished', evidence: 'unknown' },
    ]);
    expect([bothEnded.flow, canBuyPremium(bothEnded)]).toStrictEqual([
      { kind: 'pending', price: PRICE },
      false,
    ]);
  });

  it.each(['unknown', 'sync-failed'] as const)(
    'lets a restore that ends %s after the page moved on change nothing the player sees',
    (evidence) => {
      const approved = run([
        ...BUYING,
        { type: 'purchase-pending' },
        { type: 'restore-tapped' },
        { type: 'premium-granted' },
      ]);
      expect(premiumReducer(approved, { type: 'restore-finished', evidence })).toBe(approved);
    },
  );

  it('applies a refund that a restore finishing after the page moved on finds, and stays waiting for approval', () => {
    const waiting = run([
      ...BUYING,
      { type: 'purchase-pending' },
      { type: 'restore-tapped' },
      { type: 'restore-tapped' },
      { type: 'restore-finished', evidence: 'unknown' },
    ]);
    const revoked = premiumReducer(
      { ...waiting, isPremium: true },
      { type: 'restore-finished', evidence: 'revoked' },
    );
    expect([revoked.isPremium, revoked.flow]).toStrictEqual([
      false,
      { kind: 'pending', price: PRICE },
    ]);
  });
});
