// packages/shell/src/screens/premium/use-unseen-restore-outcome.test.tsx
import { act, renderHook } from '@testing-library/react-native';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/shallow';

import { premiumNotice } from '@e07/shell/stores/premium/premium-notice.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useUnseenRestoreOutcome } from './use-unseen-restore-outcome.ts';

import type { Evidence } from '@e07/shell/stores/premium/entitlement-evidence.ts';
import type { PremiumStore, PremiumStoreState } from '@e07/shell/stores/premium/premium-store.ts';

function premiumOf(state: PremiumStoreState) {
  const { isPremium, didJustPurchase, didJustRestore, flow } = state;
  return { isPremium, didJustPurchase, didJustRestore, flow };
}

/** The premium store after a restore that ended while S12 was closed (from Settings, say). */
function storeAfterRestore(evidence: Evidence | 'sync-failed' | null): PremiumStore {
  const { premium } = createShellWrapper().stores;
  const { dispatch } = premium.getState();
  dispatch({ type: 'price-loaded', price: '€1.99' });
  if (evidence === null) return premium;
  dispatch({ type: 'restore-tapped' });
  dispatch({ type: 'restore-finished', evidence });
  return premium;
}

function openS12(store: PremiumStore, isHeld = false) {
  return renderHook(() =>
    useUnseenRestoreOutcome(
      useStore(store, useShallow(premiumOf)),
      store.getState().dispatch,
      isHeld,
    ),
  );
}

// Spec S12: a restore's toast shows where the restore ended, never stale on a later visit.
describe('useUnseenRestoreOutcome', () => {
  it.each(['owned', 'unknown', 'sync-failed'] as const)(
    'opens S12 without the outcome of a restore that ended %s while it was closed',
    async (evidence) => {
      const store = storeAfterRestore(evidence);
      const { result } = await openS12(store);
      expect([premiumNotice(result.current), premiumNotice(store.getState())]).toStrictEqual([
        null,
        null,
      ]);
    },
  );

  it('shows a restore that ends while S12 is open', async () => {
    const store = storeAfterRestore(null);
    const { result } = await openS12(store);
    await act(() => {
      store.getState().dispatch({ type: 'restore-tapped' });
      store.getState().dispatch({ type: 'restore-finished', evidence: 'unknown' });
    });
    expect(premiumNotice(result.current)).toBe('restore-empty');
  });

  it('keeps the outcome a parity capture holds on its card', async () => {
    const store = storeAfterRestore('unknown');
    const { result } = await openS12(store, true);
    expect([premiumNotice(result.current), premiumNotice(store.getState())]).toStrictEqual([
      'restore-empty',
      'restore-empty',
    ]);
  });
});
