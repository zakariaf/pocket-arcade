// packages/shell/src/ui/quiet-button.tsx
import { Pressable, StyleSheet, View } from 'react-native';

import { usePressFeedback } from '@e07/shell/app/press-feedback-context.tsx';
import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { PRESS_SQUASH } from '@e07/shell/theme/motion.ts';
import { MIN_TOUCH, STROKE } from '@e07/shell/theme/tokens.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';

import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';
import type { PressableStateCallbackType } from 'react-native';

const SPEC = COMPONENT_SPECS.quietButton;
const GAP = COMPONENT_SPECS.button.gap;
const NUDGE_ICON = 20;

export type QuietButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
  readonly isReducedMotion: boolean;
  readonly icon?: IconName;
  readonly iconEnd?: IconName;
  readonly isDisabled?: boolean;
  readonly hint?: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    // The design keeps a transparent 3 pt edge so quiet buttons line up with raised ones:
    // here the edge is folded into the padding. No edge and no shadow, ever.
    face: {
      minHeight: SPEC.minHeight,
      minWidth: MIN_TOUCH,
      paddingBlock: SPEC.paddingBlock + STROKE.bold,
      paddingInline: SPEC.paddingInline + STROKE.bold,
      borderRadius: COMPONENT_SPECS.button.radius,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      gap: GAP,
    },
    pressed: { backgroundColor: theme.colors.sunken },
    squashed: { transform: [{ scale: PRESS_SQUASH.quietButtonScale }] },
  });
  return styles;
});

/** A quiet nudge ("Restore purchase", "Home"): underlined text, pressed = sunken tint, tap feedback. */
export function QuietButton(props: QuietButtonProps): ReactNode {
  const styles = useStyles();
  const theme = useTheme();
  const onPressFeedback = usePressFeedback();
  const isDisabled = props.isDisabled === true;
  const color = isDisabled ? theme.colors.textMuted : theme.colors.icon;
  const pressedStyle = (state: PressableStateCallbackType): (object | false)[] => [
    styles.face,
    state.pressed && !isDisabled && styles.pressed,
    state.pressed && !isDisabled && !props.isReducedMotion && styles.squashed,
  ];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      {...(props.hint === undefined ? {} : { accessibilityHint: props.hint })}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => {
        onPressFeedback();
        props.onPress();
      }}
      style={pressedStyle}
      testID={props.testID}
    >
      {props.icon === undefined ? null : <Icon name={props.icon} color={color} size={NUDGE_ICON} />}
      <View>
        <AppText
          text={props.label}
          variant="nudge"
          tone={isDisabled ? 'muted' : 'default'}
          align="center"
        />
      </View>
      {props.iconEnd === undefined ? null : (
        <Icon name={props.iconEnd} color={color} size={NUDGE_ICON} />
      )}
    </Pressable>
  );
}
