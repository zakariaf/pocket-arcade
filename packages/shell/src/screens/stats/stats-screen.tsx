// packages/shell/src/screens/stats/stats-screen.tsx
// device-only: covered by the e2e flows and screenshots that open Statistics; a route file only joins its model hook and its view, which have their own tests.
import { StatsView } from './stats-view.tsx';
import { useStatsModel } from './use-stats-model.ts';

import type { ReactNode } from 'react';

/** Route Stats (S10). */
export function StatsScreen(): ReactNode {
  const model = useStatsModel();
  return <StatsView model={model} />;
}
