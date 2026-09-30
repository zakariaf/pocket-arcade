import { useState } from 'react';
import { useFrameCallback } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@e07/shell/ui/app-text.tsx';

import type { ReactNode } from 'react';

// Planted bug: the setter is handed to the RN thread on every frame, so React renders per frame.
export function LiveScore(): ReactNode {
  const [scoreText, setScoreText] = useState('');
  const callback = useFrameCallback((frame) => {
    scheduleOnRN(setScoreText, String(Math.round(frame.timeSinceFirstFrame)));
  });
  if (scoreText === 'stop') callback.setActive(false);
  return <AppText text={scoreText} />;
}
