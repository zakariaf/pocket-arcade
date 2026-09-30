// packages/shell/src/navigation/root-stack.tsx (fixture: a slice still routes two screens to the placeholder)
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '@e07/shell/screens/home/home-screen.tsx';
import { NotBuiltScreen } from '@e07/shell/navigation/not-built-screen.tsx';

export const RootStack = createNativeStackNavigator({
  groups: {
    Main: {
      screens: {
        Home: HomeScreen,
        Levels: NotBuiltScreen,
        Settings: { screen: NotBuiltScreen },
      },
    },
  },
});
