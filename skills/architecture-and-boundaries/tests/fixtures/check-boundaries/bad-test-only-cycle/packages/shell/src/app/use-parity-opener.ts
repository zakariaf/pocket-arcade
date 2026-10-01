// packages/shell/src/app/use-parity-opener.ts
import { TEST_ONLY } from './test-only.ts';

/** Opens a parity frame state once (screens outside the test-only entry). */
export function useParityOpener(state: string, open: () => void): void {
  if (TEST_ONLY?.parityFrameState() === state) open();
}
