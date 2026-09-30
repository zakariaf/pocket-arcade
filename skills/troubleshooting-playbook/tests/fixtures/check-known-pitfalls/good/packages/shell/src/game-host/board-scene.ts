// packages/shell/src/game-host/board-scene.ts
'worklet';

import type { FrameInfo } from 'react-native-reanimated';

export const NOT_STARTED = -1;

/** Elapsed time from FrameInfo.timestamp and the startAt sentinel (never timeSinceFirstFrame). */
export function tickClock(startAt: number, frame: FrameInfo): number {
  return startAt === NOT_STARTED ? 0 : frame.timestamp - startAt;
}
