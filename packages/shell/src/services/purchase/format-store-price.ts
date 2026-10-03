// packages/shell/src/services/purchase/format-store-price.ts
import type { StoreProduct } from './purchase-port.ts';

// Price exactly as the store sells it (currency and amount), shown in the player's digits.
// Falls back to the store's own string when it gives no numeric price. Never typed in code.
export function formatStorePrice(product: StoreProduct, localeTag: string): string {
  if (product.price === null) return product.displayPrice;
  try {
    const format = new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: product.currency,
    });
    return format.format(product.price);
  } catch {
    return product.displayPrice; // unknown currency code
  }
}
