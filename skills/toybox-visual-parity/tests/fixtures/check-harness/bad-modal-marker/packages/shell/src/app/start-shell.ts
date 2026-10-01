// packages/shell/src/app/start-shell.ts (fixture: the parity steps start-shell makes)
import {
  isHeldParitySplash,
  parityLaunchFor,
  readParityLaunch,
  withParityRoot,
} from '@e07/shell/app/parity-startup.tsx';

import type { Wiring } from './wiring.ts';

export function startShellFixture(w: Wiring): unknown {
  const parity = readParityLaunch();
  if (parity.kind !== 'frame') return parity.kind;
  // The held S1 splash is registered outside the Shell root, so the parity root wraps it too.
  if (isHeldParitySplash(parity.request)) return withParityRoot(parity.request, w.splash);
  return parityLaunchFor({ request: parity.request, game: w.game });
}
