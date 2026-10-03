// packages/shell/src/stores/premium/entitlement-evidence.test.ts
import { entitlementEvidence } from './entitlement-evidence.ts';

import type { StoreTransaction } from '@e07/shell/services/purchase/purchase-port.ts';

const ID = 'io.applander.linesiege.premium';

function tx(transactionId: string, revocationDateMs: number | null): StoreTransaction {
  return { productId: ID, transactionId, state: 'purchased', revocationDateMs, handle: null };
}

describe('entitlementEvidence', () => {
  it('treats absence as no evidence, never as a revocation', () => {
    expect(entitlementEvidence([], ID)).toBe('unknown');
  });

  it('reports a refunded purchase as revoked', () => {
    expect(entitlementEvidence([tx('1', 1_700_000_000_000)], ID)).toBe('revoked');
  });

  it('lets a newer valid purchase win over an old refund', () => {
    expect(entitlementEvidence([tx('1', 1_700_000_000_000), tx('2', null)], ID)).toBe('owned');
  });

  it('ignores other products', () => {
    expect(entitlementEvidence([{ ...tx('3', null), productId: 'other' }], ID)).toBe('unknown');
  });
});
