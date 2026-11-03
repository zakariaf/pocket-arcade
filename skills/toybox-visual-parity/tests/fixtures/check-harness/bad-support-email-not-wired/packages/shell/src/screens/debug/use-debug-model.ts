// packages/shell/src/screens/debug/use-debug-model.ts (fixture: S15's opener turns the always-test-ads switch on through its own handler; the test-only debug module reads the parity session straight from its file)
import { useEffect, useEffectEvent, useState } from 'react';

import { parityFrameState } from '@e07/shell/app/parity/parity-session.ts';

export function useDebugParity(onToggle: (id: 'ads-always-test') => void): void {
  const [isDue] = useState(() => parityFrameState() === 'debug-ads-always-test');
  const openOnce = useEffectEvent(() => {
    onToggle('ads-always-test');
  });
  useEffect(() => {
    if (isDue) openOnce();
  }, [isDue]);
}
