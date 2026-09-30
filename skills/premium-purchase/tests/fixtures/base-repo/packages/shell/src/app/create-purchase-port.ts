// packages/shell/src/app/create-purchase-port.ts (fixture): the Shell builds the store port once.
import { withConnectivity } from '@e07/shell/services/purchase/connectivity-gated-purchase.ts';
import { createExpoIapPurchaseAdapter } from '@e07/shell/services/purchase/expo-iap-purchase-adapter.ts';

import type { PurchasePort } from '@e07/shell/services/purchase/purchase-port.ts';

export function createPurchasePort(isOnline: () => boolean): PurchasePort {
  return withConnectivity(createExpoIapPurchaseAdapter(), isOnline);
}
