// packages/shell/src/ui/streak-card.tsx
// Example: a flat information card with a raised action key, built only from the Toybox theme
// module. Panels lie flat (outline, no shadow); the one pressable part is a RaisedSurface.
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { ELEVATION, LAYOUT, RADII, SPACING, STROKE } from '@e07/shell/theme/tokens.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { RaisedSurface } from './raised-surface.tsx';

import type { ReactNode } from 'react';

export type StreakCardProps = {
  /** Translated: "Current streak". */
  readonly title: string;
  /** Formatted in the chosen digits: "5 days". */
  readonly value: string;
  /** Translated: "Play today's puzzle". */
  readonly actionLabel: string;
  readonly onAction: () => void;
  /** From useReduceMotion() in the screen model. */
  readonly isReducedMotion: boolean;
  readonly testID: string;
};

const useStyles = makeStyles((theme) => {
  const shell = SHELL_COLORS[theme.scheme];
  const styles = StyleSheet.create({
    card: {
      gap: SPACING.md,
      borderWidth: STROKE.bold,
      borderColor: theme.colors.border,
      borderRadius: RADII.md,
      backgroundColor: theme.colors.surface,
      paddingBlock: LAYOUT.panelPaddingBlock,
      paddingInline: LAYOUT.panelPaddingInline,
    },
    rule: { borderTopWidth: STROKE.hair, borderTopColor: shell.line },
    actionFace: { paddingBlock: SPACING.sm, paddingInline: SPACING.lg },
  });
  return styles;
});

export function StreakCard(props: StreakCardProps): ReactNode {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.card} testID={props.testID}>
      <AppText text={props.title} variant="streakLabel" tone="muted" isHeader />
      <AppText text={props.value} variant="streakValue" />
      <View style={styles.rule} />
      <RaisedSurface
        label={props.actionLabel}
        onPress={props.onAction}
        testID={`${props.testID}.action-button`}
        elevation={ELEVATION.control}
        radius={RADII.md}
        fill={theme.colors.primary}
        isReducedMotion={props.isReducedMotion}
        faceStyle={styles.actionFace}
      >
        <AppText text={props.actionLabel} variant="label" tone="onPrimary" align="center" />
      </RaisedSurface>
    </View>
  );
}
