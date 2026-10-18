import { DialogFrame } from './dialog-frame.tsx';

import type { ReactNode } from 'react';

export function RestartDialog({ children }: { readonly children: ReactNode }): ReactNode {
  return <DialogFrame>{children}</DialogFrame>;
}
