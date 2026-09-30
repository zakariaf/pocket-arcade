// packages/shell/src/ui/icon-button.tsx
import { StyleSheet } from 'react-native';

import { PRESS_SQUASH } from '@e07/shell/theme/motion.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';
import { RaisedSurface } from './raised-surface.tsx';

import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';

const SPEC = COMPONENT_SPECS.iconButton;

export type IconButtonProps = {
  readonly icon: IconName;
  /** Required: an icon-only button has no visible text for VoiceOver to read. */
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
  readonly isReducedMotion: boolean;
  /** 'regular' 48 pt (top bars, pause) or 'small' 44 pt (undo and hint in the game top bar). */
  readonly size?: 'regular' | 'small';
  readonly isDisabled?: boolean;
  readonly hint?: string;
};

const styles = StyleSheet.create({
  regular: { width: SPEC.size, height: SPEC.size },
  small: { width: SPEC.sizeSmall, height: SPEC.sizeSmall },
});

/** A raised square key holding one icon: back, settings, pause, undo, hint. */
export function IconButton(props: IconButtonProps): ReactNode {
  const theme = useTheme();
  const size = props.size ?? 'regular';
  const isDisabled = props.isDisabled === true;
  return (
    <RaisedSurface
      label={props.label}
      onPress={props.onPress}
      testID={props.testID}
      elevation={SPEC.elevation}
      radius={size === 'regular' ? SPEC.radius : SPEC.radiusSmall}
      fill={theme.colors.surface}
      squash={PRESS_SQUASH.iconButton}
      isReducedMotion={props.isReducedMotion}
      isDisabled={isDisabled}
      {...(props.hint === undefined ? {} : { hint: props.hint })}
      faceStyle={size === 'regular' ? styles.regular : styles.small}
    >
      <Icon
        name={props.icon}
        color={isDisabled ? theme.colors.textMuted : theme.colors.icon}
        size={SPEC.icon}
      />
    </RaisedSurface>
  );
}
