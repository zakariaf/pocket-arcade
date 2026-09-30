// packages/shell/src/screens/settings/licences/licences-screen.tsx
// device-only: covered by the S11d parity capture on the simulator; a route file only joins its model hook and its view, which have their own tests.
import { LicencesView } from './licences-view.tsx';
import { useLicencesModel } from './use-licences-model.ts';

import type { ReactNode } from 'react';

/** Route Licences (S11d). */
export function LicencesScreen(): ReactNode {
  const model = useLicencesModel();
  return <LicencesView model={model} />;
}
