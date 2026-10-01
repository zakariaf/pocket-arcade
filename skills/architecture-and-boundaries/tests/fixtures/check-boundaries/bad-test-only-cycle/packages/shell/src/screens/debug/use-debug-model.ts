// packages/shell/src/screens/debug/use-debug-model.ts
import { useParityOpener } from '@demo/shell/app/use-parity-opener.ts';

/** S15's model, planted: it reads the frame state through the gate helper. */
export function useDebugModel(open: () => void): void {
  useParityOpener('debug-ads-always-test', open);
}
