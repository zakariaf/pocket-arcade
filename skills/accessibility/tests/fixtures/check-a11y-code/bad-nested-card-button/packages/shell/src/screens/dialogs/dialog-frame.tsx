import { DialogCard } from '@e07/shell/ui/dialog-card.tsx';
import { Scrim } from '@e07/shell/ui/scrim.tsx';

import type { ReactNode } from 'react';

// Modal through the Scrim (the checker follows the component, not only the literal prop).
export function DialogFrame({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <Scrim>
      <DialogCard>{children}</DialogCard>
    </Scrim>
  );
}
