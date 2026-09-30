export function formatStorePrice(price: number, currency: string, localeTag: string): string {
  return new Intl.NumberFormat(localeTag, { style: 'currency', currency }).format(price);
}
