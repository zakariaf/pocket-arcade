// packages/shell/src/ui/data-displays.test.tsx
import { screen, within } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { CalendarTile } from './calendar-tile.tsx';
import { EmptyState } from './empty-state.tsx';
import { HowToStage } from './how-to-stage.tsx';
import { PagerDots } from './pager-dots.tsx';
import { ScorePanel } from './score-panel.tsx';
import { StatGrid } from './stat-grid.tsx';
import { StatList } from './stat-list.tsx';
import { WeekBars } from './week-bars.tsx';
import { WeekLegend } from './week-legend.tsx';
import { WeekStrip } from './week-strip.tsx';

import type { WeekDay } from './week-strip.tsx';

const COLORS = TEST_PALETTE.standard.light;
const HIDDEN = { includeHiddenElements: true } as const;
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

const STATES = ['done', 'done', 'missed', 'done', 'done', 'done', 'today'] as const;

function weekDays(): readonly WeekDay[] {
  return LETTERS.map((letter, index) => ({
    letter,
    state: STATES[index] ?? 'done',
    isToday: index === 6,
    label: `day ${String(index + 1)}`,
  }));
}

describe('WeekStrip and WeekLegend', () => {
  it('labels each day and tags only today', async () => {
    await renderWithShell(
      <>
        <WeekStrip
          days={weekDays()}
          todayTagText="Today"
          testID="daily.week-strip"
          dayTestIDBase="daily.week-day"
        />
        <WeekLegend doneText="Done" missedText="Missed" testID="daily.week-card.legend" />
      </>,
    );

    expect(screen.getByRole('image', { name: 'day 3' })).toBeOnTheScreen();
    expect(screen.getByTestId('daily.week-card.legend.missed')).toBeOnTheScreen();
    expect(screen.getByTestId('daily.week-day.7.today-tag')).toBeOnTheScreen();
    expect(screen.queryByTestId('daily.week-day.1.today-tag')).not.toBeOnTheScreen();
    expect(screen.getByTestId('daily.week-day.1.mark')).toHaveStyle({
      width: 38,
      backgroundColor: COLORS.primary,
    });
    expect(screen.getByTestId('daily.week-day.3.mark')).toHaveStyle({ borderStyle: 'dashed' });
    expect(screen.getByText('Missed')).toBeOnTheScreen();
  });
});

describe('StatGrid and StatList', () => {
  it('builds value and label parts per cell and row', async () => {
    await renderWithShell(
      <>
        <StatGrid
          testIDBase="stats.overview-card"
          cells={[
            { id: 'games-played', value: '48', label: 'Games played' },
            { id: 'win-rate', value: '71%', label: 'Win rate' },
            { id: 'best-streak', value: '9', label: 'Best streak' },
          ]}
        />
        <StatList
          testIDBase="stats.best-card"
          heading={{ text: 'Score', testID: 'stats.best-card.score-heading' }}
          rows={[{ id: 'endless', label: 'Endless', value: '3,420' }]}
        />
      </>,
    );

    expect(screen.getByTestId('stats.overview-card.win-rate.value')).toHaveTextContent('71%');
    expect(screen.getByTestId('stats.overview-card.win-rate.value')).toHaveStyle({ fontSize: 30 });
    expect(screen.getByTestId('stats.overview-card.best-streak.label')).toHaveStyle({
      color: COLORS.textMuted,
    });
    expect(screen.getByTestId('stats.best-card.list')).toBeOnTheScreen();
    expect(screen.getByTestId('stats.best-card.endless.value')).toHaveStyle({ fontSize: 22 });
    expect(screen.getByRole('header', { name: 'Score' })).toBeOnTheScreen();
  });
});

