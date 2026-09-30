import { readLayoutDirection } from '@e07/shell/i18n/direction.ts';

import type { ReactNode } from 'react';

export function NavigationRoot(): ReactNode {
  return <Navigation direction={directionOf(language)} />;
}
