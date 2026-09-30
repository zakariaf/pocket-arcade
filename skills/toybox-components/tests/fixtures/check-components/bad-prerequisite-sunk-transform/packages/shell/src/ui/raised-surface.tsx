// packages/shell/src/ui/raised-surface.tsx
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { usePressFeedback } from '@e07/shell/app/press-feedback-context.tsx';
import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { EASING, MOTION_MS, PRESS_SQUASH, RELEASE_SPRING } from '@e07/shell/theme/motion.ts';
import { MIN_TOUCH, STROKE } from '@e07/shell/theme/tokens.ts';

import type { ReactNode } from 'react';
import type { AccessibilityRole, PressableProps, StyleProp, ViewStyle } from 'react-native';

export type PressSquash = { readonly x: number; readonly y: number };

export type RaisedSurfaceProps = {
  /** Translated; also the accessibility label. */
  readonly label: string;
  /** The key's action; the tap feedback (sound) runs first, except for a switch (its handler plays the toggle feedback). */
  readonly onPress: () => void;
  readonly testID: string;
  /** ELEVATION.tile, .iconButton, .control or .hero: shadow offset and press depth. */
  readonly elevation: number;
  readonly radius: number;
  /** Face paint from the theme: colors.surface, .primary or .pop. */
  readonly fill: string;
  /** From useReduceMotion() in the screen model: sink without the squash. */
  readonly isReducedMotion: boolean;
  /** Squash at full press; default PRESS_SQUASH.button (1.03 x 0.94). */
  readonly squash?: PressSquash;
  /** Edge colour; default colors.border (danger buttons pass colors.danger). */
  readonly edgeColor?: string;
  /** Edge width; default STROKE.bold (tiles and segments pass STROKE.tile). */
  readonly edgeWidth?: number;
  /** Selected segment, chosen option, "on" pause key: pushed in, no shadow, still pressable. */
  readonly isPushedIn?: boolean;
  /** Dashed sunken face, pushed in, ignores presses. */
  readonly isDisabled?: boolean;
  /** Pushed in, keeps its paint, ignores presses; the label says what is happening. */
  readonly isBusy?: boolean;
  readonly accessibilityRole?: AccessibilityRole;
  readonly isSelected?: boolean;
  readonly isChecked?: boolean;
  readonly hint?: string;
  /** Layout of the face (padding, direction, alignment, min height) from the component. */
  readonly faceStyle?: StyleProp<ViewStyle>;
  /** Layout of the whole key in its parent (flex, alignSelf, width); never paint. */
  readonly layoutStyle?: StyleProp<ViewStyle>;
  /** Extra press-in / press-out work (hold-to-confirm); the sink animation always runs. */
  readonly onPressIn?: () => void;
  readonly onPressOut?: () => void;
  /** VoiceOver alternatives for hold gestures ('activate' replaces the double tap). */
  readonly accessibilityActions?: PressableProps['accessibilityActions'];
  readonly onAccessibilityAction?: PressableProps['onAccessibilityAction'];
  readonly children: ReactNode;
};

const PRESS_IN = { duration: MOTION_MS.pressIn, easing: Easing.bezier(...EASING.easeOut) };

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    // Same box as the face; it slides from `elevation` below the face to 0 as the key sinks.
    shadow: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },
    shadowPaint: { backgroundColor: theme.colors.shadow },
    face: {
      minHeight: MIN_TOUCH,
      minWidth: MIN_TOUCH,
      borderWidth: STROKE.bold,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    faceDisabled: {
      backgroundColor: theme.colors.sunken,
      borderColor: theme.colors.textMuted,
      borderStyle: 'dashed',
    },
  });
  return styles;
});

function faceOverrides(props: RaisedSurfaceProps): ViewStyle {
  return {
    borderRadius: props.radius,
    backgroundColor: props.fill,
    ...(props.edgeColor === undefined ? {} : { borderColor: props.edgeColor }),
    ...(props.edgeWidth === undefined ? {} : { borderWidth: props.edgeWidth }),
  };
}

function a11yProps(props: RaisedSurfaceProps, isInactive: boolean): PressableProps {
  return {
    accessibilityLabel: props.label,
    ...(props.accessibilityActions === undefined
      ? {}
      : { accessibilityActions: props.accessibilityActions }),
    ...(props.onAccessibilityAction === undefined
      ? {}
      : { onAccessibilityAction: props.onAccessibilityAction }),
    ...(props.hint === undefined ? {} : { accessibilityHint: props.hint }),
    accessibilityState: {
      disabled: isInactive,
      busy: props.isBusy === true,
      ...(props.isSelected === undefined ? {} : { selected: props.isSelected }),
      ...(props.isChecked === undefined ? {} : { checked: props.isChecked }),
    },
  };
}

/**
 * A Toybox key: ink outline, hard shadow, and a press that sinks into the shadow and springs back.
 * Every press also runs the Shell's tap feedback (usePressFeedback, silent without its provider).
 */
export function RaisedSurface(props: RaisedSurfaceProps): ReactNode {
  const { elevation, isReducedMotion, isDisabled = false } = props;
  const styles = useStyles();
  const depth = useSharedValue(0);
  const squash = props.squash ?? PRESS_SQUASH.button;
  const squashFactor = isReducedMotion ? 0 : 1;
  const isInactive = isDisabled || props.isBusy === true;
  const isSunk = isInactive || props.isPushedIn === true;
  const role = props.accessibilityRole ?? 'button';
  const onPressFeedback = usePressFeedback();

  const keyStyle = useAnimatedStyle(() => {
    const sunk = isSunk ? 1 : depth.get();
    const pressed = isSunk ? 0 : depth.get();
    return {
      transform: [
        { translateY: sunk * elevation },
        { scaleX: 1 + squash.x * squashFactor * pressed },
        { scaleY: 1 + squash.y * squashFactor * pressed },
      ],
    };
  });
  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - (isSunk ? 1 : depth.get())) * elevation }],
  }));

  function handlePressIn(): void {
    depth.set(withTiming(1, PRESS_IN));
    props.onPressIn?.();
  }
  function handlePressOut(): void {
    depth.set(withSpring(0, RELEASE_SPRING));
    props.onPressOut?.();
  }
  function handlePress(): void {
    if (role !== 'switch') onPressFeedback();
    props.onPress();
  }

  return (
    <Pressable
      accessibilityRole={role}
      {...a11yProps(props, isInactive)}
      disabled={isInactive}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      testID={props.testID}
      {...(props.layoutStyle === undefined ? {} : { style: props.layoutStyle })}
    >
      <Animated.View style={keyStyle}>
        <Animated.View
          style={[styles.shadow, styles.shadowPaint, { borderRadius: props.radius }, shadowStyle]}
        />
        <View
          style={[
            styles.face,
            faceOverrides(props),
            isDisabled && styles.faceDisabled,
            props.faceStyle,
          ]}
        >
          {props.children}
        </View>
      </Animated.View>
    </Pressable>
  );
}
