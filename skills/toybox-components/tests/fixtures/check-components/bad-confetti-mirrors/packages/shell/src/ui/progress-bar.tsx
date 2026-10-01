// packages/shell/src/ui/progress-bar.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';

import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

const BAR = COMPONENT_SPECS.progressBar;
const PERCENT = 100;

export type ProgressBarProps = {
  /** 0..1 */
  readonly value: number;
  /** Translated description for VoiceOver ("28 of 90 stars"). */
  readonly label: string;
  readonly testID: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    track: {
      flex: 1,
      minWidth: BAR.minWidth,
      height: BAR.height,
      borderRadius: BAR.radius,
      borderWidth: BAR.border,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.sunken,
      overflow: 'hidden',
    },
    // Fills from the start edge (right to left in RTL) and closes with an ink edge at its end.
    fill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderEndWidth: BAR.fillEdge,
      borderEndColor: theme.colors.border,
    },
  });
  return styles;
});

/** A flat progress bar (S8 pack progress). Not interactive. */
export function ProgressBar({ value, label, testID }: ProgressBarProps): ReactNode {
  const styles = useStyles();
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: PERCENT, now: Math.round(clamped * PERCENT) }}
      testID={testID}
    >
      {clamped > 0 ? (
        <View style={[styles.fill, { width: `${String(clamped * PERCENT)}%` }]} />
      ) : null}
    </View>
  );
}
