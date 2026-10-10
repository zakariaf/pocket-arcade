// packages/shell/src/screens/daily/daily-today-card.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { CalendarTile } from '@e07/shell/ui/calendar-tile.tsx';
import { Chip } from '@e07/shell/ui/chip.tsx';
import { Panel } from '@e07/shell/ui/panel.tsx';

import type { DailyModel } from './daily-model.ts';
import type { ReactNode } from 'react';

export type DailyTodayCardProps = { readonly model: DailyModel };

/** Calendar tile to the text column. */
const TODAY_GAP = 18;

const styles = StyleSheet.create({
  column: { flex: 1, alignItems: 'flex-start', gap: 8 },
});

/** S9 today panel: the calendar tile, the "Today" chip and the date; after play, score and next-in. */
export function DailyTodayCard({ model }: DailyTodayCardProps): ReactNode {
  const t = useT();
  const result = model.todayResult;
  return (
    <Panel testID="daily.today-card" isRow gap={TODAY_GAP}>
      <CalendarTile
        testID="daily.today-card.calendar"
        monthText={model.monthText}
        dayText={model.dayText}
      />
      <View style={styles.column}>
        <Chip testID="daily.today-card.today-chip" text={t('daily.today.label')} />
        <AppText text={model.dateText} variant="heading" isHeader testID="daily.today-card.date" />
        {result === null ? null : (
          <>
            <AppText
              text={t('daily.today.score', { score: result.score })}
              testID="daily.today-card.score"
            />
            <AppText
              text={t('daily.next-in', { hours: result.hours, minutes: result.minutes })}
              tone="muted"
              testID="daily.today-card.next-in"
            />
          </>
        )}
      </View>
    </Panel>
  );
}
