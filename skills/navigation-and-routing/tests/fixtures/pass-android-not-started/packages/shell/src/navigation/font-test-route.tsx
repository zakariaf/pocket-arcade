// packages/shell/src/navigation/font-test-route.tsx
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

import type { ReactNode } from 'react';

/**
 * S15's font test page (every Toybox type role in en, de, fa and ckb). Registered in the Debug
 * group, whose `if` is false in store builds; the page's code is reached only through TEST_ONLY,
 * so Metro drops it from store bundles like the debug screen.
 */
export function FontTestRoute(): ReactNode {
  if (TEST_ONLY === null) return null;
  return <TEST_ONLY.FontTestScreen />;
}
