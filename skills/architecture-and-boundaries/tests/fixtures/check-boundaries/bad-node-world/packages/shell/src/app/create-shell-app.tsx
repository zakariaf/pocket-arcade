// packages/shell/src/app/create-shell-app.tsx
import { join } from 'node:path';

import type { withShell } from '@demo/shell/config/with-shell.ts';

/** Composition root. */
export function createShellApp(compose: typeof withShell): unknown {
  return [compose, join('a', 'b')];
}
