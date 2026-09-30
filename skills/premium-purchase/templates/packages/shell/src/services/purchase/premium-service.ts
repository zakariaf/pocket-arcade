// packages/shell/src/services/purchase/premium-service.ts
import {
  entitlementEvidence,
  latestRevocationMs,
} from '@e07/shell/stores/premium/entitlement-evidence.ts';

import type {
  PurchaseEvent,
  PurchasePort,
  StoreProduct,
  StoreTransaction,
} from './purchase-port.ts';
import type { Evidence } from '@e07/shell/stores/premium/entitlement-evidence.ts';
import type { PremiumAction } from '@e07/shell/stores/premium/premium-state.ts';

// What the save's `premium` section records. A revocation carries its date (the save guard
// keeps Premium on unless a revoke comes with a date).
export type PremiumChange =
  { readonly isPremium: true } | { readonly isPremium: false; readonly revokedAtMs: number };

export type PremiumServiceDeps = {
  readonly port: PurchasePort;
  readonly productId: string; // from game config, e.g. '<bundleId>.premium'
  readonly dispatch: (action: PremiumAction) => void;
  // Synchronous SQLite write into the premium section ("Reset all progress" keeps it).
  readonly persistPremium: (change: PremiumChange) => void;
  readonly formatPrice: (product: StoreProduct) => string;
  readonly onError: (error: unknown) => void; // ErrorLogPort
};

// Saves explicit evidence only ('unknown' changes nothing) and returns it.
function applyEvidence(
  deps: PremiumServiceDeps,
  transactions: readonly StoreTransaction[],
): Evidence {
  const evidence = entitlementEvidence(transactions, deps.productId);
  if (evidence === 'owned') deps.persistPremium({ isPremium: true });
  if (evidence === 'revoked') {
    const revokedAtMs = latestRevocationMs(transactions, deps.productId);
    deps.persistPremium({ isPremium: false, revokedAtMs });
  }
  return evidence;
}

// Launch, foreground and after an explicit revocation event. Errors keep the cached state.
export async function recheckPremium(deps: PremiumServiceDeps): Promise<void> {
  try {
    const evidence = applyEvidence(deps, await deps.port.readTransactions());
    deps.dispatch({ type: 'entitlements-checked', evidence });
  } catch (error) {
    deps.onError(error);
  }
}

async function finishQuietly(deps: PremiumServiceDeps, tx: StoreTransaction): Promise<void> {
  try {
    await deps.port.finish(tx);
  } catch (error) {
    deps.onError(error); // unfinished transactions are re-delivered at the next launch
  }
}

export async function processTransaction(
  deps: PremiumServiceDeps,
  tx: StoreTransaction,
): Promise<void> {
  if (tx.productId !== deps.productId) return;
  if (tx.state === 'pending') {
    deps.dispatch({ type: 'purchase-pending' });
    return;
  }
  if (tx.revocationDateMs !== null) {
    await recheckPremium(deps); // a newer, valid purchase still wins
    await finishQuietly(deps, tx);
    return;
  }
  deps.persistPremium({ isPremium: true }); // 1. the save is written (sync) ...
  deps.dispatch({ type: 'premium-granted' }); // 2. ads vanish everywhere at once ...
  await finishQuietly(deps, tx); // 3. ... and only then StoreKit may forget the transaction.
}

const SYNC_FAILED = 'sync-failed';

async function syncAndReadEvidence(
  deps: PremiumServiceDeps,
): Promise<Evidence | typeof SYNC_FAILED> {
  if ((await deps.port.restore()) === SYNC_FAILED) return SYNC_FAILED;
  try {
    return applyEvidence(deps, await deps.port.readTransactions());
  } catch (error) {
    deps.onError(error);
    return SYNC_FAILED;
  }
}

// S12 and Settings "Restore purchase": AppStore.sync(), then read the verified transactions.
export async function restorePremium(deps: PremiumServiceDeps): Promise<void> {
  deps.dispatch({ type: 'restore-tapped' });
  const evidence = await syncAndReadEvidence(deps);
  deps.dispatch({ type: 'restore-finished', evidence });
}

export async function processPurchaseEvent(
  deps: PremiumServiceDeps,
  event: PurchaseEvent,
): Promise<void> {
  if (event.type === 'transaction') {
    await processTransaction(deps, event.transaction);
    return;
  }
  deps.dispatch({ type: 'purchase-failed', failure: event.failure });
  if (event.failure === 'already-owned') await restorePremium(deps);
}
