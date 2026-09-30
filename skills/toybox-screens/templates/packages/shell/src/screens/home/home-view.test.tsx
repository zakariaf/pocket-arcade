// packages/shell/src/screens/home/home-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { HomeView } from './home-view.tsx';

import type { HomeModel } from './home-model.ts';
import type { LogoArt } from '@e07/shell/art/logo-art.ts';

const LOGO: LogoArt = { layers: [{ role: 'p', d: 'M22 2.5H26V17.5H22Z' }] };

const ALWAYS = [
  'home.screen',
  'home.top-bar',
  'home.brand-lock',
  'home.logo',
  'home.game-name',
  'home.settings-button',
  'home.play-button',
  'home.daily-card',
  'home.daily-card.icon',
  'home.daily-card.title',
  'home.daily-card.date',
  'home.daily-card.streak',
  'home.levels-button',
  'home.stats-button',
  'home.how-to-play-button',
];

function modelWith(overrides: Partial<HomeModel> = {}): HomeModel {
  return {
    logo: LOGO,
    gameName: 'Line Siege',
    tagline: 'Clear lines. Fire beams. Hold the wall.',
    hasEndless: true,
    isPremium: false,
    isReducedMotion: false,
    play: { isContinue: true, level: 12 },
    daily: { dateText: 'Sunday, 27 Sep', streakDays: 5, isDoneToday: false },
    bestEndlessScore: 4210,
    banner: { renderBanner: () => null, isAllowed: true },
    actions: {
      onPlay: jest.fn(),
      onPlayDaily: jest.fn(),
      onPlayEndless: jest.fn(),
      onOpenSettings: jest.fn(),
      onOpenLevels: jest.fn(),
      onOpenStats: jest.fn(),
      onOpenHowToPlay: jest.fn(),
      onOpenPremium: jest.fn(),
    },
    ...overrides,
  };
}

describe('HomeView', () => {
  it('draws the normal S4 frame with its design testIDs', async () => {
    await renderWithShell(<HomeView model={modelWith()} />);

    for (const testID of ALWAYS)
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('home.endless-card')).toBeOnTheScreen();
    expect(screen.getByTestId('home.premium-button')).toBeOnTheScreen();
    expect(screen.getByTestId('home.banner-ad')).toBeOnTheScreen();
    expect(screen.queryByTestId('home.tagline')).toBeNull();
    expect(screen.getByText('Continue – Level 12')).toBeOnTheScreen();

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws the Premium variant: badge and tagline, no Premium key, no banner', async () => {
    await renderWithShell(<HomeView model={modelWith({ isPremium: true })} />);

    expect(screen.getByTestId('home.premium-badge')).toBeOnTheScreen();
    expect(screen.getByTestId('home.tagline')).toBeOnTheScreen();
    expect(screen.queryByTestId('home.premium-button')).toBeNull();
    expect(screen.queryByTestId('home.banner-ad')).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('gives the tilted tagline room above the body only while it shows', async () => {
    // The body is the one scroll view (the only node with a contentContainerStyle).
    const bodyTop = (): unknown =>
      screen.container
        .queryAll((node) => node.props['contentContainerStyle'] !== undefined)
        .map((node) => StyleSheet.flatten(node.props['style']).marginTop)[0];
    await renderWithShell(<HomeView model={modelWith({ isPremium: true })} />);
    expect(bodyTop()).toBe(-10);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);

    await renderWithShell(<HomeView model={modelWith()} />);
    expect(bodyTop()).toBeUndefined();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('replaces the daily play button once today is done', async () => {
    const model = modelWith({
      daily: { dateText: 'Sunday, 27 Sep', streakDays: 5, isDoneToday: true },
    });
    await renderWithShell(<HomeView model={model} />);

    expect(screen.getByTestId('home.daily-card.done')).toBeOnTheScreen();
    expect(screen.queryByTestId('home.daily-card.play-button')).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('starts play from the hero key', async () => {
    const model = modelWith();
    const user = userEvent.setup();
    await renderWithShell(<HomeView model={model} />);

    await user.press(screen.getByTestId('home.play-button'));

    expect(model.actions.onPlay).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
