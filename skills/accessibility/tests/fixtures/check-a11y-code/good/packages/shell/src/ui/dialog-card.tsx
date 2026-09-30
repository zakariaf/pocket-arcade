import { View } from 'react-native';

import type { ReactNode } from 'react';

/** The one modal container: every dialog renders it, so VoiceOver stays inside the dialog. */
export function DialogCard({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <View accessibilityViewIsModal testID="dialog.card">
      {children}
    </View>
  );
}
