// packages/shell/src/screens/daily/daily-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { ancestorStyle, HIDDEN, iconsIn } from '@e07/shell/testing/rendered-parts.ts';

import { DailyView } from './daily-view.tsx';

import type { DailyModel, WeekDayModel } from './daily-model.ts';
import type * as WindowClassModule from '@e07/shell/ui/window-class.ts';
import type { ViewStyle } from 'react-native';
import type { TestInstance } from 'test-renderer';

jest.mock('@e07/shell/ui/icons/icon-raster.ts', () => ({
  getIconUri: (name: string) => `icon:${name}`,
}));
/** The text size the screen sees: 1 normally, 2 for the 200 % text case. */
const mockFontScale = { current: 1 };
jest.mock('@e07/shell/ui/use-window-class.ts', () => {
  const { classifyWindow } = jest.requireActual<typeof WindowClassModule>(
    '@e07/shell/ui/window-class.ts',
  );
  return { useWindowClass: () => classifyWindow(402, 874, mockFontScale.current) };
});

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

  it('draws the last seven days oldest first, today last with its tag, each mark named (spec S9)', async () => {
    await renderWithShell(<DailyView model={modelWith()} />);
    const columns = [1, 2, 3, 4, 5, 6, 7].map((day) => `daily.week-day.${String(day)}`);

    expect(columns.map((testID) => screen.getByTestId(testID, HIDDEN))).toHaveLength(7);
    expect(screen.getByTestId('daily.week-day.7.today-tag', HIDDEN)).toHaveTextContent('Today');
    expect(screen.getByRole('image', { name: /^.?Mon.?: missed$/ })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: /^.?Tue.?: done$/ })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'Today' })).toBeOnTheScreen();
    // Shape before colour (spec 8.11): a cross, a check and a play mark.
    expect(iconsIn('daily.week-day.1.mark')).toStrictEqual(['close']);
    expect(iconsIn('daily.week-day.2.mark')).toStrictEqual(['check']);
    expect(iconsIn('daily.week-day.7.mark')).toStrictEqual(['play']);
    expect(screen.getByTestId('daily.week-card.legend.done', HIDDEN)).toHaveTextContent('Done');
    expect(screen.getByTestId('daily.week-card.legend.missed', HIDDEN)).toHaveTextContent('Missed');
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('runs the strip in a plain row, oldest to today, so Monday sits on the right in fa (7.5)', async () => {
    const letters = ['د', 'س', 'چ', 'پ', 'ج', 'ش', 'ی'];
    const week = WEEK.map((day, index) => ({ ...day, letter: letters[index] ?? '' }));
    await renderWithShell(<DailyView model={modelWith({ week, dayText: '۲۷' })} />, {
      language: 'fa',
      direction: 'rtl',
    });
    const strip = screen.getByTestId('daily.week-strip', HIDDEN);
    const order = strip
      .queryAll((node: TestInstance) => /^daily\.week-day\.\d$/.test(String(node.props['testID'])))
      .map((node) => String(node.props['testID']));

    // allow-style-assertion: a plain row (never row-reverse) is what mirrors the strip in RTL.
    expect(strip).toHaveStyle({ flexDirection: 'row' });
    expect(order).toStrictEqual(
      [1, 2, 3, 4, 5, 6, 7].map((day) => `daily.week-day.${String(day)}`),
    );
    expect(screen.getByTestId('daily.week-day.1.letter', HIDDEN)).toHaveTextContent('د');
    expect(screen.getByTestId('daily.today-card.calendar.day', HIDDEN)).toHaveTextContent('۲۷');
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it("swaps Play for Replay, its note, today's score and the countdown once played", async () => {
    await renderWithShell(
      <DailyView model={modelWith({ todayResult: { score: 1840, hours: 3, minutes: 5 } })} />,
    );

    expect(screen.queryByTestId('daily.play-button')).not.toBeOnTheScreen();
    expect(screen.getByTestId('daily.replay-button')).toHaveTextContent('Play again for fun');
    expect(screen.getByTestId('daily.replay-note')).toHaveTextContent(
      'Replays don’t change today’s result.',
    );
    expect(screen.getByTestId('daily.today-card.score')).toBeOnTheScreen();
    expect(screen.getByTestId('daily.today-card.next-in')).toHaveTextContent(
      'Next challenge in 3 h 5 min',
    );
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('shows no banner (spec 8.8: banners only on Home, Levels and Statistics)', async () => {
    await renderWithShell(<DailyView model={modelWith()} />);

    const banners = screen.container.queryAll((node: TestInstance) =>
      String(node.props['testID']).endsWith('.banner-ad'),
    );
    expect(banners).toStrictEqual([]);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('stacks the two streak panels in one column at 200 % text (spec 8.11)', async () => {
    mockFontScale.current = 2;
    try {
      await renderWithShell(<DailyView model={modelWith()} />);
      const isPairRow = (style: ViewStyle): boolean => style.gap === 12;

      // allow-style-assertion: the stacked column is the 200 % text layout (usePairLayout).
      expect(ancestorStyle('daily.current-streak-card', isPairRow)).toMatchObject({
        flexDirection: 'column',
      });
      // allow-style-assertion: both panels sit in that one column.
      expect(ancestorStyle('daily.best-streak-card', isPairRow)).toMatchObject({
        flexDirection: 'column',
      });
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    } finally {
      mockFontScale.current = 1;
    }
  });
});
