// packages/shell/src/navigation/route-guards.test.tsx
// The first-run flow is driven by store state, not by navigate(): this test builds a static
// stack with the same groups and `if` hooks as rootStack (probe screens instead of the real
// ones) and checks which route shows as the settings store changes.
import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { useIsFirstRun, useIsMainApp, useNeedsLanguageChoice } from './route-guards.ts';

import type { ReactNode } from 'react';

// route-guards.ts imports TEST_ONLY, which in a test build requires the whole debug screen. The
// guards under test do not depend on it, so this test runs before the debug screen exists and
// never loads it (the central Skia mock in jest.setup.ts would also let it load).
jest.mock('@e07/shell/app/test-only.ts', () => ({ TEST_ONLY: null }));

function LanguageProbe(): ReactNode {
  return <View testID="language-choice.screen" />;
}
function TutorialProbe(): ReactNode {
  return <View testID="tutorial.screen" />;
}
function HomeProbe(): ReactNode {
  return <View testID="home.screen" />;
}

const probeStack = createNativeStackNavigator({
  screenOptions: { headerShown: false },
  groups: {
    FirstRun: {
      if: useIsFirstRun,
      screens: {
        LanguageChoice: { screen: LanguageProbe, if: useNeedsLanguageChoice },
        Tutorial: TutorialProbe,
      },
    },
    Main: { if: useIsMainApp, screens: { Home: HomeProbe } },
  },
});
const Navigation = createStaticNavigation(probeStack);

describe('route guards', () => {
  it('starts a first launch on the language choice', async () => {
    await renderWithShell(<Navigation />);
    expect(screen.getByTestId('language-choice.screen')).toBeOnTheScreen();
  });

  it('opens the tutorial once a language is chosen', async () => {
    const { stores } = await renderWithShell(<Navigation />);
    await act(() => {
      stores.settings.getState().dispatch({ type: 'set-language', language: 'de' });
    });
    expect(screen.getByTestId('tutorial.screen')).toBeOnTheScreen();
  });

  it('lands on Home when the tutorial is finished', async () => {
    const { stores } = await renderWithShell(<Navigation />);
    await act(() => {
      stores.settings.getState().dispatch({ type: 'set-language', language: 'en' });
      stores.settings.getState().dispatch({ type: 'finish-tutorial' });
    });
    expect(screen.getByTestId('home.screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('tutorial.screen')).not.toBeOnTheScreen();
  });
});
