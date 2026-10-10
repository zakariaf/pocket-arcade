// packages/shell/src/screens/home/home-screen.tsx
// device-only: covered by every e2e flow (each one starts on Home); a route file only joins its model hook and its view, which have their own tests.
import { HomeView } from './home-view.tsx';
import { useHomeModel } from './use-home-model.ts';

import type { ReactNode } from 'react';

/** Route Home (S4), the first screen of the Main group. */
export function HomeScreen(): ReactNode {
  const model = useHomeModel();
  return <HomeView model={model} />;
}
