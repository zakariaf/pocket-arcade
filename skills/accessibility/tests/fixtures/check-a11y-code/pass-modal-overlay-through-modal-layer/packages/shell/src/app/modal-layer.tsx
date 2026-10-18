import { View } from 'react-native';

import type { ReactNode } from 'react';

// The one layer primitive: modal on iOS, and what lies behind hidden from TalkBack.
export function ModalLayer({ behind, layer }: { readonly behind: ReactNode; readonly layer: ReactNode }): ReactNode {
  return (
    <View>
      <View importantForAccessibility={layer === null ? 'auto' : 'no-hide-descendants'}>{behind}</View>
      {layer === null ? null : <View accessibilityViewIsModal>{layer}</View>}
    </View>
  );
}
