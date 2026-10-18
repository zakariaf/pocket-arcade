// packages/shell/src/app/create-startup-splash.android.test.tsx
// Runs in the unit-android project.
// no-shell-context: the restart splash brings its own i18n and theme, so it is rendered bare, as
// startShell registers it. It draws the status bar for its theme
// too: the light S1 capture showed a white bar on the sky blue (E18-T23), because this root sits
// outside ShellProviders.
import { render } from '@testing-library/react-native';
import { createElement } from 'react';
import { Appearance, StatusBar } from 'react-native';

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

describe('createStartupSplash on Android', () => {
  it('draws dark status bar text and icons on a light phone (spec 8.11, O5)', async () => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
    const setBarStyle = jest.spyOn(StatusBar, 'setBarStyle');
    const splash = createStartupSplash({
      game: GAME,
      language: 'en',
      restart: () => Promise.resolve(),
    });

    await render(createElement(splash));

    expect(setBarStyle).toHaveBeenLastCalledWith('dark-content', false);
  });
});
