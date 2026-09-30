// packages/shell/src/navigation/root-stack.tsx (fixture: the Home + Settings + Premium slice)
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { NotBuiltScreen } from '@e07/shell/navigation/not-built-screen.tsx';
import {
  useIsFirstRun,
  useIsMainApp,
  useIsTestBuild,
  useNeedsLanguageChoice,
} from '@e07/shell/navigation/route-guards.ts';
import { TutorialScreen } from '@e07/shell/screens/first-run/tutorial-screen.tsx';
import { HomeScreen } from '@e07/shell/screens/home/home-screen.tsx';
import { PremiumScreen } from '@e07/shell/screens/premium/premium-screen.tsx';
import { SettingsScreen } from '@e07/shell/screens/settings/settings-screen.tsx';

/** Partial Shell (shell-slice.json: S4, S11, S12): every route stays, unbuilt ones use NotBuiltScreen. */
import type { GameParams } from '@e07/shell/navigation/route-params.ts';

export const rootStack = createNativeStackNavigator({
  screenOptions: { headerShown: false },
  groups: {
    FirstRun: {
      if: useIsFirstRun,
      screens: {
        LanguageChoice: { screen: NotBuiltScreen, if: useNeedsLanguageChoice },
        Tutorial: { screen: TutorialScreen, options: { gestureEnabled: false } },
      },
    },
    Main: {
      if: useIsMainApp,
      screens: {
        Home: HomeScreen,
        Game: {
          screen: NotBuiltScreen<GameParams>,
          options: { gestureEnabled: false, fullScreenGestureEnabled: false },
        },
        Levels: NotBuiltScreen,
        Daily: NotBuiltScreen,
        Stats: NotBuiltScreen,
        Settings: SettingsScreen,
        SettingsLanguage: NotBuiltScreen,
        About: NotBuiltScreen,
        PrivacyPolicy: NotBuiltScreen,
        Licences: NotBuiltScreen,
        Premium: PremiumScreen,
        HowToPlay: NotBuiltScreen,
      },
    },
    Debug: {
      if: useIsTestBuild,
      screens: { Debug: NotBuiltScreen, FontTest: NotBuiltScreen },
    },
  },
});
