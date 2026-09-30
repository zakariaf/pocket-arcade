// packages/shell/src/i18n/t-bridge.tsx
import { useIntl } from 'react-intl';

import { createT } from './create-t.ts';
import { TContext } from './t-context.ts';

import type { ReactNode } from 'react';

export type TBridgeProps = {
  readonly onError: (error: Error) => void;
  readonly children: ReactNode;
};

// Turns react-intl's IntlShape into the Shell's t() (React Compiler memoizes it).
export function TBridge({ onError, children }: TBridgeProps): ReactNode {
  const intl = useIntl();
  return <TContext value={createT({ intl, onError })}>{children}</TContext>;
}
