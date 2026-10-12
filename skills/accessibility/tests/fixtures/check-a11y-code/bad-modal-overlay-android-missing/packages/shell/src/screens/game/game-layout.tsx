import { View } from 'react-native';

import type { ReactNode } from 'react';

export type GameLayoutProps = { readonly board: ReactNode; readonly overlay: ReactNode | null };

// The Android focus trap: while an overlay is open TalkBack skips the board behind it
// (accessibilityViewIsModal on the overlay is iOS-only). The board stays mounted.
export function GameLayout({ board, overlay }: GameLayoutProps): ReactNode {
  return (
    <View testID="game.layout">
      <View importantForAccessibility={overlay === null ? 'auto' : 'no-hide-descendants'}>{board}</View>
      {overlay}
    </View>
  );
}
