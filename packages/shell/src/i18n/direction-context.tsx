// packages/shell/src/i18n/direction-context.tsx
import { createContext, use } from 'react';

import type { Direction } from './languages.ts';
import type { ReactNode } from 'react';

const DirectionContext = createContext<Direction>('ltr');

export type DirectionProviderProps = {
  readonly direction: Direction;
  readonly children: ReactNode;
};

// Root passes readLayoutDirection(); tests pass 'rtl' explicitly (Jest mocks isRTL = false).
export function DirectionProvider({ direction, children }: DirectionProviderProps): ReactNode {
  return <DirectionContext value={direction}>{children}</DirectionContext>;
}

export function useDirection(): Direction {
  return use(DirectionContext);
}
