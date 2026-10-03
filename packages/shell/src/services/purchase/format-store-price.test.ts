// packages/shell/src/services/purchase/format-store-price.test.ts
import { formatStorePrice } from './format-store-price.ts';

// StoreKit's Decimal arrives as a binary double (verified: 1.9899999999999998 for 1.99).
// Intl puts a no-break space (U+00A0) between amount and currency sign.
const NBSP = String.fromCharCode(0xa0);
const PREMIUM = {
  productId: 'p',
  displayPrice: '€1.99',
  price: 1.9899999999999998,
  currency: 'EUR',
};

describe('formatStorePrice', () => {
  it.each([
    ['en', '€1.99'],
    ['de', `1,99${NBSP}€`],
    ['ckb-u-nu-arabext', `€${NBSP}۱٫۹۹`],
  ])('formats the store price for %s', (tag, expected) => {
    expect(formatStorePrice(PREMIUM, tag)).toBe(expected);
  });

  it('falls back to the store string without a numeric price', () => {
    expect(formatStorePrice({ ...PREMIUM, price: null }, 'fa-u-nu-arabext')).toBe('€1.99');
  });
});
