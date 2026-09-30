import type { TFunction } from '@e07/shell/i18n/create-t.ts';

export function monthLabel(t: TFunction, month: number): string {
  return t(`date.month-short.${month}` as never);
}
