// packages/shell/src/app/startup-splash.test.tsx
import { screen } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { StartupSplash } from './startup-splash.tsx';

import type { LogoArt } from '@e07/shell/art/logo-art.ts';

const LOGO: LogoArt = { layers: [{ role: 'p', d: 'M22 2.5H26V17.5H22Z' }] };

describe('StartupSplash', () => {
  it('draws the S1 logo, name, tagline and a labelled loader', async () => {
    await renderWithShell(
      <StartupSplash
        logo={LOGO}
        gameName="Line Siege"
        tagline="Hold the wall."
        isReducedMotion={false}
      />,
    );

    for (const testID of ['splash.screen', 'splash.game-name', 'splash.tagline']) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    // The logo tile is decorative (hidden from VoiceOver); the name says what the game is.
    expect(screen.getByTestId('splash.logo', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('splash.loader')).toHaveAccessibleName(/Loading/);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  // Spec S1: covers the load time with the game's logo; the loader names the game for VoiceOver.
  it('tells VoiceOver which game is loading (spec S1)', async () => {
    await renderWithShell(
      <StartupSplash
        logo={LOGO}
        gameName="Line Siege"
        tagline="Hold the wall."
        isReducedMotion={false}
      />,
    );

    // t() isolates the name with FSI and PDI, so the label is matched loosely around it.
    expect(screen.getByTestId('splash.loader')).toHaveAccessibleName(/^Loading .*Line Siege.*…$/);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('says Loading in Persian with the game name kept in Latin letters', async () => {
    await renderWithShell(
      <StartupSplash
        logo={LOGO}
        gameName="Line Siege"
        tagline="Hold the wall."
        isReducedMotion={false}
      />,
      { language: 'fa' },
    );

    expect(screen.getByTestId('splash.loader')).toHaveAccessibleName(
      /^در حال بارگذاری .*Line Siege.*…$/,
    );
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
