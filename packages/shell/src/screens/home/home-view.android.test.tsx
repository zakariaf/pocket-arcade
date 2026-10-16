// packages/shell/src/screens/home/home-view.android.test.tsx
// Runs in the unit-android project (Platform.OS === 'android'). Home pins its banner band under the
// scrolling body, and every Toybox page ends 34 pt above the screen's edge: the iPhone's home
// indicator inset is 34, Android's gesture bar only 24 dp, so on the emulator the band sat 10 pt low
// (S4 parity, E18-T20). The band keeps the ground for the missing 10 under it.
import { act, screen } from '@testing-library/react-native';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { HomeView } from './home-view.tsx';

import type { HomeModel } from './home-model.ts';
import type { LogoArt } from '@e07/shell/art/logo-art.ts';
import type { BannerCallbacks } from '@e07/shell/ui/ad-banner-slot.tsx';

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

function modelWith(
  renderBanner: (callbacks: BannerCallbacks) => ReturnType<typeof View>,
): HomeModel {
  return {
    logo: LOGO,
    gameName: 'Line Siege',
    tagline: 'Clear lines. Fire beams. Hold the wall.',
    hasEndless: true,
    isPremium: false,
    isReducedMotion: true,
    play: { isContinue: true, level: 12 },
    daily: { dateText: 'Sunday, 27 Sep', streakDays: 5, isDoneToday: false },
    bestEndlessScore: 4210,
    banner: { renderBanner, isAllowed: true },
    actions: {
      onPlay: jest.fn(),
      onOpenDaily: jest.fn(),
      onPlayDaily: jest.fn(),
      onPlayEndless: jest.fn(),
      onOpenSettings: jest.fn(),
      onOpenLevels: jest.fn(),
      onOpenStats: jest.fn(),
      onOpenHowToPlay: jest.fn(),
      onOpenPremium: jest.fn(),
    },
  };
}

/** Renders Home on a phone with a banner that has loaded. */
async function renderHomeWithBannerOn(metrics: typeof ANDROID_PHONE): Promise<void> {
  let loaded: (() => void) | undefined;
  await renderWithShell(
    <SafeAreaProvider initialMetrics={metrics}>
      <HomeView
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

describe('HomeView on Android', () => {
  it('runs where Platform.OS is android', () => {
    expect(Platform.OS).toBe('android');
  });

  it('lifts the banner band to 34 pt above the edge over the 24 dp gesture bar (spec S4)', async () => {
    await renderHomeWithBannerOn(ANDROID_PHONE);

    expect(screen.getByTestId('home.banner-ad')).toHaveStyle({ marginBottom: 10 });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it("adds nothing under the band above the iPhone's 34 pt home indicator", async () => {
    await renderHomeWithBannerOn(IPHONE);

    expect(screen.getByTestId('home.banner-ad')).toHaveStyle({ marginBottom: 0 });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
