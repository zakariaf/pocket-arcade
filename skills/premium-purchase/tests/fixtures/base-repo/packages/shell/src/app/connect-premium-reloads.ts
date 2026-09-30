// packages/shell/src/app/connect-premium-reloads.ts (fixture: the composition root's two store reloads)
import { AppState } from 'react-native';

import { recheckPremium } from '@e07/shell/services/purchase/premium-service.ts';
import { loadStore, shouldReloadStore } from '@e07/shell/services/purchase/premium-store-flow.ts';

import type { ConnectivityPort } from '@e07/shell/services/connectivity/connectivity-port.ts';
import type { PremiumServiceDeps } from '@e07/shell/services/purchase/premium-service.ts';
import type { PremiumFlowKind } from '@e07/shell/stores/premium/premium-state.ts';

export function connectPremiumReloads(
  connectivity: ConnectivityPort,
  flowKind: () => PremiumFlowKind,
  premiumDeps: PremiumServiceDeps,
): void {
  connectivity.subscribe((isOnline) => {
    if (shouldReloadStore(flowKind(), isOnline)) loadStore(premiumDeps).catch(premiumDeps.onError);
  });
  AppState.addEventListener('change', (next) => {
    if (next === 'active' && connectivity.isOnline()) {
      recheckPremium(premiumDeps).catch(premiumDeps.onError);
    }
  });
}
