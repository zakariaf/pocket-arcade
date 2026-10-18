import { View } from 'react-native';

import type { ReactNode } from 'react';

// Planted bug: the Android focus trap is in place (game-layout.tsx), but the iOS half is gone:
// without accessibilityViewIsModal VoiceOver wanders onto the board behind Pause.
export function PauseDialog({ children }: { readonly children: ReactNode }): ReactNode {
  return <View testID="pause.card">{children}</View>;
}
