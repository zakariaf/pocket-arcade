// packages/shell/src/screens/settings/about/about-screen.tsx
// device-only: covered by the S11b parity capture on the simulator; a route file only joins its model hook and its view, which have their own tests.
import { AboutView } from './about-view.tsx';
import { useAboutModel } from './use-about-model.ts';

import type { ReactNode } from 'react';

/** Route About (S11b). */
export function AboutScreen(): ReactNode {
  const model = useAboutModel();
  return <AboutView model={model} />;
}
