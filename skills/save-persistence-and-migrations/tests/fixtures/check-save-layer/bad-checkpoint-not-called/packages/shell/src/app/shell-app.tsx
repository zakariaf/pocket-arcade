// packages/shell/src/app/shell-app.tsx
// Planted bug: the Shell root never calls useCheckpointOnBackground, so the WAL is never folded
// into save.db and a device backup taken while the app is suspended may miss recent moves.
import { StoresProvider } from '@e07/shell/app/stores-context.tsx';

import type { Hydrated } from '@e07/shell/app/hydrate-save.ts';
import type { ShellStores } from '@e07/shell/app/stores-context.tsx';
import type { JSX } from 'react';

export type ShellAppProps = { readonly hydrated: Hydrated; readonly stores: ShellStores };

export function ShellApp({ stores }: ShellAppProps): JSX.Element {
  return <StoresProvider stores={stores}>{null}</StoresProvider>;
}
