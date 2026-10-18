import { View } from 'react-native';

import type { ReactNode } from 'react';

// Planted bug: modal on iOS only; nothing hides what lies behind from TalkBack.
export function ModalLayer({ behind, layer }: { readonly behind: ReactNode; readonly layer: ReactNode }): ReactNode {
  return (
    <View>
      <View>{behind}</View>
      {layer === null ? null : <View accessibilityViewIsModal>{layer}</View>}
    </View>
  );
}
