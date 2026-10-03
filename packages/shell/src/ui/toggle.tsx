// packages/shell/src/ui/toggle.tsx
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useDirection } from '@e07/shell/i18n/direction-context.tsx';
import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { EASING, MOTION_MS } from '@e07/shell/theme/motion.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';
import { hardShadow } from './toybox-styles.ts';

import type { ReactNode } from 'react';

const SPEC = COMPONENT_SPECS.toggle;
const SLIDE = { duration: MOTION_MS.toggleKnob, easing: Easing.bezier(...EASING.boing) };

export type ToggleProps = {
  readonly isOn: boolean;
  /** From useReduceMotion(): the knob jumps instead of sliding. */
  readonly isReducedMotion: boolean;
  /** Part id, usually `<row>.toggle`. */
  readonly testID?: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    track: {
      width: SPEC.width,
      height: SPEC.height,
      borderRadius: SPEC.radius,
      borderWidth: SPEC.border,
      borderColor: theme.colors.border,
    },
    off: { backgroundColor: theme.colors.sunken },
    on: { backgroundColor: theme.colors.primary },
    knob: {
      position: 'absolute',
      top: SPEC.knobInset,
      start: SPEC.knobInset,
      width: SPEC.knob,
      height: SPEC.knob,
      borderRadius: SPEC.knobRadius,
      borderWidth: SPEC.knobBorder,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...hardShadow(SPEC.knobElevation, theme.colors.shadow),
    },
  });
  return styles;
});

/**
 * The on/off track of a settings row. Shape carries the state: a check when on, a dash when off.
 * Not a target of its own: the whole 60 pt row is the switch, so the toggle is hidden from VoiceOver.
 */
export function Toggle({ isOn, isReducedMotion, testID }: ToggleProps): ReactNode {
  const styles = useStyles();
  const theme = useTheme();
  const direction = useDirection();
  const travel = SPEC.knobTravel * (direction === 'rtl' ? -1 : 1);
  const position = useSharedValue(isOn ? 1 : 0);

  // Allowed effect: drives an animation when the prop changes (no React state is set).
  useEffect(() => {
    const target = isOn ? 1 : 0;
    position.set(isReducedMotion ? target : withTiming(target, SLIDE));
  }, [isOn, isReducedMotion, position]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * travel }],
  }));
  return (
    <View
      style={[styles.track, isOn ? styles.on : styles.off]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(testID === undefined ? {} : { testID })}
    >
      <Animated.View style={[styles.knob, knobStyle]}>
        <Icon name={isOn ? 'check' : 'dash'} color={theme.colors.icon} size={SPEC.knobIcon} />
      </Animated.View>
    </View>
  );
}
