// packages/shell/src/ui/level-tile-bob.tsx
// The current level tile's gentle bob (Toybox motion: 1.6 s, ease-in-out, endless). Only the
// current tile is wrapped in it, so only that tile holds a Reanimated value and an animated style;
// LevelTile puts every other tile in a plain View, the same box without animation.
import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { EASING, KEYFRAMES, MOTION_MS } from '@e07/shell/theme/motion.ts';

import type { ReactNode } from 'react';

const BOB_HALF = { duration: MOTION_MS.bob / 2, easing: Easing.bezier(...EASING.easeInOut) };

export type LevelTileBobProps = {
  /** False under Reduce motion, in a parity capture and while Levels is covered: no bob. */
  readonly isOn: boolean;
  readonly children: ReactNode;
};

function useBob(isOn: boolean): ReturnType<typeof useAnimatedStyle> {
  const offset = useSharedValue(0);
  useEffect(() => {
    if (!isOn) return undefined;
    offset.set(
      withRepeat(
        withSequence(withTiming(KEYFRAMES.bob.translateY, BOB_HALF), withTiming(0, BOB_HALF)),
        -1,
      ),
    );
    return () => {
      offset.set(0);
    };
  }, [isOn, offset]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
}

/** Bobs its child (the current LevelTile) while `isOn`; holds it at rest otherwise. */
export function LevelTileBob({ isOn, children }: LevelTileBobProps): ReactNode {
  const bob = useBob(isOn);
  return <Animated.View style={bob}>{children}</Animated.View>;
}
