// packages/shell/src/ui/calendar-tile.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

const CAL = COMPONENT_SPECS.calendarTile;
/** The spec writes paddings as CSS shorthand (top, inline, bottom). */
const MONTH_TOP = CAL.monthPadding[0] ?? 0;
const MONTH_BOTTOM = CAL.monthPadding[2] ?? 0;
const DAY_TOP = CAL.dayPadding[0] ?? 0;
const DAY_BOTTOM = CAL.dayPadding[2] ?? 0;

export type CalendarTileProps = {
  /** Short month from Intl ("Jun"), in the chosen digits and script. */
  readonly monthText: string;
  /** Day of the month, formatted in the chosen digits. */
  readonly dayText: string;
  /** `daily.today-card.calendar`: parts `.month` and `.day`. */
  readonly testID: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    tile: {
      width: CAL.width,
      overflow: 'hidden',
      borderWidth: CAL.border,
      borderRadius: CAL.radius,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      transform: [{ rotate: `${String(CAL.rotate)}deg` }],
    },
    month: {
      alignItems: 'center',
      paddingTop: MONTH_TOP,
      paddingBottom: MONTH_BOTTOM,
      borderBottomWidth: CAL.border,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.primary,
    },
    day: { alignItems: 'center', paddingTop: DAY_TOP, paddingBottom: DAY_BOTTOM },
  });
  return styles;
});

/** The S9 tear-off calendar: month band over the day. Decorative: the date is also written out. */
export function CalendarTile({ monthText, dayText, testID }: CalendarTileProps): ReactNode {
  const styles = useStyles();
  return (
    <View
      style={styles.tile}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <View style={styles.month}>
        <AppText
          text={monthText}
          variant="calendarMonth"
          tone="onPrimary"
          testID={`${testID}.month`}
        />
      </View>
      <View style={styles.day}>
        <AppText text={dayText} variant="calendarDay" testID={`${testID}.day`} />
      </View>
    </View>
  );
}
