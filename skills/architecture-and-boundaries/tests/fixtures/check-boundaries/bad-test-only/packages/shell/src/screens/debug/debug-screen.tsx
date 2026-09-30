// packages/shell/src/screens/debug/debug-screen.tsx
import { TEST_BUILD_SENTINEL } from '@demo/shell/app/test-only-entry.ts';

/** Debug (S15). */
export function DebugScreen(): unknown {
  const extra: unknown = require('./debug-extra.ts');
  return [TEST_BUILD_SENTINEL, extra];
}
