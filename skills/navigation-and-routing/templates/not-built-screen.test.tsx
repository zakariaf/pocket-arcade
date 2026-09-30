// packages/shell/src/navigation/not-built-screen.test.tsx
// A partial Shell keeps the whole route table: routes outside shell-slice.json point at
// NotBuiltScreen. This test mounts a small static stack with the real route guards and proves the
// placeholder is navigable (Back leaves it) and that the FirstRun placeholders still finish the
// first launch, so a slice build reaches Home.
import { createStaticNavigation, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, screen, userEvent } from '@testing-library/react-native';
import { View } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { Button } from '@e07/shell/ui/button.tsx';

import { NotBuiltScreen } from './not-built-screen.tsx';
import { useIsFirstRun, useIsMainApp, useNeedsLanguageChoice } from './route-guards.ts';

import type { ReactNode } from 'react';

// route-guards.ts reaches TEST_ONLY; the placeholder never needs the debug screen.
jest.mock('@e07/shell/app/test-only.ts', () => ({ TEST_ONLY: null }));

function HomeProbe(): ReactNode {
  const navigation = useNavigation();
  return (
    <View testID="home.screen">
      <Button
        testID="home.levels-button"
        label="Levels"
        onPress={() => {
          navigation.navigate('Levels');
        }}
        isReducedMotion
      />
    </View>
  );
}

const sliceStack = createNativeStackNavigator({
  screenOptions: { headerShown: false },
  groups: {
    FirstRun: {
      if: useIsFirstRun,
      screens: {
        LanguageChoice: { screen: NotBuiltScreen, if: useNeedsLanguageChoice },
        Tutorial: NotBuiltScreen,
      },
    },
    Main: { if: useIsMainApp, screens: { Home: HomeProbe, Levels: NotBuiltScreen } },
  },
});
const Navigation = createStaticNavigation(sliceStack);

describe('NotBuiltScreen', () => {
  it('finishes the first launch through both FirstRun placeholders and lands on Home', async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithShell(<Navigation />);
    expect(screen.getByTestId('not-built.route-name')).toHaveTextContent('LanguageChoice');
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);

    await user.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('not-built.route-name')).toHaveTextContent('Tutorial');
    expect(stores.settings.getState().settings.language).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('home.screen')).toBeOnTheScreen();
    expect(stores.settings.getState().firstRun).toMatchObject({
      languageChosen: true,
      tutorialDone: true,
    });
  });

  it('stands in for a Main route with the route name and a working Back', async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithShell(<Navigation />);
    await act(() => {
      stores.settings.getState().dispatch({ type: 'set-language', language: 'en' });
      stores.settings.getState().dispatch({ type: 'finish-tutorial' });
    });
    await user.press(screen.getByRole('button', { name: 'Levels' }));

    expect(screen.getByTestId('not-built.route-name')).toHaveTextContent('Levels');
    expect(screen.queryByTestId('not-built.next-button')).not.toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);

    await user.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('home.screen')).toBeOnTheScreen();
  });
});
