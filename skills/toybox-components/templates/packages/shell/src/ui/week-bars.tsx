// packages/shell/src/ui/week-bars.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

const BARS = COMPONENT_SPECS.barChart;

export type WeekBar = {
  /** Games (or points) that day; the bar is value / max x 92 pt. */
  readonly value: number;
  /** The value in the chosen digits. */
  readonly valueText: string;
  /** Weekday letter under the bar. */
  readonly day: string;
  /** stats.week.bar.a11y-label ("Monday: 3 games"). */
  readonly label: string;
};

export type WeekBarsProps = {
  /** Seven days, oldest first; the row mirrors (right to left) in fa and ckb. */
  readonly bars: readonly WeekBar[];
  /** The chart, `stats.week-card.chart`. */
  readonly testID: string;
  /** `stats.week-bar`: columns `.1`..`.7` (labelled images) with `.value`, `.bar` and `.day`. */
  readonly barTestIDBase: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    chart: { flexDirection: 'row' },
    column: { flex: 1, alignItems: 'center' },
    // Plot area: bottom-aligned on a 3 pt outline baseline.
    plot: {
      alignSelf: 'stretch',
      height: BARS.plotHeight,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: BARS.valueGap,
      borderBottomWidth: BARS.baseline,
      borderColor: theme.colors.border,
    },
    bar: {
      width: BARS.barWidth,
      borderTopWidth: BARS.border,
      borderStartWidth: BARS.border,
      borderEndWidth: BARS.border,
      borderTopStartRadius: BARS.barRadiusTop,
      borderTopEndRadius: BARS.barRadiusTop,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.primary,
    },
    day: { marginTop: BARS.dayMarginTop },
  });
  return styles;
});

/** The S10 "last 7 days" bars: value over bar, day letter under the baseline. */
export function WeekBars({ bars, testID, barTestIDBase }: WeekBarsProps): ReactNode {
  const styles = useStyles();
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <View style={styles.chart} testID={testID}>
      {bars.map((bar, index) => {
        const id = `${barTestIDBase}.${String(index + 1)}`;
        const height = (bar.value / max) * BARS.maxBar;
        return (
          <View
            key={id}
            style={styles.column}
            accessible
            accessibilityRole="image"
            accessibilityLabel={bar.label}
            testID={id}
          >
            <View style={styles.plot}>
              <AppText text={bar.valueText} variant="barValue" testID={`${id}.value`} />
              {bar.value > 0 ? (
                <View style={[styles.bar, { height }]} testID={`${id}.bar`} />
              ) : null}
            </View>
            <View style={styles.day}>
              <AppText text={bar.day} variant="barDay" tone="muted" testID={`${id}.day`} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
