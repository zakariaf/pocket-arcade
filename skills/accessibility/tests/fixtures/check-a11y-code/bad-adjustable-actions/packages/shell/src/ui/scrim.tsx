import { View } from 'react-native';

import type { ReactNode } from 'react';

/** The modal root of every dialog: VoiceOver stays inside, and the scrim's testID stays listed. */
export function Scrim({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <View accessibilityViewIsModal testID="dialog.scrim">
      {children}
    </View>
  );
}
