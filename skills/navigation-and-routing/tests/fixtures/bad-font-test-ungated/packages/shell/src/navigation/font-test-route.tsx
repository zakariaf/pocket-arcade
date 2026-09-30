// packages/shell/src/navigation/font-test-route.tsx (planted: imports the page directly, so a store bundle carries it)
import { FontTestScreen } from '@e07/shell/screens/debug/font-test-screen.tsx';

import type { ReactNode } from 'react';

export function FontTestRoute(): ReactNode {
  return <FontTestScreen />;
}
