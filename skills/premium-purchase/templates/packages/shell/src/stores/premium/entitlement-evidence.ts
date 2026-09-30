// packages/shell/src/stores/premium/entitlement-evidence.ts
import type { StoreTransaction } from '@e07/shell/services/purchase/purchase-port.ts';

// 'unknown' means "no evidence either way": the cached entitlement stays.
export type Evidence = 'owned' | 'revoked' | 'unknown';

export function entitlementEvidence(
  transactions: readonly StoreTransaction[],
  productId: string,
): Evidence {
  const premium = transactions.filter((tx) => tx.productId === productId);
  if (premium.some((tx) => tx.state === 'purchased' && tx.revocationDateMs === null))
    return 'owned';
  if (premium.some((tx) => tx.revocationDateMs !== null)) return 'revoked';
  return 'unknown'; // absence is NOT evidence: fresh purchases can be briefly missing
}

// The newest revocation date of this product (0 when there is none). The save guard
// keeps Premium on unless the write carries this date.
export function latestRevocationMs(
  transactions: readonly StoreTransaction[],
  productId: string,
): number {
  return transactions
    .filter((tx) => tx.productId === productId)
    .reduce((latest, tx) => Math.max(latest, tx.revocationDateMs ?? 0), 0);
}
