// packages/shell/src/screens/debug/debug-screen.tsx
// device-only: covered by the debug-link e2e setup of every flow (test builds); a route file only joins its model hook and its view, which have their own tests.
import { DebugView } from './debug-view.tsx';
import { useDebugModel } from './use-debug-model.ts';

import type { ReactNode } from 'react';

/**
 * S15, reached only through TEST_ONLY.DebugScreen (the Debug route of test builds).
 * @public
 */
export function DebugScreen(): ReactNode {
  const model = useDebugModel();
  return <DebugView model={model} />;
}
