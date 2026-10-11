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

  // Spec S12: the restore toasts belong to the page that saw the restore end; S12 clears one it
  // finds when it opens (a restore from Settings, or a visit before), so it never shows stale.
  it.each([
    ['Purchase restored', [{ type: 'restore-finished', evidence: 'owned' }]],
    ['nothing to restore', [{ type: 'restore-finished', evidence: 'unknown' }]],
    ['could not restore', [{ type: 'restore-finished', evidence: 'sync-failed' }]],
  ] as const)('clears a "%s" outcome nobody saw, and the page sells again', (_, finished) => {
    const cleared = run([
      ...READY,
      { type: 'restore-tapped' },
      ...finished,
      { type: 'restore-outcome-cleared' },
    ]);
    expect([premiumNotice(cleared), cleared.flow]).toStrictEqual([
      null,
      { kind: 'ready', price: '€1.99' },
    ]);
  });

  it('leaves a running restore and a page without an outcome as they are', () => {
    const restoring = run([...READY, { type: 'restore-tapped' }]);
    const ready = run(READY);
    expect([
      premiumReducer(restoring, { type: 'restore-outcome-cleared' }),
      premiumReducer(ready, { type: 'restore-outcome-cleared' }),
    ]).toStrictEqual([restoring, ready]);
  });
});
