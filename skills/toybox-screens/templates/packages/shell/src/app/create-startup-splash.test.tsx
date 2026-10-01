// packages/shell/src/app/create-startup-splash.test.tsx
// no-shell-context: the restart splash brings its own i18n and theme (no stores exist before the
// direction check), so it is rendered bare, exactly as startShell registers it. The texts are
// matched loosely: AppText isolates free text with FSI/PDI.
// allow-style-assertion: a Persian splash writes its tagline right to left (writingDirection is the
// contract the DirectionProvider fixes; without it the full stop stood at the wrong end).
import { render, screen } from '@testing-library/react-native';
import { createElement } from 'react';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { createStartupSplash } from './create-startup-splash.tsx';

import type { StartupSplashGame } from './create-startup-splash.tsx';

const TEXTS = { 'demo.name': 'Demo Game', 'demo.tagline': 'Hold the wall.' };

const GAME: StartupSplashGame = {
  identity: { nameId: 'demo.name', taglineId: 'demo.tagline' },
  texts: { en: TEXTS, de: TEXTS, fa: TEXTS, ckb: TEXTS },
  presentation: {
    palette: TEST_PALETTE,
    art: { logo: { layers: [{ role: 'p', d: 'M22 2.5H26V17.5H22Z' }] } },
  },
};

describe('createStartupSplash', () => {
  it('draws S1 from the game module and restarts once it has mounted', async () => {
    const restart = jest.fn(() => Promise.resolve());
    const restartSplash = createStartupSplash({ game: GAME, language: 'en', restart });

    // The component startShell registers (a factory result, so not a JSX tag name here).
    await render(createElement(restartSplash));

    expect(
      screen.getByTestId('splash.game-name', { includeHiddenElements: true }),
    ).toHaveTextContent(/Demo Game/);
    expect(screen.getByTestId('splash.tagline', { includeHiddenElements: true })).toHaveTextContent(
      /Hold the wall\./,
    );
    expect(restart).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('writes a right-to-left language right to left (the full stop ends the line on the left)', async () => {
    const restartSplash = createStartupSplash({
      game: GAME,
      language: 'fa',
      restart: () => Promise.resolve(),
    });

    await render(createElement(restartSplash));

    expect(screen.getByTestId('splash.tagline', { includeHiddenElements: true })).toHaveStyle({
      writingDirection: 'rtl',
    });
  });
});
