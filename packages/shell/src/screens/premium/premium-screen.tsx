// packages/shell/src/screens/premium/premium-screen.tsx
// device-only: covered by the StoreKit e2e purchase flow; a route file only joins its model hook and its view, which have their own tests.
import { PremiumPage } from './premium-page.tsx';
import { usePremiumModel } from './use-premium-model.ts';

import type { ReactNode } from 'react';

/** Route Premium (S12), from Home, Settings or the Result nudge. */
export function PremiumScreen(): ReactNode {
  const model = usePremiumModel();
  return <PremiumPage model={model} />;
}
