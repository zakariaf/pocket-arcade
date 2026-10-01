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
});
