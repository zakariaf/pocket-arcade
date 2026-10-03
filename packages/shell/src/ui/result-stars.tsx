// packages/shell/src/ui/result-stars.tsx
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { EASING, KEYFRAMES, MOTION_MS } from '@e07/shell/theme/motion.ts';

import { COMPONENT_SPECS } from './component-specs.ts';
import { RatingStar } from './rating-star.tsx';

import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';

const STAR = COMPONENT_SPECS.star;
const POP = KEYFRAMES.starPop;
const TIMES = POP.map((frame) => frame.t);
const SCALES = POP.map((frame) => frame.scale);
const TURNS = POP.map((frame) => frame.rotateDeg);

export type ResultStarsProps = {
  /** Stars earned, 0 to 3. */
  readonly count: 0 | 1 | 2 | 3;
  /** Translated ("3 of 3 stars"). */
  readonly label: string;
  /** `result.stars-<count>`. */
  readonly testID: string;
  readonly isReducedMotion: boolean;
};

const styles = StyleSheet.create({
  row: {
    height: STAR.resultRowHeight,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: STAR.resultGap,
  },
  // The middle star is bigger and sits 24 pt higher.
  lifted: { marginBottom: STAR.resultMiddleLift },
});

function usePop(index: number, isReducedMotion: boolean): ReturnType<typeof useAnimatedStyle> {
  const t: SharedValue<number> = useSharedValue(0);
  useEffect(() => {
    const timing = isReducedMotion
      ? { duration: MOTION_MS.reducedFade }
      : { duration: MOTION_MS.starPop, easing: Easing.bezier(...EASING.boing) };
    const delay = isReducedMotion ? 0 : MOTION_MS.starDelay + index * MOTION_MS.starStagger;
    t.set(withDelay(delay, withTiming(1, timing)));
  }, [index, isReducedMotion, t]);
  return useAnimatedStyle(() => {
    if (isReducedMotion) return { opacity: t.get() };
    const scale = interpolate(t.get(), TIMES, SCALES);
    const rotate = interpolate(t.get(), TIMES, TURNS);
    return { transform: [{ scale }, { rotate: `${String(rotate)}deg` }] };
  });
}

/** The S7 win stars (86 / 102 / 86): they pop in one by one; all at once under reduce motion. */
export function ResultStars({
  count,
  label,
  testID,
  isReducedMotion,
}: ResultStarsProps): ReactNode {
  const first = usePop(0, isReducedMotion);
  const second = usePop(1, isReducedMotion);
  const third = usePop(2, isReducedMotion);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID={testID}
    >
      <Animated.View style={first}>
        <RatingStar isFilled={count >= 1} size={STAR.result} />
      </Animated.View>
      <Animated.View style={[styles.lifted, second]}>
        <RatingStar isFilled={count >= 2} size={STAR.resultMiddle} />
      </Animated.View>
      <Animated.View style={third}>
        <RatingStar isFilled={count >= 3} size={STAR.result} />
      </Animated.View>
    </View>
  );
}
