import { View } from 'react-native';

import type { ReactNode } from 'react';

// Planted bug: the frame no longer renders DialogCard, so VoiceOver can reach the screen behind.
export function DialogFrame({ children }: { readonly children: ReactNode }): ReactNode {
  return <View testID="dialog.frame">{children}</View>;
}
