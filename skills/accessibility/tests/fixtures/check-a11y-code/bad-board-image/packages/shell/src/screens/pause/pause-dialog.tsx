import { View } from 'react-native';

import type { ReactNode } from 'react';

export function PauseDialog({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <View accessibilityViewIsModal testID="pause.card">
      {children}
    </View>
  );
}
