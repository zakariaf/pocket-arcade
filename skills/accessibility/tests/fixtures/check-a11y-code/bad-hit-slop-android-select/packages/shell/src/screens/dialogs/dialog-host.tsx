import { RestartDialog } from './restart-dialog.tsx';

import type { ReactNode } from 'react';

export function DialogHost({ isOpen }: { readonly isOpen: boolean }): ReactNode {
  return isOpen ? <RestartDialog>{null}</RestartDialog> : null;
}
