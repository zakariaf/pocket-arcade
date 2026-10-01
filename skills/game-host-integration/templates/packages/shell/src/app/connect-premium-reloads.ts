// packages/shell/src/app/connect-premium-reloads.ts
import { AppState } from 'react-native';

import { recheckPremium } from '@e07/shell/services/purchase/premium-service.ts';
import { loadStore, shouldReloadStore } from '@e07/shell/services/purchase/premium-store-flow.ts';

import type { ShellStores } from '@e07/shell/app/stores-context.tsx';
import type { ConnectivityPort } from '@e07/shell/services/connectivity/connectivity-port.ts';
import type { PremiumServiceDeps } from '@e07/shell/services/purchase/premium-service.ts';

/**
 * premium-purchase: a connectivity change reloads the store when shouldReloadStore says so (the
 * first network state arrives after startPremium asked, so a launch would otherwise keep "store
 * unavailable") and, once online, re-checks Premium: startPremium's launch re-check ran offline,
 * where absence is not evidence, so a refund or a revocation would otherwise wait for the next
 * foreground (found by the StoreKit harness, flow 02, on 2026-09-30). Coming back to the
 * foreground re-checks Premium when online.
 */
export function connectPremiumReloads(
  connectivity: ConnectivityPort,
  stores: ShellStores,
  premiumDeps: PremiumServiceDeps,
): void {
  connectivity.subscribe((isOnline) => {
    if (!shouldReloadStore(stores.premium.getState().flow.kind, isOnline)) return;
    const reload = loadStore(premiumDeps);
    const done = isOnline ? reload.then(async () => recheckPremium(premiumDeps)) : reload;
    done.catch(premiumDeps.onError);
  });
  AppState.addEventListener('change', (next) => {
    if (next === 'active' && connectivity.isOnline()) {
      recheckPremium(premiumDeps).catch(premiumDeps.onError);
    }
  });
}
