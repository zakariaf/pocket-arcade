// packages/shell/src/app/start-shell.ts (fixture: the parity steps start-shell makes)
import { parityLaunchFor, readParityLaunch } from '@e07/shell/app/parity-startup.tsx';

import type { Wiring } from './wiring.ts';

export function startShellFixture(w: Wiring): unknown {
  const parity = readParityLaunch();
  if (parity.kind !== 'frame') return parity.kind;
  return parityLaunchFor({ request: parity.request, game: w.game });
}
