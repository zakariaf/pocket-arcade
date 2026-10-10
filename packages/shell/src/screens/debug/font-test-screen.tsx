// packages/shell/src/screens/debug/font-test-screen.tsx
// device-only: covered by opening the page from S15 on the simulator (test builds); a route file only joins its model hook and its view, which have their own tests.
import { FontTestView } from './font-test-view.tsx';
import { useFontTestModel } from './use-font-test-model.ts';

import type { ReactNode } from 'react';

/**
 * The font test page, reached only through TEST_ONLY.FontTestScreen (the FontTest route of the
 * Debug group, test builds).
 * @public
 */
export function FontTestScreen(): ReactNode {
  const model = useFontTestModel();
  return <FontTestView model={model} />;
}
