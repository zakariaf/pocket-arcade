// packages/shell/src/screens/home/home-screen.tsx (fixture: S4 is outside the slice, so its gaps are SKIPped)
import { HomeView } from './home-view.tsx';
import { useHomeModel } from './use-home-model.ts';

import type { ReactNode } from 'react';

export function HomeScreen(): ReactNode {
  const model = useHomeModel();
  return <HomeView model={model} />;
}
