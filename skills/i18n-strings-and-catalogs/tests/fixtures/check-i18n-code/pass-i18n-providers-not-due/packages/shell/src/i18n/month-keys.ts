// A typed table of literal keys: allowed.
export const MONTH_SHORT_KEYS = ['date.month-short.1', 'date.month-short.2'] as const;

export function monthKey(month: number): (typeof MONTH_SHORT_KEYS)[number] {
  return MONTH_SHORT_KEYS[month - 1] ?? 'date.month-short.1';
}
