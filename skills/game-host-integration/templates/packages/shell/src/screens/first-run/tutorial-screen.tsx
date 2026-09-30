// packages/shell/src/screens/first-run/tutorial-screen.tsx
import { TutorialView } from './tutorial-view.tsx';
import { useTutorialModel } from './use-tutorial-model.ts';

import type { ReactNode } from 'react';

/** Route Tutorial (FirstRun group, gestureEnabled false): the game's scripted tutorial level. */
export function TutorialScreen(): ReactNode {
  const model = useTutorialModel();
  return <TutorialView model={model} />;
}
