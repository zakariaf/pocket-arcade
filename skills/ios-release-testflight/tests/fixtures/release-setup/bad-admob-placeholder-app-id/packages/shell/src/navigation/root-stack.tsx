// packages/shell/src/navigation/root-stack.tsx (fixture: every route has its real screen)
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '@e07/shell/screens/home/home-screen.tsx';
import { LevelsScreen } from '@e07/shell/screens/levels/levels-screen.tsx';
import { SettingsScreen } from '@e07/shell/screens/settings/settings-screen.tsx';

export const RootStack = createNativeStackNavigator({
  groups: {
    Main: {
      screens: {
        Home: HomeScreen,
        Levels: LevelsScreen,
        Settings: { screen: SettingsScreen },
      },
    },
  },
});
