// A finite glide that takes the board's Motion ('full' | 'reduced') and rests when it is 'reduced':
// it honours reduce motion through the value its parent read from useReduceMotion().
import { useEffect } from 'react';
import { useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { Motion } from '@e07/game-kit/timeline/track.ts';

export type CoachHandLayerProps = {
  readonly motion: Motion;
};

export function useCoachHandPhase({ motion }: CoachHandLayerProps): { readonly value: number } {
  const phase = useSharedValue(1);
  useEffect(() => {
    if (motion === 'reduced') {
      phase.set(1);
      return;
    }
    phase.set(withRepeat(withTiming(1, { duration: 1200 }), 3, false));
  }, [motion, phase]);
  return { value: phase.get() };
}
