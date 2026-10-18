// packages/shell/src/ui/scrim.tsx (fixture: drawn inside a ModalLayer, so no launch marker of its own)
import { View } from 'react-native';

import type { ReactNode } from 'react';

export function Scrim({ testID, children }: { readonly testID: string; readonly children?: ReactNode }): ReactNode {
  return (
    <View testID={testID} accessibilityViewIsModal>
      {children}
    </View>
  );
}
