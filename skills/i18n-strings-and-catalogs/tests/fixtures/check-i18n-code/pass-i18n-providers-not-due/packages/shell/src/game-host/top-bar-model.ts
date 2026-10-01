// packages/shell/src/game-host/top-bar-model.ts
import { stripIsolates } from '@e07/shell/i18n/bidi.ts';
import { formatDayMonth } from '@e07/shell/i18n/format-date.ts';

import type { TFunction } from '@e07/shell/i18n/create-t.ts';

/** "Daily – 26 Sep": the date is one run of its language, so its inner isolates are stripped. */
export function dailyModeText(date: string, t: TFunction): string {
  return t('game-screen.mode.daily', { dateText: stripIsolates(formatDayMonth(date, t)) });
}

export function levelModeText(level: number, t: TFunction): string {
  return t('game-screen.mode.level', { level });
}
