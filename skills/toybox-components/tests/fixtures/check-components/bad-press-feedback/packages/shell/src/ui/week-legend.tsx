// packages/shell/src/ui/week-legend.tsx
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text.tsx';
import { WeekMark } from './week-mark.tsx';

import type { ReactNode } from 'react';

const ROW_GAP = 8;
const COLUMN_GAP = 18;
const MARGIN_TOP = 14;
const ITEM_GAP = 8;

export type WeekLegendProps = {
  /** Translated "Done" and "Missed". */
  readonly doneText: string;
  readonly missedText: string;
  /** `daily.week-card.legend`: items `.done` and `.missed`. */
  readonly testID: string;
};

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: ROW_GAP,
    columnGap: COLUMN_GAP,
    marginTop: MARGIN_TOP,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: ITEM_GAP },
});

/** The key under the week strip: 22 pt marks with "Done" and "Missed"; wraps at 200 % text. */
export function WeekLegend({ doneText, missedText, testID }: WeekLegendProps): ReactNode {
  return (
    <View style={styles.legend} testID={testID}>
      <View style={styles.item} testID={`${testID}.done`}>
        <WeekMark state="done" size="xs" />
        <AppText text={doneText} variant="legend" tone="muted" />
      </View>
      <View style={styles.item} testID={`${testID}.missed`}>
        <WeekMark state="missed" size="xs" />
        <AppText text={missedText} variant="legend" tone="muted" />
      </View>
    </View>
  );
}
