// packages/shell/src/screens/daily/daily-week-card.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Panel } from '@e07/shell/ui/panel.tsx';
import { WeekLegend } from '@e07/shell/ui/week-legend.tsx';
import { WeekStrip } from '@e07/shell/ui/week-strip.tsx';

import type { WeekDayModel } from './daily-model.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { WeekDay } from '@e07/shell/ui/week-strip.tsx';
import type { ReactNode } from 'react';

export type DailyWeekCardProps = { readonly week: readonly WeekDayModel[] };

const DAYS_SHOWN = 7;

/** The strip sits 12 pt under the heading; WeekLegend brings its own 14 pt top margin. */
const STRIP_MARGIN_TOP = 12;

const styles = StyleSheet.create({
  strip: { marginTop: STRIP_MARGIN_TOP },
});

/** The mark's VoiceOver label: "Mon: done", "Mon: missed", or "Today". */
function markLabel(t: TFunction, day: WeekDayModel): string {
  if (day.state === 'today') return t('daily.today.label');
  const key =
    day.state === 'done' ? 'daily.week.day-done.a11y-label' : 'daily.week.day-missed.a11y-label';
  return t(key, { weekdayName: day.weekdayName });
}

/** S9 week panel: "Last 7 days", the strip (columns keyed 1..7 by position), the legend. */
export function DailyWeekCard({ week }: DailyWeekCardProps): ReactNode {
  const t = useT();
  const days: readonly WeekDay[] = week.map((day) => ({
    letter: day.letter,
    state: day.state,
    isToday: day.isToday,
    label: markLabel(t, day),
  }));
  return (
    <Panel testID="daily.week-card" gap={0}>
      <AppText
        text={t('daily.week.title', { daysCount: DAYS_SHOWN })}
        variant="heading"
        isHeader
        testID="daily.week-card.title"
      />
      <View style={styles.strip}>
        <WeekStrip
          testID="daily.week-strip"
          dayTestIDBase="daily.week-day"
          days={days}
          todayTagText={t('daily.today.label')}
        />
      </View>
      <WeekLegend
        testID="daily.week-card.legend"
        doneText={t('daily.week.done')}
        missedText={t('daily.week.missed')}
      />
    </Panel>
  );
}
