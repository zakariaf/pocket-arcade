// packages/shell/src/screens/stats/stats-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { createNumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { HIDDEN, iconsIn } from '@e07/shell/testing/rendered-parts.ts';

import { StatsView } from './stats-view.tsx';

import type { StatsModel, StatsSnapshot } from './stats-model.ts';
import type { LogoArt } from '@e07/shell/art/logo-art.ts';
import type { TestInstance } from 'test-renderer';

jest.mock('@e07/shell/ui/icons/icon-raster.ts', () => ({
  getIconUri: (name: string) => `icon:${name}`,
}));

/** The nearest ancestor of a part that is a scroll view (the S10 body). */
function scrollViewAround(testID: string): TestInstance | null {
  let node = screen.getByTestId(testID, HIDDEN).parent;
  while (node !== null && !node.type.includes('ScrollView')) node = node.parent;
  return node;
}

const LOGO: LogoArt = { layers: [{ role: 'p', d: 'M22 2.5H26V17.5H22Z' }] };

const LETTERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const GAMES = [0, 3, 5, 2, 6, 4, 1] as const;

const SNAPSHOT: StatsSnapshot = {
  gamesPlayed: 58,
  wins: 36,
  winRate: 0.62,
  playHours: 2,
  playMinutes: 14,
  levelsCompleted: 11,
  starsEarned: 28,
  starsTotal: 270,
  threeStarLevels: 7,
  bestLevels: 2310,
  bestDaily: 1840,
  bestEndless: 4210,
  bestLevelScore: { level: 9, score: 2310 },
  bestWinStreak: 9,
  dailyCompleted: 19,
  currentStreak: 5,
  bestStreak: 12,
  week: LETTERS.map((letter, index) => ({
    letter,
    weekdayName: letter,
    games: GAMES[index] ?? 0,
  })),
  gameStats: [
    { key: 'monsters-defeated', label: 'Monsters defeated', valueText: '312' },
    { key: 'beams-fired', label: 'Beams fired', valueText: '87' },
    { key: 'biggest-combo', label: 'Biggest combo', valueText: '×6' },
  ],
};

function modelWith(overrides: Partial<StatsModel> = {}): StatsModel {
  return {
    isEmpty: false,
    snapshot: SNAPSHOT,
    gameName: 'Line Siege',
    logo: LOGO,
    formatNumber: (value) => value.toString(),
    formatPercent: (rate) => `${String(Math.round(rate * 100))}%`,
    isReducedMotion: false,
    banner: { renderBanner: () => null, isAllowed: true },
    onBack: jest.fn(),
    onReset: jest.fn(),
    onPlay: jest.fn(),
    ...overrides,
  };
}

const CELLS = [
  'stats.overview-card.games-played',
  'stats.overview-card.wins',
  'stats.overview-card.win-rate',
  'stats.overview-card.play-time',
  'stats.levels-card.completed',
  'stats.levels-card.stars',
  'stats.levels-card.three-star',
  'stats.daily-card.completed',
  'stats.daily-card.current-streak',
  'stats.daily-card.best-streak',
  'stats.game-card.monsters-defeated',
  'stats.game-card.beams-fired',
  'stats.game-card.biggest-combo',
].flatMap((id) => [id, `${id}.value`, `${id}.label`]);

