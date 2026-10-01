import { View } from 'react-native';

import type { ReactNode } from 'react';

/** The dialog card; the Scrim around it is the modal root (a modal card would hide the scrim). */
export function DialogCard({ children }: { readonly children: ReactNode }): ReactNode {
  return <View testID="dialog.card">{children}</View>;
}
