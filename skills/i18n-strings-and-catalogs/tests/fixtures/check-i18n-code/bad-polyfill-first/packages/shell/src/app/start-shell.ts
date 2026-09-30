import { registerRootComponent } from 'expo';

import '@e07/shell/i18n/intl-polyfills.ts';

export function startShell(): void {
  registerRootComponent(() => null);
}