describe('StatsView', () => {
  it('shows the win rate as the bare percentage under its label (the design: 62% over "Win rate")', async () => {
    await renderWithShell(<StatsView model={modelWith()} />);

    expect(screen.getByTestId('stats.overview-card.win-rate.value')).toHaveTextContent('62%', {
      exact: true,
    });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws every S10 panel with its design testIDs', async () => {
    await renderWithShell(<StatsView model={modelWith()} />);

    for (const testID of [
      'stats.screen',
      'stats.top-bar.title',
      'stats.overview-card.icon',
      'stats.overview-card.title',
      'stats.best-card.list',
      'stats.best-card.score-heading',
      'stats.best-card.endless.value',
      'stats.best-card.level-score.value',
      'stats.week-card.subtitle',
      'stats.week-card.chart',
      'stats.week-bar.1.value',
      'stats.week-bar.1.day',
      'stats.week-bar.2.bar',
      'stats.game-card.logo',
      'stats.game-card.title',
      'stats.reset-button',
      'stats.local-note',
      'stats.local-note.icon',
      'stats.banner-ad',
      ...CELLS,
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.queryByTestId('stats.week-bar.1.bar')).toBeNull();
    expect(screen.getByTestId('stats.overview-card.play-time.value')).toHaveTextContent(
      '2 h 14 min',
    );

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('leaves out the Endless row for games without Endless', async () => {
    await renderWithShell(
      <StatsView model={modelWith({ snapshot: { ...SNAPSHOT, bestEndless: null } })} />,
    );

    expect(screen.queryByTestId('stats.best-card.endless')).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('leaves out the best level score until a level is won', async () => {
    await renderWithShell(
      <StatsView model={modelWith({ snapshot: { ...SNAPSHOT, bestLevelScore: null } })} />,
    );

    expect(screen.queryByTestId('stats.best-card.level-score')).toBeNull();
    expect(screen.getByTestId('stats.best-card.win-streak')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('shows the empty state to a new player and plays from it', async () => {
    const model = modelWith({ isEmpty: true });
    const user = userEvent.setup();
    await renderWithShell(<StatsView model={model} />);

    for (const testID of [
      'stats.empty-state',
      'stats.empty-state.picture',
      'stats.empty-state.title',
      'stats.empty-state.body',
      'stats.local-note',
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.queryByTestId('stats.overview-card')).toBeNull();
    await user.press(screen.getByTestId('stats.play-button'));

    expect(model.onPlay).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('charts the last seven days, today last, each bar named and a day without games barless', async () => {
    await renderWithShell(<StatsView model={modelWith()} />);
    const bars = [1, 2, 3, 4, 5, 6, 7].map((day) => `stats.week-bar.${String(day)}`);

    expect(bars.map((testID) => screen.getByTestId(testID, HIDDEN))).toHaveLength(7);
    expect(screen.getByRole('image', { name: /^.?Mon.?: 0 games$/ })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: /^.?Sun.?: 1 game$/ })).toBeOnTheScreen();
    expect(screen.getByTestId('stats.week-bar.1.value', HIDDEN)).toHaveTextContent('0');
    expect(screen.queryByTestId('stats.week-bar.1.bar', HIDDEN)).not.toBeOnTheScreen();
    expect(screen.getByTestId('stats.week-bar.7.bar', HIDDEN)).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('lays the bars in a plain row, oldest to today, with Persian digits in fa (spec 7.5)', async () => {
    const persian = createNumberFormatter(localeTagFor('fa', 'automatic'));
    await renderWithShell(<StatsView model={modelWith({ formatNumber: persian })} />, {
      language: 'fa',
      direction: 'rtl',
    });
    const chart = screen.getByTestId('stats.week-card.chart', HIDDEN);
    const order = chart
      .queryAll((node: TestInstance) => /^stats\.week-bar\.\d$/.test(String(node.props['testID'])))
      .map((node) => String(node.props['testID']));

    // allow-style-assertion: a plain row (never row-reverse) is what runs the chart right to left.
    expect(chart).toHaveStyle({ flexDirection: 'row' });
    expect(order).toStrictEqual(
      [1, 2, 3, 4, 5, 6, 7].map((day) => `stats.week-bar.${String(day)}`),
    );
    expect(screen.getByTestId('stats.week-bar.5.value', HIDDEN)).toHaveTextContent('۶');
    expect(screen.getByTestId('stats.overview-card.games-played.value')).toHaveTextContent('۵۸');
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it("draws Line Siege's own card: its three counters, the combo as ×6, its title", async () => {
    await renderWithShell(<StatsView model={modelWith()} />);

    for (const key of ['monsters-defeated', 'beams-fired', 'biggest-combo']) {
      expect(screen.getByTestId(`stats.game-card.${key}.value`)).toBeOnTheScreen();
      expect(screen.getByTestId(`stats.game-card.${key}.label`)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('stats.game-card.biggest-combo.value')).toHaveTextContent('×6');
    expect(screen.getByTestId('stats.game-card.title')).toHaveTextContent(/^.?Line Siege.? stats$/);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('resets through the danger key and closes the page with the padlock note', async () => {
    const model = modelWith();
    const user = userEvent.setup();
    await renderWithShell(<StatsView model={model} />);

    expect(iconsIn('stats.reset-button')).toContain('trash');
    await user.press(screen.getByRole('button', { name: 'Reset statistics' }));
    expect(model.onReset).toHaveBeenCalledTimes(1);
    expect(iconsIn('stats.local-note')).toStrictEqual(['lock']);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it("gives the empty state's note no padlock", async () => {
    await renderWithShell(<StatsView model={modelWith({ isEmpty: true })} />);

    expect(screen.getByTestId('stats.local-note')).toBeOnTheScreen();
    expect(screen.queryByTestId('stats.local-note.icon', HIDDEN)).not.toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('pins the banner under the scrolling body, and drops it for a Premium owner (8.8)', async () => {
    const view = await renderWithShell(<StatsView model={modelWith()} />);
    const scroll = scrollViewAround('stats.overview-card');

    expect(screen.getByTestId('stats.banner-ad')).toBeOnTheScreen();
    expect(scroll).not.toBeNull();
    expect(scroll?.queryAll((node) => node.props['testID'] === 'stats.banner-ad')).toHaveLength(0);
    expect(screen.getByTestId('stats.screen')).toHaveProp(
      'edges',
      expect.objectContaining({ bottom: 'additive' }),
    );

    await view.rerender(
      <StatsView model={modelWith({ banner: { renderBanner: () => null, isAllowed: false } })} />,
    );
    expect(screen.queryByTestId('stats.banner-ad')).not.toBeOnTheScreen();
    // The body then scrolls on under the home indicator (the frame leaves the bottom edge out).
    expect(screen.getByTestId('stats.screen')).toHaveProp(
      'edges',
      expect.objectContaining({ bottom: 'off' }),
    );
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
