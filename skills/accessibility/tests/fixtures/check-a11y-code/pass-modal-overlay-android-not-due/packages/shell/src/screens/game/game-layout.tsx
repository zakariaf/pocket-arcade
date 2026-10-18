import { View } from 'react-native';

import type { ReactNode } from 'react';

export type GameLayoutProps = { readonly board: ReactNode; readonly overlay: ReactNode | null };

// No Android focus trap yet: not due before Android step 4.
export function GameLayout({ board, overlay }: GameLayoutProps): ReactNode {
  return (
    <View testID="game.layout">
      <View>{board}</View>
      {overlay}
    </View>
  );
}
