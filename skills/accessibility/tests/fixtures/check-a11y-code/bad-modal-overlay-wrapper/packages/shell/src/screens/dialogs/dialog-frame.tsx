import { DialogCard } from '@e07/shell/ui/dialog-card.tsx';

import type { ReactNode } from 'react';

// Planted bug: the frame renders the card without the Scrim (the modal root), so VoiceOver can
// reach the screen behind the dialog.
export function DialogFrame({ children }: { readonly children: ReactNode }): ReactNode {
  return <DialogCard>{children}</DialogCard>;
}
