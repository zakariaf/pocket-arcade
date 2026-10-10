// packages/shell/src/app/use-parity-opener.ts
// Test builds: a parity capture of a frame that draws a state (a dialog over a screen) opens that
// state once, on mount, through the same handler a player's tap uses (the parity harness's table:
// the model hook that owns the state opens it). A normal launch and store builds do nothing.
import { useEffect, useEffectEvent, useState } from 'react';

import { TEST_ONLY } from './test-only.ts';

/** `state` is a parity frame state ('save-restored-dialog', 'restart-dialog' ...). */
export function useParityOpener(state: string, open: () => void): void {
  const [isDue] = useState(() => TEST_ONLY?.parityFrameState() === state);
  const openOnce = useEffectEvent(open);
  useEffect(() => {
    if (isDue) openOnce();
  }, [isDue]);
}
