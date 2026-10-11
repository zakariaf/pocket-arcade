// packages/shell/src/app/shell-root.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import type { ReactNode } from 'react';

export function ShellRoot(props: { readonly children: ReactNode }): React.JSX.Element {
  return <GestureHandlerRootView style={{ flex: 1 }}>{props.children}</GestureHandlerRootView>;
}
