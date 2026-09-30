// packages/shell/src/screens/daily/daily-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { DailyView } from './daily-view.tsx';

import type { DailyModel, WeekDayModel } from './daily-model.ts';

const LETTERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const STATES = ['missed', 'done', 'done', 'done', 'done', 'done', 'today'] as const;

const WEEK: readonly WeekDayModel[] = LETTERS.map((letter, index) => ({
  letter,
  weekdayName: letter,
  state: STATES[index] ?? 'missed',
  isToday: index === LETTERS.length - 1,
}));

function modelWith(overrides: Partial<DailyModel> = {}): DailyModel {
  return {
    monthText: 'Sep',
    dayText: '27',
    dateText: 'Sunday, 27 Sep',
    todayResult: null,
    currentStreak: 5,
    bestStreak: 12,
    week: WEEK,
    isReducedMotion: false,
    onBack: jest.fn(),
    onPlay: jest.fn(),
    onReplay: jest.fn(),
    ...overrides,
  };
}

describe('DailyView', () => {
  it('draws every S9 element with its design testID', async () => {
    await renderWithShell(<DailyView model={modelWith()} />);

    const days = [1, 2, 3, 4, 5, 6, 7].flatMap((day) => [
      `daily.week-day.${String(day)}`,
      `daily.week-day.${String(day)}.letter`,
      `daily.week-day.${String(day)}.mark`,
    ]);
    for (const testID of [
      'daily.screen',
      'daily.top-bar.back-button',
      'daily.top-bar.title',
      'daily.today-card',
      'daily.today-card.calendar',
      'daily.today-card.calendar.month',
      'daily.today-card.calendar.day',
      'daily.today-card.today-chip',
      'daily.today-card.date',
      'daily.play-button',
      'daily.current-streak-card.icon',
      'daily.current-streak-card.label',
      'daily.current-streak-card.value',
      'daily.best-streak-card.icon',
      'daily.best-streak-card.value',
      'daily.streak-rule',
      'daily.streak-rule.icon',
      'daily.week-card.title',
      'daily.week-strip',
      'daily.week-day.7.today-tag',
      'daily.week-card.legend.done',
      'daily.week-card.legend.missed',
      ...days,
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.getByRole('image', { name: /^.?Mon.?: missed$/ })).toBeOnTheScreen();
    expect(screen.getByText('Last 7 days')).toBeOnTheScreen();

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('turns into Replay with the score once today is played', async () => {
    const model = modelWith({ todayResult: { score: 1840, hours: 3, minutes: 5 } });
    const user = userEvent.setup();
    await renderWithShell(<DailyView model={model} />);

    expect(screen.queryByTestId('daily.play-button')).toBeNull();
    expect(screen.getByTestId('daily.today-card.score')).toHaveTextContent(
      'Your score today: 1,840',
    );
    expect(screen.getByTestId('daily.today-card.next-in')).toBeOnTheScreen();
    expect(screen.getByTestId('daily.replay-note')).toBeOnTheScreen();
    await user.press(screen.getByTestId('daily.replay-button'));

    expect(model.onReplay).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
