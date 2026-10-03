// packages/shell/src/ui/key-button.tsx
import { StyleSheet } from 'react-native';

import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';
import { RaisedSurface } from './raised-surface.tsx';

import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';

const KEY = COMPONENT_SPECS.key;
const BUTTON = COMPONENT_SPECS.button;

export type KeyButtonProps = {
  readonly icon: IconName;
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
  readonly isReducedMotion: boolean;
};

const styles = StyleSheet.create({
  face: {
    minHeight: KEY.minHeight,
    paddingBlock: KEY.paddingBlock,
    paddingInline: KEY.paddingInline,
    gap: KEY.gap,
  },
  // Three keys share a row (column gap 10); at 200 % text the row stacks them. Grow into the
  // pair cell but keep the content height: flex: 1 (a zero basis) collapses a column cell.
  cell: { flexGrow: 1 },
});

/** A Home key (Levels, Statistics, How to play): icon over a one- or two-line label. */
export function KeyButton(props: KeyButtonProps): ReactNode {
  const theme = useTheme();
  return (
    <RaisedSurface
      label={props.label}
      onPress={props.onPress}
      testID={props.testID}
      elevation={BUTTON.elevation}
      radius={BUTTON.radius}
      fill={theme.colors.surface}
      isReducedMotion={props.isReducedMotion}
      faceStyle={styles.face}
      layoutStyle={styles.cell}
    >
      <Icon name={props.icon} color={theme.colors.icon} size={KEY.icon} />
      <AppText text={props.label} variant="keyLabel" align="center" />
    </RaisedSurface>
  );
}
