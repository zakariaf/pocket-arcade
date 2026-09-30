// packages/shell/src/navigation/react-navigation.d.ts
import type { rootStack } from '@e07/shell/navigation/root-stack.tsx';
import type { StaticParamList } from '@react-navigation/native';

type RootStackParamList = StaticParamList<typeof rootStack>;

// Types useNavigation(), navigation.navigate(), popTo() and Link everywhere, from the static config.
// `interface` is required for declaration merging; the lint config allows it in *.d.ts only.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
