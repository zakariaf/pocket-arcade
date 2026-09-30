// apps/tap-flip/src/board/tap-layer.tsx
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { ReactNode } from 'react';

const tap = Gesture.Tap();

export function TapLayer(props: { readonly children: ReactNode }): ReactNode {
  return <GestureDetector gesture={tap}>{props.children}</GestureDetector>;
}
