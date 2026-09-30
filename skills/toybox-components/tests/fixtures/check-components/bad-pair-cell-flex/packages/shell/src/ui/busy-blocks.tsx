// packages/shell/src/ui/busy-blocks.tsx
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { EASING, KEYFRAMES, MOTION_MS } from '@e07/shell/theme/motion.ts';

import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';

const BUSY = COMPONENT_SPECS.busy;
const SPLASH = COMPONENT_SPECS.splashLoader;
const BLOCKS = [0, 1, 2] as const;

export type BusyBlocksProps = {
  /** 'button': 9 pt blocks in the label colour; 'splash': 14 pt ink blocks under the S1 logo. */
  readonly size: 'button' | 'splash';
  readonly color: string;
  /** From useReduceMotion(): static blocks (the text beside them still says what is happening). */
  readonly isReducedMotion: boolean;
  /** Only for the splash loader, which stands alone: the translated "Loading" label. */
  readonly label?: string;
  readonly testID?: string;
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  buttonRow: { gap: BUSY.gap },
  splashRow: { gap: SPLASH.gap },
  buttonBlock: { width: BUSY.block, height: BUSY.block, borderRadius: BUSY.radius },
  splashBlock: { width: SPLASH.block, height: SPLASH.block, borderRadius: SPLASH.radius },
});

const HOP_UP = MOTION_MS.hop * KEYFRAMES.hop.peakAt;
const HOP_DOWN = MOTION_MS.hop * (KEYFRAMES.hop.restFrom - KEYFRAMES.hop.peakAt);
const HOP_REST = MOTION_MS.hop * (1 - KEYFRAMES.hop.restFrom);
const BOING = Easing.bezier(...EASING.boing);

function startHop(offset: SharedValue<number>, index: number): void {
  offset.set(
    withDelay(
      index * MOTION_MS.hopStagger,
      withRepeat(
        withSequence(
          withTiming(KEYFRAMES.hop.translateY, { duration: HOP_UP, easing: BOING }),
          withTiming(0, { duration: HOP_DOWN, easing: BOING }),
          withTiming(0, { duration: HOP_REST }),
        ),
        -1,
      ),
    ),
  );
}

/** Three blocks that hop in turn (900 ms loop, 120 ms stagger); static under reduce motion. */
export function BusyBlocks(props: BusyBlocksProps): ReactNode {
  const { size, color, isReducedMotion } = props;
  const first = useSharedValue(0);
  const second = useSharedValue(0);
  const third = useSharedValue(0);

  // Allowed effect: starts and stops an animation loop tied to this view.
  useEffect(() => {
    if (isReducedMotion) return undefined;
    startHop(first, 0);
    startHop(second, 1);
    startHop(third, 2);
    return () => {
      first.set(0);
      second.set(0);
      third.set(0);
    };
  }, [isReducedMotion, first, second, third]);

  const style0 = useAnimatedStyle(() => ({ transform: [{ translateY: first.get() }] }));
  const style1 = useAnimatedStyle(() => ({ transform: [{ translateY: second.get() }] }));
  const style2 = useAnimatedStyle(() => ({ transform: [{ translateY: third.get() }] }));
  const hops = [style0, style1, style2] as const;
  const block = size === 'button' ? styles.buttonBlock : styles.splashBlock;
  const isLabelled = props.label !== undefined;
  return (
    <View
      style={[styles.row, size === 'button' ? styles.buttonRow : styles.splashRow]}
      {...(isLabelled
        ? { accessible: true, accessibilityRole: 'image', accessibilityLabel: props.label }
        : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' })}
      {...(props.testID === undefined ? {} : { testID: props.testID })}
    >
      {BLOCKS.map((index) => (
        <Animated.View key={index} style={[block, { backgroundColor: color }, hops[index]]} />
      ))}
    </View>
  );
}
