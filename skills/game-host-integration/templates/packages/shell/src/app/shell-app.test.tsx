// packages/shell/src/app/shell-app.test.tsx
// no-shell-context: ShellApp is the Shell's own provider stack; this test renders it the way the app
// does (createShellParts over in-memory adapters), so a provider the root forgets fails here.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { createTestAdapters } from '@e07/shell/testing/create-test-adapters.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { createShellParts } from './create-shell-parts.ts';
import { ShellApp } from './shell-app.tsx';

import type { ShellLaunch } from './create-shell-parts.ts';

/** The whole app renders here; under a loaded, instrumented coverage run that can take seconds. */
const APP_READY = { timeout: 10_000 };

// Screens read expo.extra.game (readGameExtra) as withShell embeds it in the app.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.0.0',
      extra: {
        adsMode: 'off',
        game: jest.requireActual<{ TEST_GAME_EXTRA: unknown }>(
          '@e07/shell/testing/create-test-adapters.ts',
        ).TEST_GAME_EXTRA,
      },
    },
  },
}));
// The native SafeAreaProvider renders nothing until the device reports its insets; the library's
// own Jest mock gives it a phone's metrics at once (the providers under test stay real).
jest.mock(
  'react-native-safe-area-context',
  () =>
    jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

/** Past the first run, opened on Settings above Home (as a relaunch or a debug link would). */
const SETTINGS_FIRST: ShellLaunch = {
  prepareSave: (save) => {
    save.update((doc) => ({ ...doc, firstRun: { languageChosen: true, tutorialDone: true } }));
  },
  initialState: () => ({ index: 1, routes: [{ name: 'Home' }, { name: 'Settings' }] }),
};

/** A first launch after the language choice: the FirstRun group opens the tutorial level. */
const TUTORIAL_FIRST: ShellLaunch = {
  prepareSave: (save) => {
    save.update((doc) => ({ ...doc, firstRun: { languageChosen: true, tutorialDone: false } }));
  },
};

function launchApp(launch: ShellLaunch) {
  const adapters = createTestAdapters();
  const input = { game: TALLY_GAME, language: 'en', directionPlan: 'keep', launch } as const;
  return { adapters, parts: createShellParts(input, adapters) };
}

describe('ShellApp', () => {
  it('renders Settings through the real providers: host, Premium, dialogs, services and stores', async () => {
    const { adapters, parts } = launchApp(SETTINGS_FIRST);
    await render(<ShellApp parts={parts} />);
    expect(await screen.findByTestId('settings.screen', {}, APP_READY)).toBeOnTheScreen();
    expect(screen.getByTestId('settings.top-bar')).toBeOnTheScreen();
    // A hook whose provider the root forgot throws while rendering: the crash screen would show.
    expect(screen.queryByTestId('crash.home-button')).not.toBeOnTheScreen();
    expect(adapters.errorLog.recorded.filter((entry) => entry.source === 'render')).toStrictEqual(
      [],
    );
  });

  it('opens the tutorial level on a first launch, with the game host the root provides', async () => {
    const { adapters, parts } = launchApp(TUTORIAL_FIRST);
    await render(<ShellApp parts={parts} />);
    expect(await screen.findByTestId('tutorial.screen', {}, APP_READY)).toBeOnTheScreen();
    expect(parts.hydrated.save.doc().run?.ref).toStrictEqual({ kind: 'tutorial' });
    expect(adapters.errorLog.recorded.filter((entry) => entry.source === 'render')).toStrictEqual(
      [],
    );
  });

  it('shows the crash screen for a screen that throws, and Back to Home restarts at Home', async () => {
    const { adapters, parts } = launchApp(SETTINGS_FIRST);
    // Settings reads the host's hasMusic: a host that throws there crashes that one screen.
    const broken = Object.defineProperty({ ...parts.host }, 'hasMusic', {
      get: () => {
        throw new Error('broken host');
      },
    });
    await render(<ShellApp parts={{ ...parts, host: broken }} />);
    await fireEvent.press(await screen.findByTestId('crash.home-button', {}, APP_READY));
    expect(await screen.findByTestId('home.screen', {}, APP_READY)).toBeOnTheScreen();
    expect(adapters.errorLog.recorded.map((entry) => entry.source)).toContain('render');
  });
});
