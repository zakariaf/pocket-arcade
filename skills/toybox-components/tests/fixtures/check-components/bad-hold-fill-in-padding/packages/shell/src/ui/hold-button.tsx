// packages/shell/src/ui/hold-button.tsx
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';
import { RaisedSurface } from './raised-surface.tsx';
import { useHoldToConfirm } from './use-hold-to-confirm.ts';

import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';
import type { AccessibilityActionEvent } from 'react-native';

const BUTTON = COMPONENT_SPECS.button;
const PERCENT = 100;
const ACTIONS = [{ name: 'activate' }] as const;

export type HoldButtonProps = {
  /** Translated ("Hold to reset"). */
  readonly label: string;
  /** dialog.reset-progress.hold-hint ("Hold for 2 seconds"); VoiceOver users confirm with a double tap. */
  readonly hint: string;
  readonly onConfirm: () => void;
  readonly testID: string;
  readonly isReducedMotion: boolean;
  readonly icon?: IconName;
  /**
   * 0 to 1: hold the fill at this value with no timer (read at mount). Only the parity capture
   * of the reset dialog passes it (0.46, as the design draws the key mid-hold).
   */
  readonly frozenProgress?: number;
};

const styles = StyleSheet.create({
  face: {
    minHeight: BUTTON.minHeight,
    paddingBlock: BUTTON.paddingBlock,
    paddingInline: BUTTON.paddingInline,
    gap: BUTTON.gap,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  // Grows from the start edge (right to left in RTL) under the label while the finger is down.
  fill: { position: 'absolute', top: 0, bottom: 0, start: 0 },
  block: { alignSelf: 'stretch' },
});

function noop(): void {
  // A short tap does nothing: only a completed 2 s hold (or VoiceOver's activate) confirms.
}

/** The S14 reset key: a danger block button that confirms after a 2 s hold. */
export function HoldButton(props: HoldButtonProps): ReactNode {
  const theme = useTheme();
  const hold = useHoldToConfirm(props.onConfirm, props.frozenProgress);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${String(hold.progress.get() * PERCENT)}%`,
  }));
  const handleAction = (event: AccessibilityActionEvent): void => {
    if (event.nativeEvent.actionName === 'activate') props.onConfirm();
  };
  return (
    <RaisedSurface
      label={props.label}
      hint={props.hint}
      onPress={noop}
      onPressIn={hold.handlePressIn}
      onPressOut={hold.handlePressOut}
      accessibilityActions={ACTIONS}
      onAccessibilityAction={handleAction}
      testID={props.testID}
      elevation={BUTTON.elevation}
      radius={BUTTON.radius}
      fill={theme.colors.surface}
      edgeColor={theme.colors.danger}
      isReducedMotion={props.isReducedMotion}
      faceStyle={styles.face}
      layoutStyle={styles.block}
    >
      <Animated.View
        style={[styles.fill, { backgroundColor: SHELL_COLORS[theme.scheme].dangerFill }, fillStyle]}
        testID={`${props.testID}.fill`}
      />
      {props.icon === undefined ? null : (
        <Icon name={props.icon} color={theme.colors.danger} size={BUTTON.iconSize} />
      )}
      <View>
        <AppText text={props.label} variant="label" tone="danger" align="center" />
      </View>
    </RaisedSurface>
  );
}
