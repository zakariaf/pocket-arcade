// packages/shell/src/ui/week-strip.tsx
import { StyleSheet, View } from 'react-native';

import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { WeekMark } from './week-mark.tsx';

import type { WeekMarkState } from './week-mark.tsx';
import type { ReactNode } from 'react';

const WEEK = COMPONENT_SPECS.weekStrip;
const TAG = WEEK.tag;
const TAG_OVERFLOW = 12;

export type WeekDay = {
  /** Weekday letter (date.weekday-strip.1..7), in the UI language. */
  readonly letter: string;
  readonly state: WeekMarkState;
  readonly isToday: boolean;
  /** The mark's label: daily.week.day-done / day-missed a11y label, or daily.today.label. */
  readonly label: string;
};

export type WeekStripProps = {
  /** Seven days, oldest first; the row mirrors (right to left) in fa and ckb. */
  readonly days: readonly WeekDay[];
  /** Translated "Today" for the tag under today's mark. */
  readonly todayTagText: string;
  /** The strip, `daily.week-strip`. */
  readonly testID: string;
  /** `daily.week-day`: columns `.1`..`.7` with `.letter`, `.mark` and `.today-tag`. */
  readonly dayTestIDBase: string;
};

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: WEEK.gap },
  day: { flex: 1, alignItems: 'center', gap: WEEK.dayGap },
  // "Today" (45 pt with its pads) is wider than a day column (43 pt): as in the design, the tag
  // overflows its column, centred, instead of wrapping inside it ("Toda / y"). The invisible
  // wrapper reaches TAG_OVERFLOW past the column on each side; nothing else moves.
  tagRoom: { alignSelf: 'stretch', alignItems: 'center', marginInline: -TAG_OVERFLOW },
  tag: {
    paddingBlock: TAG.paddingBlock,
    paddingInline: TAG.paddingInline,
    borderRadius: TAG.radius,
    borderWidth: TAG.border,
    transform: [{ rotate: `${String(TAG.rotate)}deg` }],
  },
});

type TodayTag = {
  readonly text: string;
  readonly paint: { readonly backgroundColor: string; readonly borderColor: string };
};

function dayColumn(day: WeekDay, id: string, tag: TodayTag): ReactNode {
  return (
    <View key={id} style={styles.day} testID={id}>
      <AppText text={day.letter} variant="weekdayLetter" tone="muted" testID={`${id}.letter`} />
      <WeekMark state={day.state} size="regular" label={day.label} testID={`${id}.mark`} />
      {day.isToday ? (
        <View style={styles.tagRoom}>
          <View style={[styles.tag, tag.paint]} testID={`${id}.today-tag`}>
            <AppText text={tag.text} variant="weekTodayTag" tone="toyInk" />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** The S9 week strip: seven equal columns of letter, mark and (today) the gold tag. */
export function WeekStrip(props: WeekStripProps): ReactNode {
  const { days, todayTagText, dayTestIDBase } = props;
  const shell = SHELL_COLORS[useTheme().scheme];
  const tag = {
    text: todayTagText,
    paint: { backgroundColor: shell.gold, borderColor: shell.toyInk },
  };
  return (
    <View style={styles.strip} testID={props.testID}>
      {days.map((day, index) => dayColumn(day, `${dayTestIDBase}.${String(index + 1)}`, tag))}
    </View>
  );
}
