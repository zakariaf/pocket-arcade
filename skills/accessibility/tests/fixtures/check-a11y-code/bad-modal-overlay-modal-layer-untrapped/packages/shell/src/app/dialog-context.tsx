import { ModalLayer } from '@e07/shell/app/modal-layer.tsx';
import { DialogHost } from '@e07/shell/screens/dialogs/dialog-host.tsx';

import type { ReactNode } from 'react';

// The screens are the content behind every dialog: the ModalLayer hides them while one is open.
export function DialogProvider({ isOpen, children }: { readonly isOpen: boolean; readonly children: ReactNode }): ReactNode {
  return <ModalLayer behind={children} layer={isOpen ? <DialogHost isOpen /> : null} />;
}
