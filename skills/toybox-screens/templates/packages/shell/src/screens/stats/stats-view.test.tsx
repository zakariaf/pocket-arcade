// packages/shell/src/screens/stats/stats-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { StatsView } from './stats-view.tsx';

import type { StatsModel, StatsSnapshot } from './stats-model.ts';
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

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
});
