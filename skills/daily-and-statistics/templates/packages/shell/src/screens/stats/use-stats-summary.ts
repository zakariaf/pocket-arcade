// packages/shell/src/screens/stats/use-stats-summary.ts
import { useToday } from '@e07/shell/app/use-today.ts';
import { buildStatsSummary } from '@e07/shell/screens/stats/stats-summary.ts';
import { selectDaily } from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';
import { selectStats } from '@e07/shell/stores/stats-selectors.ts';
import { useStatsStore } from '@e07/shell/stores/stats-store.ts';

import type { StatsSummary, StatsSummaryInput } from '@e07/shell/screens/stats/stats-summary.ts';

/** The game's shape: levels.table.length, whether Endless is on, its CounterSpec ids. */
export type StatsGameShape = Pick<StatsSummaryInput, 'levelCount' | 'hasEndless' | 'counterIds'>;

/** S10 reads this. Every selector returns a section reference already in a store. */
export function useStatsSummary(game: StatsGameShape): StatsSummary {
  const today = useToday();
  const stats = useStatsStore(selectStats);
  const progress = useProgressStore((state) => state.progress);
  const daily = useProgressStore(selectDaily);
  return buildStatsSummary({ ...game, stats, progress, daily, today });
}
