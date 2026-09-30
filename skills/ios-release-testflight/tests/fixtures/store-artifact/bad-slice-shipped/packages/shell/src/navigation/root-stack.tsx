// packages/shell/src/navigation/root-stack.tsx (fixture: a slice that routes Levels to the placeholder)
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { NotBuiltScreen } from '@e07/shell/navigation/not-built-screen.tsx';
import { HomeScreen } from '@e07/shell/screens/home/home-screen.tsx';

export const RootStack = createNativeStackNavigator({
  screens: { Home: HomeScreen, Levels: NotBuiltScreen },
});
