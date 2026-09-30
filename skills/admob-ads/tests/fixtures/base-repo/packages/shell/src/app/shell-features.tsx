// packages/shell/src/app/shell-features.tsx (fixture: the consent moment around the navigator)
import { ConsentMoment } from '@e07/shell/app/consent-moment.tsx';

import type { ReactNode } from 'react';

export function ShellFeatures(props: { readonly navigator: ReactNode }): ReactNode {
  return (
    <ConsentMoment isHeld={false} debug={null}>
      {props.navigator}
    </ConsentMoment>
  );
}
