// packages/shell/src/screens/debug/use-debug-model.ts
import { parityFrameState } from '@demo/shell/app/parity/parity-session.ts';

/** S15's model: test-only code reads the parity member from its own file, never the gate. */
export function useDebugModel(open: () => void): void {
  if (parityFrameState() === 'debug-ads-always-test') open();
}
