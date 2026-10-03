// packages/shell/src/stores/premium/premium-notice.test.ts
import { premiumNotice } from './premium-notice.ts';
import { premiumReducer } from './premium-reducer.ts';
import { initialPremiumState } from './premium-state.ts';

import type { PremiumAction, PremiumState } from './premium-state.ts';

const READY: readonly PremiumAction[] = [{ type: 'price-loaded', price: '€1.99' }];

function run(actions: readonly PremiumAction[], isPremium = false): PremiumState {
  return actions.reduce(premiumReducer, initialPremiumState(isPremium));
}

describe('premiumNotice', () => {
  it('shows no toast on the normal page', () => {
    expect(premiumNotice(run(READY))).toBeNull();
  });

  it.each([
    ['restoring', [...READY, { type: 'restore-tapped' }]],
    [
      'restore-empty',
      [...READY, { type: 'restore-tapped' }, { type: 'restore-finished', evidence: 'unknown' }],
    ],
    [
      'restore-failed',
      [...READY, { type: 'restore-tapped' }, { type: 'restore-finished', evidence: 'sync-failed' }],
    ],
    [
      'restore-success',
      [...READY, { type: 'restore-tapped' }, { type: 'restore-finished', evidence: 'owned' }],
    ],
  ] as const)('shows the %s toast', (notice, actions) => {
    expect(premiumNotice(run(actions))).toBe(notice);
  });

  it('shows the restored toast only once', () => {
    const restored = run([
      ...READY,
      { type: 'restore-tapped' },
      { type: 'restore-finished', evidence: 'owned' },
      { type: 'restore-notice-shown' },
    ]);
    expect(premiumNotice(restored)).toBeNull();
    expect(restored.isPremium).toBe(true);
  });
});
