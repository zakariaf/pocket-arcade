// packages/shell/src/screens/daily/month-label.ts
/** Month label. */
export function monthLabel(t: (key: string) => string, month: number): string {
  return t(`date.month-short.${String(month)}`) + t('HomePlay') + t('tile-drop.name');
}
