// packages/shell/src/app/dialog-context.tsx
// The S14 dialog host's state: ShellApp wraps the navigator in DialogProvider, which draws the one
// open dialog after it (above every screen). A screen model opens one with useOpenDialog().
import { createContext, use, useState } from 'react';

import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { DialogHost } from '@e07/shell/screens/dialogs/dialog-host.tsx';

import type { DialogRequest } from '@e07/shell/screens/dialogs/dialog-request.ts';
import type { ReactNode } from 'react';

const DialogContext = createContext<((request: DialogRequest) => void) | null>(null);

export type DialogProviderProps = { readonly children: ReactNode };

/** Holds at most one open dialog (plain React state: never persisted, never a route). */
export function DialogProvider({ children }: DialogProviderProps): ReactNode {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const isReducedMotion = useReduceMotion();
  return (
    <DialogContext value={setRequest}>
      {children}
      <DialogHost
        request={request}
        onClose={() => {
          setRequest(null);
        }}
        isReducedMotion={isReducedMotion}
      />
    </DialogContext>
  );
}

/** Opens an S14 dialog (replacing any open one). A missing provider is a programmer error. */
export function useOpenDialog(): (request: DialogRequest) => void {
  const open = use(DialogContext);
  if (open === null) throw new Error('useOpenDialog() needs a <DialogProvider> above it');
  return open;
}
