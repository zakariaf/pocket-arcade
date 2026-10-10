// packages/shell/src/screens/levels/levels-screen.tsx
// device-only: covered by the e2e flow that plays a level from Levels; a route file only joins its model hook and its view, which have their own tests.
import { LevelsView } from './levels-view.tsx';
import { useLevelsModel } from './use-levels-model.ts';

import type { ReactNode } from 'react';

/** Route Levels (S8). */
export function LevelsScreen(): ReactNode {
  const model = useLevelsModel();
  return <LevelsView model={model} />;
}
