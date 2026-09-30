// packages/shell/src/ui/app-text.tsx
// Fixture stand-in for AppText (toybox-design-system ships the real one).
import { Text } from 'react-native';

import type { ReactNode } from 'react';

export function AppText(props: { readonly children?: ReactNode; readonly testID?: string }): ReactNode {
  return <Text testID={props.testID}>{props.children}</Text>;
}
