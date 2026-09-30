// packages/shell/src/screens/daily/daily-screen.tsx
// device-only: covered by the daily e2e flow; a route file only joins its model hook and its view, which have their own tests.
import { DailyView } from './daily-view.tsx';
import { useDailyModel } from './use-daily-model.ts';

import type { ReactNode } from 'react';

/** Route Daily (S9). */
export function DailyScreen(): ReactNode {
  const model = useDailyModel();
  return <DailyView model={model} />;
}
