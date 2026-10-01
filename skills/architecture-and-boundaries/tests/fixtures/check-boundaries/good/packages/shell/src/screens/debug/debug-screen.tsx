// packages/shell/src/screens/debug/debug-screen.tsx
import { useDebugModel } from './use-debug-model.ts';

/** Debug (S15), reached only through the test-only entry. */
export function DebugScreen(): unknown {
  useDebugModel(() => undefined);
  return null;
}
