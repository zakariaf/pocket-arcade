// packages/shell/src/screens/home/home-screen.tsx (fixture)
import { useServices } from '@e07/shell/app/services-context.tsx';

import type { ReactNode } from 'react';

export function HomeScreen(): ReactNode {
  const { connectivity } = useServices();
  return connectivity.isOnline() ? null : null;
}
