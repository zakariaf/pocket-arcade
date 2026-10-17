// packages/shell/src/screens/stats/stats-view.android.test.tsx
// Runs in the unit-android project (Platform.OS === 'android'). Statistics pins its banner band
// under the scrolling body, like Home, and every Toybox page ends 34 pt above the screen's edge: the
// iPhone's home indicator inset is 34, Android's gesture bar only 24 dp, so on the emulator the band
// would sit 10 pt low (E18-T21). The band keeps the ground for the missing 10 under it. The stat
// values are drawn in Persian digits in fa (createNumberFormatter).
import { act, screen } from '@testing-library/react-native';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createNumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { StatsView } from './stats-view.tsx';

import type { StatsModel, StatsSnapshot } from './stats-model.ts';
import type { LogoArt } from '@e07/shell/art/logo-art.ts';
import type { BannerCallbacks } from '@e07/shell/ui/ad-banner-slot.tsx';

jest.mock('@e07/shell/ui/icons/icon-raster.ts', () => ({
  getIconUri: (name: string) => `icon:${name}`,
}));

const LOGO: LogoArt = { layers: [{ role: 'p', d: 'M22 2.5H26V17.5H22Z' }] };

/** The Android parity phone: 44 dp status bar (with the cutout), 24 dp gesture bar. */
const ANDROID_PHONE = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 44, left: 0, right: 0, bottom: 24 },
};

/** The iPhone 16 Pro: 62 pt top, 34 pt home indicator. */
const IPHONE = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 62, left: 0, right: 0, bottom: 34 },
};

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
  week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((letter, index) => ({
    letter,
    weekdayName: letter,
    games: index,
  })),
  gameStats: [],
};

function modelWith(
  renderBanner: (callbacks: BannerCallbacks) => ReturnType<typeof View>,
  formatNumber: (value: number) => string = (value) => value.toString(),
): StatsModel {
  return {
    isEmpty: false,
    snapshot: SNAPSHOT,
    gameName: 'Line Siege',
    logo: LOGO,
    formatNumber,
    formatPercent: (rate) => `${String(Math.round(rate * 100))}%`,
    isReducedMotion: true,
    banner: { renderBanner, isAllowed: true },
    onBack: jest.fn(),
    onReset: jest.fn(),
    onPlay: jest.fn(),
  };
}

/** Renders Statistics on a phone with a banner that has loaded. */
async function renderStatsWithBannerOn(metrics: typeof ANDROID_PHONE): Promise<void> {
  let loaded: (() => void) | undefined;
  await renderWithShell(
    <SafeAreaProvider initialMetrics={metrics}>
      <StatsView
        model={modelWith(({ onLoaded }) => {
          loaded = onLoaded;
          return <View testID="fake.banner" />;
        })}
      />
    </SafeAreaProvider>,
  );
  await act(() => {
    loaded?.();
  });
}

describe('StatsView on Android', () => {
  it('runs where Platform.OS is android', () => {
    expect(Platform.OS).toBe('android');
  });

  it('lifts the banner band to 34 pt above the edge over the 24 dp gesture bar (spec S10)', async () => {
    await renderStatsWithBannerOn(ANDROID_PHONE);

    expect(screen.getByTestId('stats.banner-ad')).toHaveStyle({ marginBottom: 10 });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it("adds nothing under the band above the iPhone's 34 pt home indicator", async () => {
    await renderStatsWithBannerOn(IPHONE);

    expect(screen.getByTestId('stats.banner-ad')).toHaveStyle({ marginBottom: 0 });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws the stat values in Persian digits in fa', async () => {
    const persian = createNumberFormatter(localeTagFor('fa', 'automatic'));
    await renderWithShell(
      <SafeAreaProvider initialMetrics={ANDROID_PHONE}>
        <StatsView model={modelWith(() => null, persian)} />
      </SafeAreaProvider>,
      { language: 'fa', direction: 'rtl' },
    );

    expect(screen.getByTestId('stats.overview-card.games-played.value')).toHaveTextContent('۵۸');
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
