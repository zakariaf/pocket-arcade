// packages/shell/src/screens/daily/use-daily-summary.ts
import { useToday } from '@e07/shell/app/use-today.ts';
import { buildDailySummary } from '@e07/shell/screens/daily/daily-summary.ts';
import { selectDaily } from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';

import type { DailySummary } from '@e07/shell/screens/daily/daily-summary.ts';

/**
 * S9, the Home daily card and the daily result read this. The selector returns the `daily`
 * section itself (a reference already in the state), so no useShallow is needed.
 */
export function useDailySummary(): DailySummary {
  const today = useToday();
  const daily = useProgressStore(selectDaily);
  return buildDailySummary(daily, today);
}
