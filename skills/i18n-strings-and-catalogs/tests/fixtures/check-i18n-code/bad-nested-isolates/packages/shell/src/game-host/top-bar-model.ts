// packages/shell/src/game-host/top-bar-model.ts
import { formatDayMonth } from '@e07/shell/i18n/format-date.ts';

import type { TFunction } from '@e07/shell/i18n/create-t.ts';

/** "Daily – 26 Sep" (planted bug: the formatted date keeps its isolates and gets a second pair). */
export function dailyModeText(date: string, t: TFunction): string {
  return t('game-screen.mode.daily', { dateText: formatDayMonth(date, t) });
}

export function levelModeText(level: number, t: TFunction): string {
  return t('game-screen.mode.level', { level });
}
