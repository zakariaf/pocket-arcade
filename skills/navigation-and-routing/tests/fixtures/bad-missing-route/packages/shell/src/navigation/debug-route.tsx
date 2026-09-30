// packages/shell/src/navigation/debug-route.tsx
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

import type { ReactNode } from 'react';

/**
 * S15. Registered in the Debug group, whose `if` is false in store builds. The debug screen's
 * code is reached only through TEST_ONLY, whose literal variant check lets Metro drop it from
 * store bundles.
 */
export function DebugRoute(): ReactNode {
  if (TEST_ONLY === null) return null;
  return <TEST_ONLY.DebugScreen />;
}
