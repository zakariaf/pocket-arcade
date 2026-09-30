// Example (shape only, never copied into the app): a component that reads one store value.
// Model for a component that reads a store: a primitive selector, so it re-renders only when
// that one value changes. Screens wrap the Premium key and the banner slot in it.
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';

import type { ReactNode } from 'react';

export type HideForPremiumProps = { readonly children: ReactNode };

export function HideForPremium({ children }: HideForPremiumProps): ReactNode {
  // Primitive selector: no useShallow needed; a selector that builds an object would need it.
  const isPremium = usePremiumStore((state) => state.isPremium);
  return isPremium ? null : children;
}
