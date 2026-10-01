// packages/shell/src/screens/stats/stats-panels.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { StatGrid } from '@e07/shell/ui/stat-grid.tsx';
import { StatList } from '@e07/shell/ui/stat-list.tsx';
import { WeekBars } from '@e07/shell/ui/week-bars.tsx';

import { StatPanel } from './stat-panel.tsx';
import { bestRows, dailyCells, gameCells, levelCells, overviewCells } from './stats-cells.ts';

import type { StatsModel } from './stats-model.ts';
import type { WeekBar } from '@e07/shell/ui/week-bars.tsx';
import type { ReactNode } from 'react';

export type StatsPanelsProps = { readonly model: StatsModel };

const DAYS_SHOWN = 7;
/** The chart sits 8 pt under the week panel's subtitle. */
const CHART_MARGIN_TOP = 8;

const styles = StyleSheet.create({
  chart: { marginTop: CHART_MARGIN_TOP },
});

/** S10 panels in design order: overview, levels, best, daily, last 7 days, the game's own. */
export function StatsPanels({ model }: StatsPanelsProps): ReactNode {
  const t = useT();
  const bars: readonly WeekBar[] = model.snapshot.week.map((day) => ({
    value: day.games,
    valueText: model.formatNumber(day.games),
    day: day.letter,
    label: t('stats.week.bar.a11y-label', {
      weekdayName: day.weekdayName,
      gamesCount: day.games,
    }),
  }));
  return (
    <>
      <StatPanel
        testID="stats.overview-card"
        leading={{ kind: 'icon', icon: 'stats' }}
        title={t('stats.overview.title')}
      >
        <StatGrid testIDBase="stats.overview-card" columns={2} cells={overviewCells(model, t)} />
      </StatPanel>
      <StatPanel
        testID="stats.levels-card"
        leading={{ kind: 'icon', icon: 'grid' }}
        title={t('common.levels')}
      >
        <StatGrid testIDBase="stats.levels-card" columns={3} cells={levelCells(model, t)} />
      </StatPanel>
      <StatPanel
        testID="stats.best-card"
        // The design's star(true): the gold two-colour rating star on the pop tile.
        leading={{ kind: 'icon', icon: 'rating-star' }}
        title={t('stats.best.title')}
      >
        <StatList
          testIDBase="stats.best-card"
          heading={{ testID: 'stats.best-card.score-heading', text: t('stats.best.score') }}
          rows={bestRows(model, t)}
        />
      </StatPanel>
      <StatPanel
        testID="stats.daily-card"
        leading={{ kind: 'icon', icon: 'calendar' }}
        title={t('daily.title')}
      >
        <StatGrid testIDBase="stats.daily-card" columns={3} cells={dailyCells(model, t)} />
      </StatPanel>
      <StatPanel
        testID="stats.week-card"
        leading={{ kind: 'icon', icon: 'stats' }}
        title={t('daily.week.title', { daysCount: DAYS_SHOWN })}
      >
        <AppText
          text={t('stats.week.subtitle')}
          variant="rowDescription"
          tone="muted"
          testID="stats.week-card.subtitle"
        />
        <View style={styles.chart}>
          <WeekBars testID="stats.week-card.chart" barTestIDBase="stats.week-bar" bars={bars} />
        </View>
      </StatPanel>
      <StatPanel
        testID="stats.game-card"
        leading={{ kind: 'logo', logo: model.logo }}
        title={t('stats.game.title', { gameName: model.gameName })}
      >
        <StatGrid testIDBase="stats.game-card" columns={3} cells={gameCells(model)} />
      </StatPanel>
    </>
  );
}
