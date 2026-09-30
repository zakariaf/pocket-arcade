// packages/shell/src/screens/game/use-result-actions.ts (fixture)
import { StackActions, useNavigation } from '@react-navigation/native';

export function useResultActions(): { readonly goLevels: () => void; readonly goHome: () => void } {
  const navigation = useNavigation();
  return {
    goLevels: () => {
      navigation.navigate('Levels');
    },
    goHome: () => {
      navigation.navigate('Home');
    },
  };
}