describe('ScorePanel and WeekBars', () => {
  it('shows score parts, the New best sticker and a moves line for a moves-rated win', async () => {
    await renderWithShell(
      <ScorePanel
        testIDBase="result.score-card"
        label="Score"
        value="1,240"
        newBestText="New best!"
        progressLine="All 10 monsters defeated"
        line={{ kind: 'moves', text: '7 moves – par 7' }}
        isReducedMotion
      />,
    );

    expect(screen.getByTestId('result.score-card.value')).toHaveStyle({ fontSize: 44 });
    for (const part of ['label', 'new-best', 'progress-line']) {
      expect(screen.getByTestId(`result.score-card.${part}`)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('result.score-card.moves-line')).toHaveTextContent('7 moves – par 7');
    expect(screen.queryByTestId('result.score-card.score-line')).not.toBeOnTheScreen();
    // allow-style-assertion: the sticker sits at the end of the first row only through a row slot (Sticker is alignSelf flex-start)
    expect(screen.getByTestId('result.score-card.new-best').parent).toHaveStyle({
      flexDirection: 'row',
      justifyContent: 'flex-end',
    });
  });

  it('derives the score-line part for a score-rated win (spec S7)', async () => {
    await renderWithShell(
      <ScorePanel
        testIDBase="result.score-card"
        label="Score"
        value="1,840"
        progressLine="Monsters 10 / 10"
        line={{ kind: 'score', text: 'Score 1,840 – best 1,840' }}
        isReducedMotion
      />,
    );

    expect(screen.getByTestId('result.score-card.score-line')).toHaveTextContent(
      'Score 1,840 – best 1,840',
    );
    expect(screen.queryByTestId('result.score-card.moves-line')).not.toBeOnTheScreen();
  });

  it('puts each line id on the whole row (check and text), as the design measures it', async () => {
    await renderWithShell(
      <ScorePanel
        testIDBase="result.score-card"
        label="Score"
        value="1,840"
        progressLine="Monsters 10 / 10"
        line={{ kind: 'score', text: 'Score 1,840 – best 1,840' }}
        isReducedMotion
      />,
    );

    for (const [part, text] of [
      ['progress-line', 'Monsters 10 / 10'],
      ['score-line', 'Score 1,840 – best 1,840'],
    ] as const) {
      const row = screen.getByTestId(`result.score-card.${part}`);
      expect(within(row).getByText(text)).not.toBe(row);
    }
  });

  it('draws no third line when the result has none (daily, endless)', async () => {
    await renderWithShell(
      <ScorePanel
        testIDBase="result.score-card"
        label="Score"
        value="320"
        progressLine="Monsters 12"
        isReducedMotion
      />,
    );

    expect(screen.getByTestId('result.score-card.progress-line')).toBeOnTheScreen();
    expect(screen.queryByTestId('result.score-card.moves-line')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('result.score-card.score-line')).not.toBeOnTheScreen();
  });

  it('scales bars to the busiest day and hides the bar on zero days', async () => {
    await renderWithShell(
      <WeekBars
        testID="stats.week-card.chart"
        barTestIDBase="stats.week-bar"
        bars={[
          { value: 4, valueText: '4', day: 'M', label: 'Monday: 4 games' },
          { value: 0, valueText: '0', day: 'T', label: 'Tuesday: 0 games' },
          { value: 2, valueText: '2', day: 'W', label: 'Wednesday: 2 games' },
        ]}
      />,
    );

    expect(screen.getByTestId('stats.week-bar.1.bar')).toHaveStyle({ height: 92 });
    expect(screen.getByTestId('stats.week-bar.3.bar')).toHaveStyle({ height: 46 });
    expect(screen.queryByTestId('stats.week-bar.2.bar')).not.toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'Tuesday: 0 games' })).toBeOnTheScreen();
  });
});

describe('Decorative and empty displays', () => {
  it('hides the calendar tile and pager dots from screen readers', async () => {
    await renderWithShell(
      <>
        <CalendarTile monthText="Jun" dayText="14" testID="daily.today-card.calendar" />
        <PagerDots count={3} index={1} testID="how-to-play.pager-dots" />
        <HowToStage testID="how-to-play.stage">
          <View testID="how-to-play.picture" />
        </HowToStage>
      </>,
    );

    expect(screen.queryByTestId('daily.today-card.calendar')).not.toBeOnTheScreen();
    expect(screen.getByTestId('daily.today-card.calendar', HIDDEN)).toHaveStyle({ width: 88 });
    expect(screen.getByTestId('daily.today-card.calendar.day', HIDDEN)).toHaveTextContent('14');
    expect(screen.getByTestId('how-to-play.pager-dots.2', HIDDEN)).toHaveStyle({ width: 30 });
    expect(screen.getByTestId('how-to-play.pager-dots.1', HIDDEN)).toHaveStyle({ width: 12 });
    expect(screen.getByTestId('how-to-play.stage')).toHaveStyle({ borderRadius: 16 });
  });

  it('lays out the new-player column', async () => {
    await renderWithShell(
      <EmptyState
        testIDBase="stats.empty-state"
        picture={<View testID="stats.empty-drawing" />}
        title="No games yet"
        body="Play a round and your numbers show up here."
        action={<View testID="stats.play-button" />}
        footer={<View testID="stats.local-note" />}
      />,
    );

    expect(screen.getByRole('header', { name: 'No games yet' })).toBeOnTheScreen();
    expect(screen.getByTestId('stats.empty-state.body')).toHaveStyle({ fontSize: 18 });
    expect(screen.getByTestId('stats.empty-state.picture')).toBeOnTheScreen();
    expect(screen.getByTestId('stats.local-note')).toBeOnTheScreen();
  });
});
