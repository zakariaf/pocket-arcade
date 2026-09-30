// packages/shell/src/navigation/root-stack.tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DebugRoute } from '@e07/shell/navigation/debug-route.tsx';
import { FontTestRoute } from '@e07/shell/navigation/font-test-route.tsx';
import {
  useIsFirstRun,
  useIsMainApp,
  useIsTestBuild,
  useNeedsLanguageChoice,
} from '@e07/shell/navigation/route-guards.ts';
import { DailyScreen } from '@e07/shell/screens/daily/daily-screen.tsx';
import { LanguageChoiceScreen } from '@e07/shell/screens/first-run/language-choice-screen.tsx';
import { TutorialScreen } from '@e07/shell/screens/first-run/tutorial-screen.tsx';
import { GameScreen } from '@e07/shell/screens/game/game-screen.tsx';
import { HomeScreen } from '@e07/shell/screens/home/home-screen.tsx';
import { HowToPlayScreen } from '@e07/shell/screens/how-to-play/how-to-play-screen.tsx';
import { LevelsScreen } from '@e07/shell/screens/levels/levels-screen.tsx';
import { PremiumScreen } from '@e07/shell/screens/premium/premium-screen.tsx';
import { AboutScreen } from '@e07/shell/screens/settings/about/about-screen.tsx';
import { SettingsLanguageScreen } from '@e07/shell/screens/settings/language/language-screen.tsx';
import { LicencesScreen } from '@e07/shell/screens/settings/licences/licences-screen.tsx';
import { PrivacyPolicyScreen } from '@e07/shell/screens/settings/privacy/privacy-policy-screen.tsx';
import { SettingsScreen } from '@e07/shell/screens/settings/settings-screen.tsx';
import { StatsScreen } from '@e07/shell/screens/stats/stats-screen.tsx';

/**
 * The ONE navigator (S2-S15). S1 is the native splash, S3 is Google's consent form,
 * S6 Pause and S7 Result are overlays inside Game, S14 dialogs render above the navigator.
 * Group order matters: the first screen that renders is the initial route (Home in Main).
 * The variable is camelCase on purpose: the naming rule rejects a PascalCase non-component.
 */
export const rootStack = createNativeStackNavigator({
  screenOptions: { headerShown: false },
  groups: {
    FirstRun: {
      if: useIsFirstRun,
      screens: {
        LanguageChoice: { screen: LanguageChoiceScreen, if: useNeedsLanguageChoice },
        Tutorial: { screen: TutorialScreen, options: { gestureEnabled: false } },
      },
    },
    Main: {
      if: useIsMainApp,
      screens: {
        Home: HomeScreen,
        Game: {
          screen: GameScreen,
          options: { fullScreenGestureEnabled: false },
        },
        Levels: LevelsScreen,
        Daily: DailyScreen,
        Stats: StatsScreen,
        Settings: SettingsScreen,
        SettingsLanguage: SettingsLanguageScreen,
        About: AboutScreen,
        PrivacyPolicy: PrivacyPolicyScreen,
        Licences: LicencesScreen,
        Premium: PremiumScreen,
        HowToPlay: HowToPlayScreen,
      },
    },
    Debug: {
      if: useIsTestBuild,
      screens: { Debug: DebugRoute, FontTest: FontTestRoute },
    },
  },
});
