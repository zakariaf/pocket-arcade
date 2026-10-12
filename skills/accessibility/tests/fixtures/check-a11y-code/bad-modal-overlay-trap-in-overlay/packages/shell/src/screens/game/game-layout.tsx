import { View } from 'react-native';

import type { ReactNode } from 'react';

export type GameLayoutProps = { readonly board: ReactNode; readonly overlay: ReactNode | null };

// Planted bug: no Android focus trap on the board; the only no-hide-descendants is inside the
// Pause dialog itself, which hides part of the dialog instead of the board behind it.
export function GameLayout({ board, overlay }: GameLayoutProps): ReactNode {
  return (
    <View testID="game.layout">
      <View>{board}</View>
      {overlay}
    </View>
  );
}
