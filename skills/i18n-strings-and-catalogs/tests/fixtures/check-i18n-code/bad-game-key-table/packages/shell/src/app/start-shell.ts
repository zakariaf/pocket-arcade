// packages/shell/src/app/start-shell.ts
import '@e07/shell/i18n/intl-polyfills.ts';

import { registerRootComponent } from 'expo';

export function startShell(): void {
  registerRootComponent(() => null);
}
