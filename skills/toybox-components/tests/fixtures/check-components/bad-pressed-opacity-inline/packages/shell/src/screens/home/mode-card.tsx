// Planted bug: a hand-rolled press that fades instead of sinking, and a gesture-handler button.
import { View } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';

import type { ReactNode } from 'react';

export function ModeCard(props: { readonly isPressed: boolean }): ReactNode {
  return (
    <RectButton>
      <View style={{ opacity: props.isPressed ? 0.6 : 1 }} />
    </RectButton>
  );
}
