// packages/shell/src/services/purchase/premium-store-flow.ts
import { processPurchaseEvent, recheckPremium } from './premium-service.ts';

import type { PremiumServiceDeps } from './premium-service.ts';
import type { PremiumFlow } from '@e07/shell/stores/premium/premium-state.ts';

// Pages a connectivity change may reload; never during loading, a purchase or a restore.
const QUIET_FLOWS: ReadonlySet<PremiumFlow['kind']> = new Set([
  'ready',
  'failed',
  'restore-empty',
  'restore-failed',
]);

// ConnectivityPort changed: reload when the phone came back online while S12 says "unavailable",
// or when it went offline from a quiet page (the gated port then reports "store unavailable").
export function shouldReloadStore(flow: PremiumFlow['kind'], isOnline: boolean): boolean {
  return isOnline ? flow === 'unavailable' : QUIET_FLOWS.has(flow);
}

// initConnection -> fetchProducts (empty => "store unavailable") -> price. Rerun by the
// ConnectivityPort subscription whenever shouldReloadStore() says so.
export async function loadStore(deps: PremiumServiceDeps): Promise<void> {
  deps.dispatch({ type: 'connect-started' });
  try {
    const isConnected = await deps.port.connect();
    const product = isConnected ? await deps.port.fetchProduct(deps.productId) : null;
    if (product === null) {
      deps.dispatch({ type: 'store-unavailable' });
      return;
    }
    deps.dispatch({ type: 'price-loaded', price: deps.formatPrice(product) });
  } catch (error) {
    deps.onError(error);
    deps.dispatch({ type: 'store-unavailable' });
  }
}

// App start: listen FIRST (StoreKit replays unfinished and approved Ask-to-Buy transactions
// right after connecting), then load the price, then re-check silently.
export async function startPremium(deps: PremiumServiceDeps): Promise<() => void> {
  const unsubscribe = deps.port.subscribe((event) => {
    processPurchaseEvent(deps, event).catch(deps.onError);
  });
  await loadStore(deps);
  await recheckPremium(deps);
  return unsubscribe;
}

export async function buyPremium(deps: PremiumServiceDeps): Promise<void> {
  deps.dispatch({ type: 'buy-tapped' });
  await deps.port.requestPurchase(deps.productId); // outcome arrives via subscribe()
}
