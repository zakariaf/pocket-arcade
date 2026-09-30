import { DialogCard } from '@e07/shell/ui/dialog-card.tsx';

import type { ReactNode } from 'react';

// Modal through DialogCard (the checker follows the component, not only the literal prop).
export function DialogFrame({ children }: { readonly children: ReactNode }): ReactNode {
  return <DialogCard>{children}</DialogCard>;
}
