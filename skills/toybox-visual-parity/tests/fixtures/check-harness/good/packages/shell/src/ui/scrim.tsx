// packages/shell/src/ui/scrim.tsx (fixture: the modal root draws the launch marker)
import { View } from 'react-native';

import { ParityLaunchMarker } from '@e07/shell/app/parity-launch-marker.tsx';

import type { ReactNode } from 'react';

export function Scrim({ testID, children }: { readonly testID: string; readonly children?: ReactNode }): ReactNode {
  return (
    <View testID={testID} accessibilityViewIsModal>
      <ParityLaunchMarker />
      {children}
    </View>
  );
}
