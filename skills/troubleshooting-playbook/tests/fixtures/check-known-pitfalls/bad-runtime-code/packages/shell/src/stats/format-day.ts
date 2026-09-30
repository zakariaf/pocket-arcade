// packages/shell/src/stats/format-day.ts
export function formatDay(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(ms);
}
