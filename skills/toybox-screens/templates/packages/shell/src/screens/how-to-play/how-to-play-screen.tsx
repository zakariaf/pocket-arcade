// packages/shell/src/screens/how-to-play/how-to-play-screen.tsx
// device-only: covered by the S13 parity capture on the simulator; a route file only joins its model hook and its view, which have their own tests.
import { HowToPlayView } from './how-to-play-view.tsx';
import { useHowToPlayModel } from './use-how-to-play-model.ts';

import type { ReactNode } from 'react';

/** Route HowToPlay (S13), from Home or Pause. */
export function HowToPlayScreen(): ReactNode {
  const model = useHowToPlayModel();
  return <HowToPlayView model={model} />;
}
