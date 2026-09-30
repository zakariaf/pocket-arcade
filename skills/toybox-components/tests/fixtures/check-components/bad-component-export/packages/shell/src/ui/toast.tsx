// packages/shell/src/ui/toast.tsx
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
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { BusyBlocks } from './busy-blocks.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';

import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';

const TOAST = COMPONENT_SPECS.toast;

export type ToastProps = {
  /** Translated message. Announce it too (useAnnounce): a live region is not enough on iOS. */
  readonly text: string;
  /** A 20 pt icon at the start, or 'busy' for the hop blocks (restoring purchases). */
  readonly icon: IconName | 'busy';
  readonly testID: string;
  readonly isReducedMotion: boolean;
  /** Drop-in delay; 0 for a toast in a stack that is already on screen. */
  readonly delayMs?: number;
};

const styles = StyleSheet.create({
  // Inverted chip: no outline and no shadow.
  toast: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: TOAST.gap,
    paddingBlock: TOAST.paddingBlock,
    paddingInline: TOAST.paddingInline,
    borderRadius: TOAST.radius,
  },
  text: { flexShrink: 1 },
});

function useDrop(isReducedMotion: boolean, delayMs: number): ReturnType<typeof useAnimatedStyle> {
  const progress = useSharedValue(0);
  useEffect(() => {
    const timing = isReducedMotion
      ? { duration: MOTION_MS.reducedFade }
      : { duration: MOTION_MS.toastDrop, easing: Easing.bezier(...EASING.boing) };
    progress.set(withDelay(delayMs, withTiming(1, timing)));
  }, [isReducedMotion, delayMs, progress]);
  const { fromTranslateY, fromScale } = KEYFRAMES.toastDrop;
  return useAnimatedStyle(() => {
    const t = progress.get();
    if (isReducedMotion) return { opacity: t };
    return {
      opacity: Math.min(1, t * 2),
      transform: [
        { translateY: interpolate(t, [0, 1], [fromTranslateY, 0]) },
        { scale: interpolate(t, [0, 1], [fromScale, 1]) },
      ],
    };
  });
}

/** The inverted toast chip: icon (or busy blocks) and one message; drops in with a boing. */
export function ToastChip(props: ToastProps): ReactNode {
  const theme = useTheme();
  const shell = SHELL_COLORS[theme.scheme];
  const drop = useDrop(props.isReducedMotion, props.delayMs ?? MOTION_MS.toastDelay);
  return (
    <Animated.View
      style={[styles.toast, { backgroundColor: shell.toastBackground }, drop]}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={props.testID}
    >
      {props.icon === 'busy' ? (
        <BusyBlocks size="button" color={shell.toastText} isReducedMotion={props.isReducedMotion} />
      ) : (
        <Icon name={props.icon} color={shell.toastText} size={TOAST.icon} />
      )}
      <View style={styles.text}>
        <AppText text={props.text} variant="toast" tone="toast" />
      </View>
    </Animated.View>
  );
}
